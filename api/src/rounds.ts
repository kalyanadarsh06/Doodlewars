import type { Address } from 'viem'
import { ROUND_MS } from '../../src/config'
import { currentRound, finalEnd, finalOf, finalRounds } from '../../src/game/round'
import { broadcast, connect, receipt, signTransfer, snapshot, type Chain } from './chain'
import { GRACE_MS, JUDGE_GIVE_UP_MS, LOCK_MS, REBROADCAST_MS } from './constants'
import {
  acquireLock,
  ensureMissedRound,
  ensureRound,
  finalsWithStatus,
  getFinal,
  getMeta,
  outflowBetween,
  pendingPayouts,
  releaseLock,
  roundsWithStatus,
  setMeta,
  visibleEntries,
  type Anchor,
  type Checkpoint,
  type FinalRow,
  type RoundRow,
} from './db'
import { isLive, type Env } from './env'
import { judgeFinal, judgeRound, type Finalist, type Verdict } from './judge'
import { feesBetween } from './money'
import { collectFees } from './pons'
import { reviewSuggestions } from './prompts'

export function roundEnd(id: number): number {
  return (id + 1) * ROUND_MS
}

export function firstFinal(anchor: Anchor): number {
  return finalOf(anchor.round + 1)
}

async function ensureAnchor(env: Env, chain: Chain, current: number): Promise<Anchor> {
  const existing = await getMeta<Anchor>(env.DB, 'anchor')
  if (existing) return existing
  const { block, balance } = await snapshot(chain)
  const anchor: Anchor = { round: current - 1, block, balance: balance.toString() }
  await setMeta(env.DB, 'anchor', anchor)
  await env.DB.prepare("UPDATE rounds SET status = 'void' WHERE id <= ? AND status = 'open'").bind(anchor.round).run()
  return anchor
}

async function closeRounds(env: Env, anchor: Anchor, now: number): Promise<void> {
  const last = await env.DB.prepare("SELECT MAX(id) AS id FROM rounds WHERE id > ? AND status NOT IN ('open', 'void')")
    .bind(anchor.round)
    .first<{ id: number | null }>()
  for (let id = (last?.id ?? anchor.round) + 1; now >= roundEnd(id) + GRACE_MS; id += 1) {
    await ensureMissedRound(env.DB, id)
    await env.DB.prepare("UPDATE rounds SET status = 'closed', closed_at = ? WHERE id = ? AND status = 'open'").bind(now, id).run()
  }
}

async function markJudged(env: Env, round: RoundRow, winner: number | null, note: string, now: number): Promise<void> {
  await env.DB.prepare("UPDATE rounds SET status = 'judged', winner_entry_id = ?, judge_note = ?, judged_at = ? WHERE id = ? AND status = 'closed'")
    .bind(winner, note, now, round.id)
    .run()
}

async function judgeRounds(env: Env, now: number): Promise<void> {
  for (const round of await roundsWithStatus(env.DB, 'closed')) {
    const entries = await visibleEntries(env.DB, round.id)
    if (entries.length === 0) {
      await markJudged(env, round, null, 'Nobody drew this one.', now)
      continue
    }
    try {
      const verdict = await judgeRound(env, round.prompt, entries)
      const note = verdict.winner === null && !entries.some((entry) => entry.entered) ? 'Only just-for-fun drawings this round, so there’s no winner.' : verdict.reason
      if (verdict.disqualified.length > 0) {
        await env.DB.prepare(`UPDATE entries SET hidden = 1 WHERE round_id = ? AND id IN (${verdict.disqualified.map(() => '?').join(', ')})`)
          .bind(round.id, ...verdict.disqualified)
          .run()
      }
      await markJudged(env, round, verdict.winner, note, now)
    } catch (error) {
      console.error(`judging round ${round.id} failed`, error)
      if (now < roundEnd(round.id) + JUDGE_GIVE_UP_MS) return
      await markJudged(env, round, null, 'The judge could not review this round.', now)
    }
  }
}

async function refreshPayouts(env: Env, chain: Chain): Promise<void> {
  for (const payout of await pendingPayouts(env.DB)) {
    const result = await receipt(chain, payout.tx_hash)
    if (!result) continue
    await env.DB.prepare('UPDATE payouts SET status = ?, block = ?, gas = ? WHERE id = ?')
      .bind(result.success ? 'confirmed' : 'failed', result.block, result.gas.toString(), payout.id)
      .run()
  }
}

async function checkpointBefore(env: Env, anchor: Anchor, id: number): Promise<Checkpoint> {
  if (id <= firstFinal(anchor)) return anchor
  const previous = await getFinal(env.DB, id - 1)
  if (!previous) throw new Error(`Final ${id - 1} is not closed.`)
  return { block: previous.close_block, balance: previous.close_balance }
}

async function closeFinals(env: Env, chain: Chain, anchor: Anchor, now: number): Promise<void> {
  const last = await env.DB.prepare('SELECT MAX(id) AS id FROM finals').first<{ id: number | null }>()
  const next = Math.max((last?.id ?? 0) + 1, firstFinal(anchor))
  if (now < finalEnd(next) + GRACE_MS) return
  await collectFees(chain, env.TOKEN_ADDRESS as Address)
  for (let id = next; now >= finalEnd(id) + GRACE_MS; id += 1) {
    const previous = await checkpointBefore(env, anchor, id)
    const { block, balance } = await snapshot(chain)
    await refreshPayouts(env, chain)
    const fees = feesBetween(BigInt(previous.balance), balance, await outflowBetween(env.DB, previous.block, block))
    await env.DB.prepare('INSERT INTO finals (id, close_block, close_balance, fees, closed_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING')
      .bind(id, block, balance.toString(), fees.toString(), now)
      .run()
  }
}

