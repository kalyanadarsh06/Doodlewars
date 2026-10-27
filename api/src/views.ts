import { ROUND_MS } from '../../src/config'
import { currentRound, roundNumber } from '../../src/game/round'
import { PAGE_MAX } from './constants'
import { countEntries, getMeta, getRound, visibleEntries, type Anchor, type EntryRow, type RoundRow } from './db'
import { isLive, type Env } from './env'
import { HttpError, json } from './http'
import { toUsd } from './money'
import { roundEnd, type Live } from './rounds'

interface RoundListRow extends RoundRow {
  entry_count: number
  winner_title: string | null
  winner_name: string | null
  winner_image: string | null
  payout_tx: string | null
  payout_status: string | null
}

function imageUrl(key: string): string {
  return `/api/images/${key}`
}

function entryView(entry: Pick<EntryRow, 'id' | 'title' | 'name' | 'image_key'>) {
  return { id: entry.id, title: entry.title, name: entry.name, image: imageUrl(entry.image_key) }
}

function money(wei: string | null, ethUsd: number | null) {
  return wei === null ? null : { wei, usd: toUsd(BigInt(wei), ethUsd) }
}

function pastView(row: RoundListRow) {
  return {
    round: row.id,
    number: roundNumber(row.id),
    prompt: row.prompt,
    startsAt: row.id * ROUND_MS,
    endsAt: roundEnd(row.id),
    status: row.status,
    entries: row.entry_count,
    fees: money(row.fees, row.eth_usd),
    prize: money(row.prize, row.eth_usd),
    note: row.judge_note,
    winner:
      row.winner_entry_id !== null && row.winner_title !== null && row.winner_name !== null && row.winner_image !== null
        ? entryView({ id: row.winner_entry_id, title: row.winner_title, name: row.winner_name, image_key: row.winner_image })
        : null,
    claim: row.claim_status === null ? null : { status: row.claim_status, deadline: row.claim_deadline, wallet: row.claim_wallet },
    payout: row.payout_tx === null ? null : { tx: row.payout_tx, status: row.payout_status },
  }
}

const PAST_SELECT = `SELECT r.*,
  (SELECT COUNT(*) FROM entries e WHERE e.round_id = r.id AND e.hidden = 0) AS entry_count,
  w.title AS winner_title, w.name AS winner_name, w.image_key AS winner_image,
  p.tx_hash AS payout_tx, p.status AS payout_status
FROM rounds r
LEFT JOIN entries w ON w.id = r.winner_entry_id
LEFT JOIN payouts p ON p.round_id = r.id`

async function livePrize(env: Env, round: number): Promise<bigint> {
  const live = await getMeta<Live>(env.DB, 'live')
  const fees = live?.round === round ? BigInt(live.fees) : 0n
  return fees + BigInt((await getMeta<string>(env.DB, 'pool')) ?? '0')
}

async function liveView(env: Env, round: RoundRow) {
  const anchor = await getMeta<Anchor>(env.DB, 'anchor')
  const prize = await livePrize(env, round.id)
  return {
    round: round.id,
    number: roundNumber(round.id),
    prompt: round.prompt,
    startsAt: round.id * ROUND_MS,
    endsAt: roundEnd(round.id),
    status: 'open',
    open: isLive(env) && anchor !== null && round.id > anchor.round,
    entries: await countEntries(env.DB, round.id),
    prize: { wei: prize.toString(), usd: toUsd(prize, await getMeta<number>(env.DB, 'eth_usd')) },
  }
}

export async function currentView(env: Env, now: number): Promise<Response> {
  const round = await getRound(env.DB, currentRound(now))
  if (!round) throw new HttpError(503, 'The round is starting. Try again in a moment.')
  return json(await liveView(env, round))
}

export async function pastRoundsView(env: Env, url: URL, now: number): Promise<Response> {
  const before = Math.min(Number(url.searchParams.get('before') ?? currentRound(now)), currentRound(now))
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 20), 1), PAGE_MAX)
  if (!Number.isInteger(before) || !Number.isInteger(limit)) throw new HttpError(400, 'Invalid page.')
  const { results } = await env.DB.prepare(`${PAST_SELECT} WHERE r.id < ? AND r.status IN ('closed', 'judged', 'settled') ORDER BY r.id DESC LIMIT ?`)
    .bind(before, limit)
    .all<RoundListRow>()
  return json({ rounds: results.map(pastView) })
}

export async function roundView(env: Env, id: number, now: number): Promise<Response> {
  if (id >= currentRound(now)) {
    const round = await getRound(env.DB, id)
    if (!round || id > currentRound(now)) throw new HttpError(404, 'Round not found.')
    return json(await liveView(env, round))
  }
  const row = await env.DB.prepare(`${PAST_SELECT} WHERE r.id = ? AND r.status IN ('closed', 'judged', 'settled')`).bind(id).first<RoundListRow>()
  if (!row) throw new HttpError(404, 'Round not found.')
  const entries = await visibleEntries(env.DB, id)
  return json({ ...pastView(row), drawings: entries.map(entryView) })
}

export async function imageView(env: Env, key: string, now: number): Promise<Response> {
  const entry = await env.DB.prepare('SELECT round_id, hidden FROM entries WHERE image_key = ?').bind(key).first<{ round_id: number; hidden: number }>()
  if (!entry || entry.hidden || now < roundEnd(entry.round_id)) throw new HttpError(404, 'Image not found.')
  const object = await env.IMAGES.get(key)
  if (!object) throw new HttpError(404, 'Image not found.')
  return new Response(object.body, {
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=31536000, immutable', etag: object.httpEtag },
  })
}
