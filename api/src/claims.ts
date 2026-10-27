import { getAddress, isAddress } from 'viem'
import { roundNumber } from '../../src/game/round'
import { holds } from './chain'
import { codeHash } from './entries'
import type { Env } from './env'
import { HttpError, json, readJson } from './http'
import { toUsd } from './money'

interface CodeRow {
  entry_id: number
  round_id: number
  status: string
  winner_entry_id: number | null
  prize: string | null
  eth_usd: number | null
  claim_status: string | null
  claim_deadline: number | null
  claim_wallet: string | null
  payout_tx: string | null
}

async function findCode(env: Env, code: unknown): Promise<CodeRow> {
  const row = await env.DB.prepare(
    `SELECT e.id AS entry_id, e.round_id, r.status, r.winner_entry_id, r.prize, r.eth_usd, r.claim_status, r.claim_deadline, r.claim_wallet,
       p.tx_hash AS payout_tx
     FROM entries e
     JOIN rounds r ON r.id = e.round_id
     LEFT JOIN payouts p ON p.round_id = r.id
     WHERE e.code_hash = ?`,
  )
    .bind(await codeHash(code))
    .first<CodeRow>()
  if (!row) throw new HttpError(404, 'We could not find that code.')
  return row
}

function outcome(row: CodeRow): string {
  if (row.status !== 'settled') return 'judging'
  if (row.winner_entry_id !== row.entry_id) return 'lost'
  return row.claim_status ?? 'rolled_over'
}

export async function checkCode(request: Request, env: Env): Promise<Response> {
  const row = await findCode(env, (await readJson(request)).code)
  const won = row.status === 'settled' && row.winner_entry_id === row.entry_id
  return json({
    round: row.round_id,
    number: roundNumber(row.round_id),
    status: outcome(row),
    prize: won && row.prize !== null ? { wei: row.prize, usd: toUsd(BigInt(row.prize), row.eth_usd) } : null,
    deadline: won ? row.claim_deadline : null,
    wallet: won ? row.claim_wallet : null,
    tx: won ? row.payout_tx : null,
  })
}

export async function claimPrize(request: Request, env: Env, now: number): Promise<Response> {
  const body = await readJson(request)
  const row = await findCode(env, body.code)
  const wallet = typeof body.wallet === 'string' ? body.wallet.trim() : ''
  if (outcome(row) !== 'open') throw new HttpError(409, 'This code has no prize to claim.')
  if (row.claim_deadline === null || now > row.claim_deadline) throw new HttpError(409, 'The claim window has closed.')
  if (!isAddress(wallet)) throw new HttpError(400, 'Enter a valid wallet address.')
  const address = getAddress(wallet)
  if (!(await holds(env, address))) throw new HttpError(403, 'This wallet does not hold $DOODLEWARS yet. Buy some and try again before the window closes.')
  const updated = await env.DB.prepare(
    "UPDATE rounds SET claim_status = 'claimed', claim_wallet = ?, claimed_at = ? WHERE id = ? AND winner_entry_id = ? AND claim_status = 'open' AND claim_deadline >= ?",
  )
    .bind(address, now, row.round_id, row.entry_id, now)
    .run()
  if (updated.meta.changes !== 1) throw new HttpError(409, 'The claim window has closed.')
  return json({ round: row.round_id, status: 'claimed', wallet: address })
}
