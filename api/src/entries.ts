import { EXPORT_HEIGHT, EXPORT_WIDTH, ROUND_MS, TITLE_MAX } from '../../src/config'
import { currentRound } from '../../src/game/round'
import { CODE_LENGTH, GRACE_MS, MAX_ENTRIES, MAX_IMAGE_BYTES, NAME_MAX } from './constants'
import { countEntries, getMeta, getRound, type Anchor } from './db'
import { isLive, type Env } from './env'
import { HttpError, json, sha256Hex, sourceOf } from './http'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function imageKey(round: number, hash: string): string {
  return `entries/${round}/${hash}.png`
}

export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24 || PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) return null
  if (String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR') return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

function cleanText(value: unknown, max: number, message: string): string {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  if (text.length === 0 || text.length > max || /\p{C}/u.test(text)) throw new HttpError(400, message)
  return text
}

export function cleanTitle(value: unknown): string {
  return cleanText(value, TITLE_MAX, `Give your drawing a title of 1 to ${TITLE_MAX} characters.`)
}

export function cleanName(value: unknown): string {
  return cleanText(value, NAME_MAX, `Pick a name of 1 to ${NAME_MAX} characters.`)
}

export function acceptsEntries(round: number, now: number): boolean {
  const current = currentRound(now)
  return round === current || (round === current - 1 && now < (round + 1) * ROUND_MS + GRACE_MS)
}

export function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  const characters = [...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')
  return characters.match(/.{4}/g)?.join('-') ?? characters
}

export function normalizeCode(value: unknown): string {
  const code = typeof value === 'string' ? value.toUpperCase().replace(/[^A-Z0-9]/g, '') : ''
  if (code.length !== CODE_LENGTH || [...code].some((character) => !CODE_ALPHABET.includes(character))) {
    throw new HttpError(400, 'That code does not look right.')
  }
  return code
}

export function codeHash(code: unknown): Promise<string> {
  return sha256Hex(normalizeCode(code))
}

export async function submitEntry(request: Request, env: Env, now: number): Promise<Response> {
  const anchor = await getMeta<Anchor>(env.DB, 'anchor')
  if (!isLive(env) || !anchor) throw new HttpError(403, 'Entries open at launch.')
  const form = await request.formData().catch(() => {
    throw new HttpError(400, 'Expected a form upload.')
  })
  const round = Number(form.get('round'))
  const title = cleanTitle(form.get('title'))
  const name = cleanName(form.get('name'))
  const image = form.get('image')
  if (!Number.isInteger(round) || round <= anchor.round || !acceptsEntries(round, now)) throw new HttpError(409, 'This round is closed.')
  if (!(image instanceof File) || image.size > MAX_IMAGE_BYTES) throw new HttpError(400, 'The drawing must be a PNG under 2 MB.')
  const bytes = new Uint8Array(await image.arrayBuffer())
  const size = pngSize(bytes)
  if (!size || size.width !== EXPORT_WIDTH || size.height !== EXPORT_HEIGHT) {
    throw new HttpError(400, `The drawing must be a ${EXPORT_WIDTH}×${EXPORT_HEIGHT} PNG.`)
  }
  const key = imageKey(round, await sha256Hex(bytes))
  const source = await sourceOf(request, env)
  const existing = await env.DB.prepare('SELECT 1 FROM entries WHERE (round_id = ? AND source = ?) OR image_key = ?').bind(round, source, key).first()
  if (existing) throw new HttpError(409, 'You already entered this round.')
  if ((await countEntries(env.DB, round)) >= MAX_ENTRIES) throw new HttpError(409, 'This round is full. Catch the next one.')
  await env.IMAGES.put(key, bytes, { httpMetadata: { contentType: 'image/png' } })
  const code = newCode()
  const inserted = await env.DB.prepare(
    "INSERT OR IGNORE INTO entries (round_id, title, name, image_key, code_hash, source, created_at) SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM rounds WHERE id = ? AND status = 'open')",
  )
    .bind(round, title, name, key, await codeHash(code), source, now, round)
    .run()
  if (inserted.meta.changes !== 1) {
    const status = (await getRound(env.DB, round))?.status
    throw new HttpError(409, status === 'open' ? 'You already entered this round.' : 'This round is closed.')
  }
  return json({ id: inserted.meta.last_row_id, code }, 201)
}
