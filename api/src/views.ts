import { FINAL_ROUNDS, ROUND_MS } from '../../src/config'
import { currentRound, finalEnd, finalNumber, finalOf, finalRounds, finalStart, roundNumber } from '../../src/game/round'
import { FINALS_PAGE_MAX, PAGE_MAX } from './constants'
import { countEntries, getMeta, getRound, visibleEntries, type Anchor, type EntryRow, type FinalRow, type RoundRow } from './db'
import { holds } from './chain'
import { cleanWallet } from './entries'
import { isLive, type Env } from './env'
import { HttpError, json } from './http'
import { firstFinal, roundEnd } from './rounds'

type DrawingFields = Pick<EntryRow, 'id' | 'title' | 'entered' | 'image_key'>

interface RoundListRow extends RoundRow {
  entry_count: number
  winner_title: string | null
  winner_image: string | null
  final_status: string | null
  final_winner: number | null
}

interface FinalListRow extends FinalRow {
  champion_title: string | null
  champion_image: string | null
  champion_wallet: string | null
  champion_round: number | null
  payout_tx: string | null
  payout_status: string | null
}

function imageUrl(key: string): string {
  return `/api/images/${key}`
}

function entryView(entry: DrawingFields) {
  return { id: entry.id, title: entry.title, entered: entry.entered === 1, image: imageUrl(entry.image_key) }
}

function winnerOf(id: number | null, title: string | null, image: string | null) {
  return id !== null && title !== null && image !== null ? entryView({ id, title, entered: 1, image_key: image }) : null
}

function roundStatus(row: Pick<RoundRow, 'status'>): 'judging' | 'done' | 'void' {
  if (row.status === 'judged') return 'done'
  return row.status === 'void' ? 'void' : 'judging'
}

function pastView(row: RoundListRow) {
  const final = finalOf(row.id)
  const settled = row.final_status === 'settled'
  const champion = settled && row.winner_entry_id !== null && row.final_winner === row.winner_entry_id
  return {
    round: row.id,
    number: roundNumber(row.id),
    prompt: row.prompt,
    startsAt: row.id * ROUND_MS,
    endsAt: roundEnd(row.id),
    status: roundStatus(row),
    entries: row.entry_count,
    note: row.judge_note,
    winner: winnerOf(row.winner_entry_id, row.winner_title, row.winner_image),
    final: { final, number: finalNumber(final), endsAt: finalEnd(final), settled, champion },
  }
}

const PAST_SELECT = `SELECT r.*,
  (SELECT COUNT(*) FROM entries e WHERE e.round_id = r.id AND e.hidden = 0) AS entry_count,
  w.title AS winner_title, w.image_key AS winner_image,
  f.status AS final_status, f.winner_entry_id AS final_winner
FROM rounds r
LEFT JOIN entries w ON w.id = r.winner_entry_id
LEFT JOIN finals f ON f.id = r.id / ${FINAL_ROUNDS}`

const FINAL_SELECT = `SELECT f.*,
  c.title AS champion_title, c.image_key AS champion_image, c.wallet AS champion_wallet, c.round_id AS champion_round,
  p.tx_hash AS payout_tx, p.status AS payout_status
FROM finals f
LEFT JOIN entries c ON c.id = f.winner_entry_id
LEFT JOIN payouts p ON p.final_id = f.id`

