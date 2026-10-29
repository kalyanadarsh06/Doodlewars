import type { Hex } from 'viem'
import { promptFor } from '../../src/game/round'

export type RoundStatus = 'open' | 'closed' | 'judged' | 'void'

export type FinalStatus = 'closed' | 'settled'

export type PayStatus = 'due' | 'sent' | 'unpaid'

export interface RoundRow {
  id: number
  prompt: string
  status: RoundStatus
  winner_entry_id: number | null
  judge_note: string | null
  closed_at: number | null
  judged_at: number | null
}

export interface EntryRow {
  id: number
  round_id: number
  title: string
  wallet: string | null
  entered: number
  image_key: string
  token_hash: string
  source: string
  hidden: number
  created_at: number
}

export interface FinalRow {
  id: number
  status: FinalStatus
  close_block: number
  close_balance: string
  fees: string
  carry: string | null
  prize: string | null
  winner_entry_id: number | null
  judge_note: string | null
  pay_status: PayStatus | null
  closed_at: number
  settled_at: number | null
}

export interface PayoutRow {
  id: number
  final_id: number
  recipient: string
  amount: string
  gas: string | null
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

export function getFinal(db: D1Database, id: number): Promise<FinalRow | null> {
  return db.prepare('SELECT * FROM finals WHERE id = ?').bind(id).first<FinalRow>()
}

export async function roundsWithStatus(db: D1Database, status: RoundStatus): Promise<RoundRow[]> {
  const { results } = await db.prepare('SELECT * FROM rounds WHERE status = ? ORDER BY id').bind(status).all<RoundRow>()
  return results
}

export async function finalsWithStatus(db: D1Database, status: FinalStatus): Promise<FinalRow[]> {
  const { results } = await db.prepare('SELECT * FROM finals WHERE status = ? ORDER BY id').bind(status).all<FinalRow>()
  return results
}

export async function ensureRound(db: D1Database, id: number): Promise<void> {
  if (await getRound(db, id)) return
  const suggestion = await db
    .prepare("SELECT id, text FROM prompts WHERE status = 'approved' ORDER BY RANDOM() LIMIT 1")
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

export async function outflowBetween(db: D1Database, afterBlock: number, throughBlock: number): Promise<bigint> {
  const { results } = await db
    .prepare("SELECT status, amount, gas FROM payouts WHERE status IN ('confirmed', 'failed') AND block > ? AND block <= ?")
    .bind(afterBlock, throughBlock)
    .all<{ status: string; amount: string; gas: string | null }>()
  return results.reduce((sum, row) => sum + BigInt(row.gas ?? '0') + (row.status === 'confirmed' ? BigInt(row.amount) : 0n), 0n)
}
