import { PAGE_MAX } from './constants'
import type { Env } from './env'
import { HttpError, json, readJson, sameSecret } from './http'

const PROMPT_STATUSES = ['pending', 'approved', 'rejected', 'used']
const PAYOUT_STATUSES = ['pending', 'confirmed', 'failed']

export function requireAdmin(request: Request, env: Env): void {
  const header = request.headers.get('authorization') ?? ''
  if (!env.ADMIN_TOKEN || !sameSecret(header, `Bearer ${env.ADMIN_TOKEN}`)) throw new HttpError(401, 'Unauthorized.')
}

function status(url: URL, allowed: string[], fallback: string): string {
  const value = url.searchParams.get('status') ?? fallback
  if (!allowed.includes(value)) throw new HttpError(400, `Status must be one of ${allowed.join(', ')}.`)
  return value
}

export async function listPrompts(env: Env, url: URL): Promise<Response> {
  const { results } = await env.DB.prepare('SELECT id, text, status, created_at FROM prompts WHERE status = ? ORDER BY id LIMIT ?')
    .bind(status(url, PROMPT_STATUSES, 'pending'), PAGE_MAX)
    .all()
  return json({ prompts: results })
}

export async function reviewPrompt(request: Request, env: Env, id: number): Promise<Response> {
  const next = (await readJson(request)).status
  if (next !== 'approved' && next !== 'rejected') throw new HttpError(400, 'Status must be approved or rejected.')
  const updated = await env.DB.prepare("UPDATE prompts SET status = ? WHERE id = ? AND status IN ('pending', 'approved', 'rejected')").bind(next, id).run()
  if (updated.meta.changes !== 1) throw new HttpError(404, 'Prompt not found or already used.')
  return json({ id, status: next })
}

export async function hideEntry(request: Request, env: Env, id: number): Promise<Response> {
  const hidden = (await readJson(request)).hidden
  if (typeof hidden !== 'boolean') throw new HttpError(400, 'hidden must be true or false.')
  const updated = await env.DB.prepare('UPDATE entries SET hidden = ? WHERE id = ?').bind(hidden ? 1 : 0, id).run()
  if (updated.meta.changes !== 1) throw new HttpError(404, 'Entry not found.')
  return json({ id, hidden })
}

export async function listPayouts(env: Env, url: URL): Promise<Response> {
  const { results } = await env.DB.prepare('SELECT id, final_id, recipient, amount, tx_hash, status, block FROM payouts WHERE status = ? ORDER BY id DESC LIMIT ?')
    .bind(status(url, PAYOUT_STATUSES, 'failed'), PAGE_MAX)
    .all()
  return json({ payouts: results })
}