async function liveView(env: Env, round: RoundRow) {
  const anchor = await getMeta<Anchor>(env.DB, 'anchor')
  const next = await getRound(env.DB, round.id + 1)
  const final = finalOf(round.id)
  return {
    round: round.id,
    number: roundNumber(round.id),
    prompt: round.prompt,
    startsAt: round.id * ROUND_MS,
    endsAt: roundEnd(round.id),
    status: 'open',
    open: isLive(env) && anchor !== null && round.id > anchor.round,
    entries: await countEntries(env.DB, round.id),
    next: next ? { round: next.id, prompt: next.prompt } : null,
    final: { final, number: finalNumber(final), endsAt: finalEnd(final) },
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
  const anchor = await getMeta<Anchor>(env.DB, 'anchor')
  if (!anchor) return json({ rounds: [] })
  const { results } = await env.DB.prepare(`${PAST_SELECT} WHERE r.id < ? AND r.id > ? AND r.status != 'void' ORDER BY r.id DESC LIMIT ?`)
    .bind(before, anchor.round, limit)
    .all<RoundListRow>()
  return json({ rounds: results.map(pastView) })
}

export async function roundView(env: Env, id: number, now: number): Promise<Response> {
  if (id >= currentRound(now)) {
    const round = await getRound(env.DB, id)
    if (!round || id > currentRound(now)) throw new HttpError(404, 'Round not found.')
    return json(await liveView(env, round))
  }
  const anchor = await getMeta<Anchor>(env.DB, 'anchor')
  const row = anchor && (await env.DB.prepare(`${PAST_SELECT} WHERE r.id = ? AND r.id > ? AND r.status != 'void'`).bind(id, anchor.round).first<RoundListRow>())
  if (!row) throw new HttpError(404, 'Round not found.')
  const entries = await visibleEntries(env.DB, id)
  return json({ ...pastView(row), drawings: entries.map(entryView) })
}

function finalRoundView(id: number, row: RoundListRow | undefined, current: number) {
  const base = { round: id, number: roundNumber(id), prompt: row?.prompt ?? null, entries: row?.entry_count ?? 0 }
  if (id > current) return { ...base, prompt: null, status: 'upcoming', winner: null }
  if (id === current) return { ...base, status: 'live', winner: null }
  if (!row) return { ...base, status: 'void', winner: null }
  return { ...base, status: roundStatus(row), winner: winnerOf(row.winner_entry_id, row.winner_title, row.winner_image) }
}

function payoutView(row: FinalListRow) {
  if (row.pay_status === null) return null
  if (row.pay_status === 'unpaid') return { status: 'unpaid', tx: null }
  if (row.payout_status === 'confirmed') return { status: 'paid', tx: row.payout_tx }
  return { status: row.payout_status === 'failed' ? 'failed' : 'sending', tx: row.payout_tx }
}

function finalView(id: number, rounds: RoundListRow[], row: FinalListRow | undefined, now: number) {
  const current = currentRound(now)
  const byId = new Map(rounds.map((round) => [round.id, round]))
  const settled = row?.status === 'settled'
  const champion = settled && row ? winnerOf(row.winner_entry_id, row.champion_title, row.champion_image) : null
  return {
    final: id,
    number: finalNumber(id),
    startsAt: finalStart(id),
    endsAt: finalEnd(id),
    status: now < finalEnd(id) ? 'live' : settled ? 'settled' : 'judging',
    rounds: finalRounds(id).map((round) => finalRoundView(round, byId.get(round), current)),
    note: settled ? row?.judge_note ?? null : null,
    champion:
      champion && row && row.champion_round !== null
        ? { ...champion, round: row.champion_round, roundNumber: roundNumber(row.champion_round), wallet: row.champion_wallet }
        : null,
    payout: settled && row ? payoutView(row) : null,
  }
}

async function finalsBetween(env: Env, low: number, high: number, now: number) {
  const ids = Array.from({ length: high - low + 1 }, (_, index) => high - index)
  const { results: rounds } = await env.DB.prepare(`${PAST_SELECT} WHERE r.id BETWEEN ? AND ? AND r.status != 'void' AND r.id <= ?`)
    .bind(finalRounds(low)[0], finalRounds(high).at(-1), currentRound(now))
    .all<RoundListRow>()
  const { results: finals } = await env.DB.prepare(`${FINAL_SELECT} WHERE f.id BETWEEN ? AND ?`).bind(low, high).all<FinalListRow>()
  return ids.map((id) =>
    finalView(
      id,
      rounds.filter((round) => finalOf(round.id) === id),
      finals.find((final) => final.id === id),
      now,
    ),
  )
}

export async function finalsView(env: Env, url: URL, now: number): Promise<Response> {
  const anchor = await getMeta<Anchor>(env.DB, 'anchor')
  if (!anchor) return json({ finals: [] })
  const current = finalOf(currentRound(now))
  const before = Math.min(Number(url.searchParams.get('before') ?? current + 1), current + 1)
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 5), 1), FINALS_PAGE_MAX)
  if (!Number.isInteger(before) || !Number.isInteger(limit)) throw new HttpError(400, 'Invalid page.')
  const low = Math.max(firstFinal(anchor), before - limit)
  if (low > before - 1) return json({ finals: [] })
  return json({ finals: await finalsBetween(env, low, before - 1, now) })
}

export async function finalDetailView(env: Env, id: number, now: number): Promise<Response> {
  const anchor = await getMeta<Anchor>(env.DB, 'anchor')
  if (!anchor || id < firstFinal(anchor) || id > finalOf(currentRound(now))) throw new HttpError(404, 'Final not found.')
  const [final] = await finalsBetween(env, id, id, now)
  return json(final)
}

export async function walletView(env: Env, value: string): Promise<Response> {
  if (!isLive(env)) throw new HttpError(403, 'Entries open at launch.')
  const wallet = cleanWallet(value)
  return json({ wallet, holds: await holds(env, wallet) })
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

interface ChampionRow extends FinalListRow {
  champion_prompt: string
}

export async function championsView(env: Env, url: URL): Promise<Response> {
  const before = Number(url.searchParams.get('before') ?? Number.MAX_SAFE_INTEGER)
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 12), 1), PAGE_MAX)
  if (!Number.isInteger(before) || !Number.isInteger(limit)) throw new HttpError(400, 'Invalid page.')
  const { results } = await env.DB.prepare(
    `SELECT f.*, c.title AS champion_title, c.image_key AS champion_image, c.wallet AS champion_wallet, c.round_id AS champion_round,
      r.prompt AS champion_prompt, p.tx_hash AS payout_tx, p.status AS payout_status
    FROM finals f
    JOIN entries c ON c.id = f.winner_entry_id AND c.hidden = 0
    JOIN rounds r ON r.id = c.round_id
    LEFT JOIN payouts p ON p.final_id = f.id
    WHERE f.status = 'settled' AND f.pay_status = 'sent' AND f.id < ?
    ORDER BY f.id DESC LIMIT ?`,
  )
    .bind(before, limit)
    .all<ChampionRow>()
  return json({
    champions: results.map((row) => ({
      final: row.id,
      number: finalNumber(row.id),
      endsAt: finalEnd(row.id),
      drawing: entryView({ id: row.winner_entry_id ?? 0, title: row.champion_title ?? '', entered: 1, image_key: row.champion_image ?? '' }),
      round: row.champion_round,
      roundNumber: roundNumber(row.champion_round ?? 0),
      prompt: row.champion_prompt,
      note: row.judge_note,
      payout: payoutView(row),
    })),
  })
}
