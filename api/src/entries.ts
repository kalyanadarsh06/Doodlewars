import { getAddress, isAddress, type Address } from 'viem'
import { EXPORT_HEIGHT, EXPORT_WIDTH, ROUND_MS, TICKER, TITLE_MAX } from '../../src/config'
import { currentRound } from '../../src/game/round'
import { holds } from './chain'
import { GRACE_MS, MAX_ENTRIES, MAX_IMAGE_BYTES, TOKEN_BYTES } from './constants'
import { countEntries, getMeta, getRound, type Anchor } from './db'
import { isLive, type Env } from './env'
import { HttpError, json, sha256Hex, sourceOf } from './http'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

export function imageKey(round: number, hash: string): string {
  return `entries/${round}/${hash}.png`
}

export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24 || PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) return null
  if (String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR') return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

function cleanText(value: unknown, min: number, max: number, message: string): string {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  if (text.length < min || text.length > max || /\p{C}/u.test(text)) throw new HttpError(400, message)
  return text
}

export function cleanTitle(value: unknown): string {
  return cleanText(value, 0, TITLE_MAX, `Titles can be up to ${TITLE_MAX} characters.`)
}

export function cleanWallet(value: unknown): Address {
  const wallet = typeof value === 'string' ? value.trim() : ''
  if (!isAddress(wallet, { strict: false })) throw new HttpError(400, 'Enter a valid wallet address.')
  return getAddress(wallet)
}

export function optionalWallet(value: unknown): Address | null {
  return typeof value === 'string' && value.trim() !== '' ? cleanWallet(value) : null
}

export function acceptsEntries(round: number, now: number): boolean {
  const current = currentRound(now)
  return round === current || (round === current - 1 && now < (round + 1) * ROUND_MS + GRACE_MS)
}

export function newToken(): string {
  return [...crypto.getRandomValues(new Uint8Array(TOKEN_BYTES))].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function tokenHash(value: unknown): Promise<string> {
  const token = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!new RegExp(`^[0-9a-f]{${TOKEN_BYTES * 2}}$`).test(token)) throw new HttpError(400, 'That entry key does not look right.')
  return sha256Hex(token)
}

interface EntryUpload {
  form: FormData
  round: number
  title: string
  bytes: Uint8Array
  key: string
}

async function readEntry(request: Request, env: Env, now: number): Promise<EntryUpload> {
  const anchor = await getMeta<Anchor>(env.DB, 'anchor')
  if (!isLive(env) || !anchor) throw new HttpError(403, 'Entries open at launch.')
  const form = await request.formData().catch(() => {
    throw new HttpError(400, 'Expected a form upload.')
  })
  const round = Number(form.get('round'))
  const title = cleanTitle(form.get('title'))
  const image = form.get('image')
  if (!Number.isInteger(round) || round <= anchor.round || !acceptsEntries(round, now)) throw new HttpError(409, 'This round is closed.')
  if (!(image instanceof File) || image.size > MAX_IMAGE_BYTES) throw new HttpError(400, 'The drawing must be a PNG under 2 MB.')
  const bytes = new Uint8Array(await image.arrayBuffer())
  const size = pngSize(bytes)
  if (!size || size.width !== EXPORT_WIDTH || size.height !== EXPORT_HEIGHT) {
    throw new HttpError(400, `The drawing must be a ${EXPORT_WIDTH}×${EXPORT_HEIGHT} PNG.`)
  }
  return { form, round, title, bytes, key: imageKey(round, await sha256Hex(bytes)) }
}

function storeImage(env: Env, key: string, bytes: Uint8Array): Promise<unknown> {
  return env.IMAGES.put(key, bytes, { httpMetadata: { contentType: 'image/png' } })
}

export async function submitEntry(request: Request, env: Env, now: number): Promise<Response> {
  const { form, round, title, bytes, key } = await readEntry(request, env, now)
  const wallet = optionalWallet(form.get('wallet'))
  const source = await sourceOf(request, env)
  const existing = await env.DB.prepare('SELECT 1 FROM entries WHERE round_id = ? AND (source = ? OR wallet = ?)').bind(round, source, wallet).first()
  if (existing) throw new HttpError(409, 'You already sent a drawing this round.')
  if (await env.DB.prepare('SELECT 1 FROM entries WHERE image_key = ?').bind(key).first()) throw new HttpError(409, 'That drawing was already sent.')
  if ((await countEntries(env.DB, round)) >= MAX_ENTRIES) throw new HttpError(409, 'This round is full. Catch the next one.')
  if (wallet && !(await holds(env, wallet))) throw new HttpError(403, `This wallet doesn’t hold ${TICKER}. Buy some to compete, or send it just for fun.`)
  await storeImage(env, key, bytes)
  const token = newToken()
  const inserted = await env.DB.prepare(
    "INSERT OR IGNORE INTO entries (round_id, title, wallet, entered, image_key, token_hash, source, created_at) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM rounds WHERE id = ? AND status = 'open')",
  )
    .bind(round, title, wallet, wallet ? 1 : 0, key, await tokenHash(token), source, now, round)
    .run()
  if (inserted.meta.changes !== 1) {
    await env.IMAGES.delete(key)
    const status = (await getRound(env.DB, round))?.status
    throw new HttpError(409, status === 'open' ? 'You already sent a drawing this round.' : 'This round is closed.')
  }
  return json({ id: inserted.meta.last_row_id, token, wallet, entered: wallet !== null }, 201)
}

export async function updateEntry(request: Request, env: Env, now: number): Promise<Response> {
  const { form, round, title, bytes, key } = await readEntry(request, env, now)
  const entry = await env.DB.prepare('SELECT id, image_key FROM entries WHERE token_hash = ? AND round_id = ?')
    .bind(await tokenHash(form.get('token')), round)
    .first<{ id: number; image_key: string }>()
  if (!entry) throw new HttpError(404, 'We could not find your entry for this round.')
  const replaced = entry.image_key !== key
  if (replaced) {
    if (await env.DB.prepare('SELECT 1 FROM entries WHERE image_key = ?').bind(key).first()) throw new HttpError(409, 'That drawing was already sent.')
    await storeImage(env, key, bytes)
  }
  const updated = await env.DB.prepare(
    "UPDATE entries SET title = ?, image_key = ? WHERE id = ? AND EXISTS (SELECT 1 FROM rounds WHERE id = ? AND status = 'open')",
  )
    .bind(title, key, entry.id, round)
    .run()
  if (updated.meta.changes !== 1) {
    if (replaced) await env.IMAGES.delete(key)
    throw new HttpError(409, 'This round is closed.')
  }
  if (replaced) await env.IMAGES.delete(entry.image_key)
  return json({ id: entry.id })
}
