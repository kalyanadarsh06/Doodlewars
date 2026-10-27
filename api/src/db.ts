import type { Hex } from 'viem'
import { promptFor } from '../../src/game/round'

export type RoundStatus = 'open' | 'closed' | 'judged' | 'settled' | 'void'

export type ClaimStatus = 'open' | 'claimed' | 'expired'

export interface RoundRow {
  id: number
  prompt: string
  status: RoundStatus
  close_block: number | null
  close_balance: string | null
  fees: string | null
  eth_usd: number | null
  prize: string | null
  winner_entry_id: number | null
  judge_note: string | null
  claim_status: ClaimStatus | null
  claim_deadline: number | null
  claim_wallet: string | null
  claimed_at: number | null
  closed_at: number | null
  judged_at: number | null
  settled_at: number | null
}

export interface EntryRow {
  id: number
  round_id: number
  title: string
  name: string
  image_key: string
  code_hash: string
  source: string
  hidden: number
  created_at: number
}

export interface PayoutRow {
  id: number
  round_id: number
  recipient: string
  amount: string
  nonce: number
  raw_tx: Hex
  tx_hash: Hex
  status: 'pending' | 'confirmed' | 'failed'
  block: number | null
  sent_at: number
}

export interface Checkpoint {
  block: number
  balance: string
}

export interface Anchor extends Checkpoint {
  round: number
}

export async function getMeta<T>(db: D1Database, key: string): Promise<T | null> {
  const row = await db.prepare('SELECT value FROM meta WHERE key = ?').bind(key).first<{ value: string }>()
  return row ? (JSON.parse(row.value) as T) : null
}

export async function setMeta(db: D1Database, key: string, value: unknown): Promise<void> {
  await db
    .prepare('INSERT INTO meta (key, value) VALUES (?1, ?2) ON CONFLICT (key) DO UPDATE SET value = ?2')
    .bind(key, JSON.stringify(value))
    .run()
}

export async function acquireLock(db: D1Database, now: number, ttl: number): Promise<boolean> {
  const result = await db
    .prepare("INSERT INTO meta (key, value) VALUES ('lock', ?1) ON CONFLICT (key) DO UPDATE SET value = ?1 WHERE CAST(value AS INTEGER) < ?2")
    .bind(String(now + ttl), now)
    .run()
  return result.meta.changes === 1
}

export async function releaseLock(db: D1Database, now: number, ttl: number): Promise<void> {
  await db.prepare("DELETE FROM meta WHERE key = 'lock' AND value = ?").bind(String(now + ttl)).run()
}

export function getRound(db: D1Database, id: number): Promise<RoundRow | null> {
  return db.prepare('SELECT * FROM rounds WHERE id = ?').bind(id).first<RoundRow>()
}

export async function roundsWithStatus(db: D1Database, status: RoundStatus): Promise<RoundRow[]> {
  const { results } = await db.prepare('SELECT * FROM rounds WHERE status = ? ORDER BY id').bind(status).all<RoundRow>()
  return results
}

export async function ensureRound(db: D1Database, id: number): Promise<void> {
  if (await getRound(db, id)) return
  const suggestion = await db
    .prepare("SELECT id, text FROM prompts WHERE status = 'approved' ORDER BY id LIMIT 1")
    .first<{ id: number; text: string }>()
  const inserted = await db
    .prepare('INSERT INTO rounds (id, prompt) VALUES (?, ?) ON CONFLICT (id) DO NOTHING')
    .bind(id, suggestion?.text ?? promptFor(id))
    .run()
  if (suggestion && inserted.meta.changes === 1) {
    await db.prepare("UPDATE prompts SET status = 'used' WHERE id = ?").bind(suggestion.id).run()
  }
}

export async function ensureMissedRound(db: D1Database, id: number): Promise<void> {
  await db.prepare('INSERT INTO rounds (id, prompt) VALUES (?, ?) ON CONFLICT (id) DO NOTHING').bind(id, promptFor(id)).run()
}

export async function visibleEntries(db: D1Database, roundId: number): Promise<EntryRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM entries WHERE round_id = ? AND hidden = 0 ORDER BY id')
    .bind(roundId)
    .all<EntryRow>()
  return results
}

export async function countEntries(db: D1Database, roundId: number): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) AS count FROM entries WHERE round_id = ? AND hidden = 0').bind(roundId).first<{ count: number }>()
  return row?.count ?? 0
}

export async function pendingPayouts(db: D1Database): Promise<PayoutRow[]> {
  const { results } = await db.prepare("SELECT * FROM payouts WHERE status = 'pending' ORDER BY nonce").all<PayoutRow>()
  return results
}

export async function confirmedOutflow(db: D1Database, afterBlock: number, throughBlock: number): Promise<bigint> {
  const { results } = await db
    .prepare("SELECT amount FROM payouts WHERE status = 'confirmed' AND block > ? AND block <= ?")
    .bind(afterBlock, throughBlock)
    .all<{ amount: string }>()
  return results.reduce((sum, row) => sum + BigInt(row.amount), 0n)
}
