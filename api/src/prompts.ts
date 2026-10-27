import { PROMPT_MAX, PROMPT_MIN, PROMPTS_PER_HOUR } from './constants'
import type { Env } from './env'
import { HttpError, json, readJson, sourceOf } from './http'

const HOUR_MS = 60 * 60 * 1000

export function cleanPrompt(value: unknown): string {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  if (text.length < PROMPT_MIN || text.length > PROMPT_MAX || /\p{C}/u.test(text)) {
    throw new HttpError(400, `Prompts are ${PROMPT_MIN} to ${PROMPT_MAX} characters.`)
  }
  return text
}

export async function suggestPrompt(request: Request, env: Env, now: number): Promise<Response> {
  const text = cleanPrompt((await readJson(request)).text)
  const source = await sourceOf(request, env)
  const recent = await env.DB.prepare('SELECT COUNT(*) AS count FROM prompts WHERE source = ? AND created_at > ?')
    .bind(source, now - HOUR_MS)
    .first<{ count: number }>()
  if ((recent?.count ?? 0) >= PROMPTS_PER_HOUR) throw new HttpError(429, 'That is a lot of ideas. Try again in an hour.')
  const inserted = await env.DB.prepare('INSERT INTO prompts (text, source, created_at) VALUES (?, ?, ?)').bind(text, source, now).run()
  return json({ id: inserted.meta.last_row_id }, 201)
}