async function roundsPending(env: Env, final: number): Promise<boolean> {
  const ids = finalRounds(final)
  const row = await env.DB.prepare("SELECT 1 FROM rounds WHERE id BETWEEN ? AND ? AND status IN ('open', 'closed')")
    .bind(ids[0], ids.at(-1))
    .first()
  return row !== null
}

async function finalistsOf(env: Env, final: number): Promise<Finalist[]> {
  const ids = finalRounds(final)
  const { results } = await env.DB.prepare(
    "SELECT e.*, r.prompt FROM rounds r JOIN entries e ON e.id = r.winner_entry_id WHERE r.id BETWEEN ? AND ? AND r.status = 'judged' AND e.hidden = 0 ORDER BY r.id",
  )
    .bind(ids[0], ids.at(-1))
    .all<Finalist>()
  return results
}

export function carryFrom(previous: FinalRow | null): bigint {
  return previous?.status === 'settled' && previous.winner_entry_id === null ? BigInt(previous.prize ?? '0') : 0n
}

async function decideFinal(env: Env, final: FinalRow, now: number): Promise<Verdict | null> {
  const finalists = await finalistsOf(env, final.id)
  if (finalists.length === 0) return { winner: null, disqualified: [], reason: 'No round had a winner this Final, so the prize rolls over.' }
  if (finalists.length === 1) return { winner: finalists[0].id, disqualified: [], reason: 'Only one round had a winner, so it takes the Final.' }
  try {
    return await judgeFinal(env, finalists)
  } catch (error) {
    console.error(`judging final ${final.id} failed`, error)
    if (now < finalEnd(final.id) + JUDGE_GIVE_UP_MS) return null
    return { winner: null, disqualified: [], reason: 'The judge could not review this Final, so the prize rolls over.' }
  }
}

async function settleFinals(env: Env, now: number): Promise<void> {
  for (const final of await finalsWithStatus(env.DB, 'closed')) {
    if (await roundsPending(env, final.id)) return
    const verdict = await decideFinal(env, final, now)
    if (!verdict) return
    const carry = carryFrom(await getFinal(env.DB, final.id - 1))
    const prize = BigInt(final.fees) + carry
    await env.DB.prepare(
      "UPDATE finals SET status = 'settled', winner_entry_id = ?, judge_note = ?, carry = ?, prize = ?, pay_status = ?, settled_at = ? WHERE id = ? AND status = 'closed'",
    )
      .bind(verdict.winner, verdict.reason, carry.toString(), prize.toString(), verdict.winner !== null && prize > 0n ? 'due' : null, now, final.id)
      .run()
  }
}

async function confirmPayouts(env: Env, chain: Chain, now: number): Promise<void> {
  await refreshPayouts(env, chain)
  for (const payout of await pendingPayouts(env.DB)) {
    if (now - payout.sent_at < REBROADCAST_MS) continue
    await broadcast(chain, payout.raw_tx)
    await env.DB.prepare('UPDATE payouts SET sent_at = ? WHERE id = ?').bind(now, payout.id).run()
  }
}

async function payFinals(env: Env, chain: Chain, now: number): Promise<void> {
  const { results } = await env.DB.prepare(
    "SELECT f.id, f.prize, e.wallet FROM finals f JOIN entries e ON e.id = f.winner_entry_id WHERE f.pay_status = 'due' ORDER BY f.id",
  ).all<{ id: number; prize: string; wallet: string }>()
  for (const final of results) {
    if ((await pendingPayouts(env.DB)).length > 0) return
    const signed = await signTransfer(chain, { to: final.wallet, value: BigInt(final.prize) })
    if (!signed) {
      await env.DB.prepare("UPDATE finals SET pay_status = 'unpaid' WHERE id = ? AND pay_status = 'due'").bind(final.id).run()
      continue
    }
    await env.DB.batch([
      env.DB.prepare('INSERT INTO payouts (final_id, recipient, amount, nonce, raw_tx, tx_hash, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(
        final.id,
        signed.to,
        signed.value.toString(),
        signed.nonce,
        signed.raw,
        signed.hash,
        now,
      ),
      env.DB.prepare("UPDATE finals SET pay_status = 'sent' WHERE id = ?").bind(final.id),
    ])
    await broadcast(chain, signed.raw)
  }
}

export async function tick(env: Env, now: number): Promise<void> {
  if (!(await acquireLock(env.DB, now, LOCK_MS))) return
  try {
    const current = currentRound(now)
    await reviewSuggestions(env)
    await ensureRound(env.DB, current)
    await ensureRound(env.DB, current + 1)
    if (!isLive(env)) return
    const chain = connect(env)
    const anchor = await ensureAnchor(env, chain, current)
    await closeRounds(env, anchor, now)
    await judgeRounds(env, now)
    await closeFinals(env, chain, anchor, now)
    await settleFinals(env, now)
    await confirmPayouts(env, chain, now)
    await payFinals(env, chain, now)
  } finally {
    await releaseLock(env.DB, now, LOCK_MS)
  }
}
