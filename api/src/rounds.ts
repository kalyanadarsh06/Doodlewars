import { ROUND_MS } from '../../src/config'
import { currentRound } from '../../src/game/round'
import { broadcast, connect, receipt, signTransfer, snapshot, type Chain } from './chain'
import { CLAIM_MS, GRACE_MS, JUDGE_GIVE_UP_MS, LOCK_MS, REBROADCAST_MS } from './constants'
import {
  acquireLock,
  confirmedOutflow,
  ensureMissedRound,
  ensureRound,
  getMeta,
  getRound,
  pendingPayouts,
  releaseLock,
  roundsWithStatus,
  setMeta,
  visibleEntries,
  type Anchor,
  type Checkpoint,
  type RoundRow,
} from './db'
import { isLive, type Env } from './env'
import { judge } from './judge'
import { feesBetween } from './money'

export interface Live {
  round: number
  fees: string
}

export function roundEnd(id: number): number {
  return (id + 1) * ROUND_MS
}

async function updatePrice(env: Env): Promise<void> {
  try {
    const response = await fetch(env.PRICE_URL)
    const body: { data?: { amount?: string } } = await response.json()
    const price = Number(body.data?.amount)
    if (response.ok && Number.isFinite(price) && price > 0) await setMeta(env.DB, 'eth_usd', price)
  } catch (error) {
    console.error('price update failed', error)
  }
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

async function checkpointBefore(env: Env, anchor: Anchor, id: number): Promise<Checkpoint> {
  if (id - 1 <= anchor.round) return anchor
  const previous = await getRound(env.DB, id - 1)
  if (!previous || previous.close_block === null || previous.close_balance === null) throw new Error(`Round ${id - 1} is not closed.`)
  return { block: previous.close_block, balance: previous.close_balance }
}

async function refreshPayouts(env: Env, chain: Chain): Promise<void> {
  for (const payout of await pendingPayouts(env.DB)) {
    const result = await receipt(chain, payout.tx_hash)
    if (!result) continue
    await env.DB.prepare('UPDATE payouts SET status = ?, block = ? WHERE id = ?')
      .bind(result.success ? 'confirmed' : 'failed', result.block, payout.id)
      .run()
  }
}

async function closeRound(env: Env, chain: Chain, anchor: Anchor, id: number, now: number): Promise<void> {
  const previous = await checkpointBefore(env, anchor, id)
  const { block, balance } = await snapshot(chain)
  await refreshPayouts(env, chain)
  const outflow = await confirmedOutflow(env.DB, previous.block, block)
  const fees = feesBetween(BigInt(previous.balance), balance, outflow)
  const price = await getMeta<number>(env.DB, 'eth_usd')
  await ensureMissedRound(env.DB, id)
  await env.DB.prepare(
    "UPDATE rounds SET status = 'closed', close_block = ?, close_balance = ?, fees = ?, eth_usd = ?, closed_at = ? WHERE id = ? AND status = 'open'",
  )
    .bind(block, balance.toString(), fees.toString(), price, now, id)
    .run()
}

async function closeRounds(env: Env, chain: Chain, anchor: Anchor, now: number): Promise<void> {
  const last = await env.DB.prepare("SELECT MAX(id) AS id FROM rounds WHERE id > ? AND status NOT IN ('open', 'void')")
    .bind(anchor.round)
    .first<{ id: number | null }>()
  for (let id = (last?.id ?? anchor.round) + 1; now >= roundEnd(id) + GRACE_MS; id += 1) {
    await closeRound(env, chain, anchor, id, now)
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
      const verdict = await judge(env, round.prompt, entries)
      if (verdict.disqualified.length > 0) {
        await env.DB.prepare(`UPDATE entries SET hidden = 1 WHERE round_id = ? AND id IN (${verdict.disqualified.map(() => '?').join(', ')})`)
          .bind(round.id, ...verdict.disqualified)
          .run()
      }
      await markJudged(env, round, verdict.winner, verdict.reason, now)
    } catch (error) {
      console.error(`judging round ${round.id} failed`, error)
      if (now < roundEnd(round.id) + JUDGE_GIVE_UP_MS) return
      await markJudged(env, round, null, 'The judge could not review this round, so the prize rolls over.', now)
    }
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

async function pool(env: Env): Promise<bigint> {
  return BigInt((await getMeta<string>(env.DB, 'pool')) ?? '0')
}

async function settleRounds(env: Env, now: number): Promise<void> {
  for (const round of await roundsWithStatus(env.DB, 'judged')) {
    const prize = BigInt(round.fees ?? '0') + (await pool(env))
    const claimable = round.winner_entry_id !== null && prize >= BigInt(env.MIN_PAYOUT_WEI)
    const updated = await env.DB.prepare(
      "UPDATE rounds SET status = 'settled', prize = ?, claim_status = ?, claim_deadline = ?, settled_at = ? WHERE id = ? AND status = 'judged'",
    )
      .bind(prize.toString(), claimable ? 'open' : null, claimable ? now + CLAIM_MS : null, now, round.id)
      .run()
    if (updated.meta.changes === 1) await setMeta(env.DB, 'pool', claimable ? '0' : prize.toString())
  }
}

async function expireClaims(env: Env, now: number): Promise<void> {
  const { results } = await env.DB.prepare("SELECT * FROM rounds WHERE claim_status = 'open' AND claim_deadline < ? ORDER BY id").bind(now).all<RoundRow>()
  for (const round of results) {
    const updated = await env.DB.prepare("UPDATE rounds SET claim_status = 'expired' WHERE id = ? AND claim_status = 'open' AND claim_deadline < ?")
      .bind(round.id, now)
      .run()
    if (updated.meta.changes === 1) await setMeta(env.DB, 'pool', ((await pool(env)) + BigInt(round.prize ?? '0')).toString())
  }
}

async function payClaims(env: Env, chain: Chain, now: number): Promise<void> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM rounds WHERE claim_status = 'claimed' AND NOT EXISTS (SELECT 1 FROM payouts p WHERE p.round_id = rounds.id) ORDER BY id",
  ).all<RoundRow>()
  for (const round of results) {
    if ((await pendingPayouts(env.DB)).length > 0) return
    if (!round.claim_wallet || !round.prize) throw new Error(`Round ${round.id} is claimed without a wallet or prize.`)
    const signed = await signTransfer(chain, { to: round.claim_wallet, value: BigInt(round.prize) })
    await env.DB.prepare('INSERT INTO payouts (round_id, recipient, amount, nonce, raw_tx, tx_hash, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(round.id, signed.to, signed.value.toString(), signed.nonce, signed.raw, signed.hash, now)
      .run()
    await broadcast(chain, signed.raw)
  }
}

async function updateLive(env: Env, chain: Chain, anchor: Anchor, current: number): Promise<void> {
  const base =
    (await env.DB.prepare('SELECT close_block AS block, close_balance AS balance FROM rounds WHERE id > ? AND close_block IS NOT NULL ORDER BY id DESC LIMIT 1')
      .bind(anchor.round)
      .first<Checkpoint>()) ?? anchor
  const { block, balance } = await snapshot(chain)
  const outflow = await confirmedOutflow(env.DB, base.block, block)
  const live: Live = { round: current, fees: feesBetween(BigInt(base.balance), balance, outflow).toString() }
  await setMeta(env.DB, 'live', live)
}

export async function tick(env: Env, now: number): Promise<void> {
  if (!(await acquireLock(env.DB, now, LOCK_MS))) return
  try {
    const current = currentRound(now)
    await ensureRound(env.DB, current)
    await ensureRound(env.DB, current + 1)
    await updatePrice(env)
    if (!isLive(env)) return
    const chain = connect(env)
    const anchor = await ensureAnchor(env, chain, current)
    await closeRounds(env, chain, anchor, now)
    await judgeRounds(env, now)
    await expireClaims(env, now)
    await settleRounds(env, now)
    await confirmPayouts(env, chain, now)
    await payClaims(env, chain, now)
    await updateLive(env, chain, anchor, current)
  } finally {
    await releaseLock(env.DB, now, LOCK_MS)
  }
}
