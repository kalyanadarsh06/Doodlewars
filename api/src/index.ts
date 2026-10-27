import { hideEntry, listPayouts, listPrompts, requireAdmin, reviewPrompt } from './admin'
import { checkCode, claimPrize } from './claims'
import { submitEntry } from './entries'
import type { Env } from './env'
import { HttpError, json } from './http'
import { suggestPrompt } from './prompts'
import { tick } from './rounds'
import { currentView, imageView, pastRoundsView, roundView } from './views'

type Handler = (request: Request, env: Env, match: string[], now: number) => Promise<Response>

const admin =
  (handler: Handler): Handler =>
  (request, env, match, now) => {
    requireAdmin(request, env)
    return handler(request, env, match, now)
  }

const ROUTES: [string, RegExp, Handler][] = [
  ['GET', /^\/api\/rounds\/current$/, (_, env, __, now) => currentView(env, now)],
  ['GET', /^\/api\/rounds$/, (request, env, _, now) => pastRoundsView(env, new URL(request.url), now)],
  ['GET', /^\/api\/rounds\/(\d+)$/, (_, env, [id], now) => roundView(env, Number(id), now)],
  ['GET', /^\/api\/images\/(entries\/\d+\/[0-9a-f]{64}\.png)$/, (_, env, [key], now) => imageView(env, key, now)],
  ['POST', /^\/api\/entries$/, (request, env, _, now) => submitEntry(request, env, now)],
  ['POST', /^\/api\/prompts$/, (request, env, _, now) => suggestPrompt(request, env, now)],
  ['POST', /^\/api\/codes$/, (request, env) => checkCode(request, env)],
  ['POST', /^\/api\/claims$/, (request, env, _, now) => claimPrize(request, env, now)],
  ['GET', /^\/api\/admin\/prompts$/, admin((request, env) => listPrompts(env, new URL(request.url)))],
  ['POST', /^\/api\/admin\/prompts\/(\d+)$/, admin((request, env, [id]) => reviewPrompt(request, env, Number(id)))],
  ['POST', /^\/api\/admin\/entries\/(\d+)$/, admin((request, env, [id]) => hideEntry(request, env, Number(id)))],
  ['GET', /^\/api\/admin\/payouts$/, admin((request, env) => listPayouts(env, new URL(request.url)))],
]

async function route(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url)
  const matches = ROUTES.filter(([, pattern]) => pattern.test(pathname))
  if (matches.length === 0) throw new HttpError(404, 'Not found.')
  const found = matches.find(([method]) => method === request.method)
  if (!found) throw new HttpError(405, 'Method not allowed.')
  const [, pattern, handler] = found
  return handler(request, env, pathname.match(pattern)?.slice(1) ?? [], Date.now())
}

export default {
  async fetch(request, env) {
    try {
      return await route(request, env)
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status)
      console.error(error)
      return json({ error: 'Something went wrong.' }, 500)
    }
  },
  async scheduled(controller, env) {
    await tick(env, controller.scheduledTime)
  },
} satisfies ExportedHandler<Env>
