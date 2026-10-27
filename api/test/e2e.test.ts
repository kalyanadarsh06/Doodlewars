import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { privateKeyToAccount } from 'viem/accounts'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { ROUND_MS } from '../../src/config'
import { currentRound } from '../../src/game/round'
import { GRACE_MS } from '../src/constants'
import { startFake, type Fake } from './fake'
import { whitePng } from './png'

const PORT = 8797
const FAKE_PORT = 8798
const API = `http://localhost:${PORT}`
const ETH = 10n ** 18n
const TOKEN = '0x1000000000000000000000000000000000000001'
const ADMIN = 'test-admin-token'
const payout = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')
const alice = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d')
const bob = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a')
const carol = privateKeyToAccount('0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6')

let fake: Fake
let worker: ChildProcess
let state: string

const end = (round: number): number => (round + 1) * ROUND_MS

async function waitFor(check: () => Promise<boolean>, timeout: number): Promise<void> {
  const deadline = Date.now() + timeout
  while (!(await check().catch(() => false))) {
    if (Date.now() > deadline) throw new Error('Timed out waiting.')
    await sleep(500)
  }
}

async function tick(time: number): Promise<void> {
  const response = await fetch(`${API}/cdn-cgi/handler/scheduled?time=${time}`)
  expect(await response.text()).toBe('ok')
}

async function enter(ip: string, round: number, name: string, title: string, png: Uint8Array): Promise<{ status: number; code?: string }> {
  const form = new FormData()
  form.set('round', String(round))
  form.set('name', name)
  form.set('title', title)
  form.set('image', new Blob([png], { type: 'image/png' }), 'drawing.png')
  const response = await fetch(`${API}/api/entries`, { method: 'POST', body: form, headers: { 'cf-connecting-ip': ip } })
  const body = (await response.json()) as { code?: string }
  return { status: response.status, code: body.code }
}

async function postJson(path: string, body: unknown): Promise<{ status: number; body: any }> {
  const response = await fetch(`${API}${path}`, { method: 'POST', body: JSON.stringify(body) })
  return { status: response.status, body: await response.json() }
}

function query(sql: string): Record<string, unknown>[] {
  const output = execFileSync('npx', ['wrangler', 'd1', 'execute', 'doodlewars', '--local', '--persist-to', state, '--json', '--command', sql], {
    encoding: 'utf8',
  })
  return JSON.parse(output)[0].results
}

async function getJson(path: string, headers: Record<string, string> = {}): Promise<{ status: number; body: any }> {
  const response = await fetch(`${API}${path}`, { headers })
  return { status: response.status, body: await response.json() }
}

beforeAll(async () => {
  state = mkdtempSync(join(tmpdir(), 'doodlewars-'))
  fake = await startFake(FAKE_PORT)
  fake.setBalance(payout.address, ETH / 20n)
  fake.hold(alice.address)
  fake.hold(bob.address)
  execFileSync('npm', ['--prefix', '..', 'run', 'build'], { stdio: 'ignore' })
  execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'doodlewars', '--local', '--persist-to', state], {
    stdio: 'ignore',
    env: { ...process.env, CI: 'true' },
  })
  const vars = {
    RPC_URL: fake.url,
    TOKEN_ADDRESS: TOKEN,
    PRICE_URL: `${fake.url}/price`,
    PAYOUT_PRIVATE_KEY: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    ANTHROPIC_API_KEY: 'test-key',
    ANTHROPIC_BASE_URL: fake.url,
    ADMIN_TOKEN: ADMIN,
    IP_SALT: 'test-salt',
  }
  worker = spawn(
    'npx',
    ['wrangler', 'dev', '--port', String(PORT), '--persist-to', state, '--test-scheduled', ...Object.entries(vars).flatMap(([key, value]) => ['--var', `${key}:${value}`])],
    { stdio: 'ignore', env: { ...process.env, CI: 'true' } },
  )
  await waitFor(async () => (await fetch(`${API}/api/rounds`)).ok, 60_000)
}, 120_000)

afterAll(async () => {
  worker?.kill()
  await fake?.close()
  rmSync(state, { recursive: true, force: true })
})

it('runs a full round: entries, judging, claims, payouts and history', async () => {
  if (end(currentRound(Date.now())) - Date.now() < 40_000) await sleep(end(currentRound(Date.now())) - Date.now() + 1000)
  const round = currentRound(Date.now())

  await tick(Date.now())
  fake.addBalance(payout.address, ETH)
  await tick(Date.now())
  const current = await getJson('/api/rounds/current')
  expect(current.body).toMatchObject({ round, open: true, entries: 0, prize: { wei: ETH.toString(), usd: 3000 } })

  const alicePng = whitePng(1200, 900, 1)
  const first = await enter('10.0.0.1', round, 'alice', 'Cool Whale', alicePng)
  expect(first.status).toBe(201)
  expect(first.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
  expect((await enter('10.0.0.1', round, 'alice', 'Second Try', whitePng(1200, 900, 2))).status).toBe(409)
  expect((await enter('10.0.0.2', round, 'bob', 'Copycat', alicePng)).status).toBe(409)
  expect((await enter('10.0.0.2', round, 'bob', 'Tiny', whitePng(600, 450, 3))).status).toBe(400)
  expect((await enter('10.0.0.2', round, '', 'No Name', whitePng(1200, 900, 4))).status).toBe(400)
  expect((await enter('10.0.0.2', round + 1, 'bob', 'Too Early', whitePng(1200, 900, 5))).status).toBe(409)
  const second = await enter('10.0.0.2', round, 'bob', 'Shady Whale', whitePng(1200, 900, 6))
  expect(second.status).toBe(201)
  expect((await getJson('/api/rounds/current')).body.entries).toBe(2)
  expect((await postJson('/api/codes', { code: first.code })).body).toMatchObject({ round, status: 'judging', prize: null })

  const liveImage = query(`SELECT image_key FROM entries WHERE round_id = ${round} ORDER BY id LIMIT 1`)[0].image_key
  expect((await fetch(`${API}/api/images/${liveImage}`)).status).toBe(404)
  expect(query(`SELECT code_hash FROM entries WHERE round_id = ${round}`).every((row) => row.code_hash !== first.code)).toBe(true)

  const suggestion = await postJson('/api/prompts', { text: ' a snail  in a top hat ' })
  expect(suggestion.status).toBe(201)
  expect((await getJson('/api/admin/prompts')).status).toBe(401)
  const pending = await getJson('/api/admin/prompts', { authorization: `Bearer ${ADMIN}` })
  expect(pending.body.prompts).toEqual([expect.objectContaining({ id: suggestion.body.id, text: 'a snail in a top hat', status: 'pending' })])
  const approve = await fetch(`${API}/api/admin/prompts/${suggestion.body.id}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${ADMIN}` },
    body: JSON.stringify({ status: 'approved' }),
  })
  expect(approve.status).toBe(200)

  await tick(end(round) + GRACE_MS + 1000)
  expect(fake.judgeCalls).toHaveLength(1)
  const [call] = fake.judgeCalls
  expect(call.body.model).toBe('claude-opus-5-5')
  expect(call.body.fallbacks).toBe('default')
  expect(call.beta).toContain('server-side-fallback-2026-07-01')
  expect(call.body.messages[0].content.filter((block) => block.type === 'image')).toHaveLength(2)
  expect(call.body.messages[0].content.some((block) => block.text?.includes('by "alice"'))).toBe(true)

  expect((await postJson('/api/codes', { code: second.code })).body).toMatchObject({ status: 'lost', prize: null })
  const won = await postJson('/api/codes', { code: first.code?.toLowerCase() })
  expect(won.body).toMatchObject({ status: 'open', prize: { wei: ETH.toString(), usd: 3000 } })
  expect(won.body.deadline).toBeGreaterThan(end(round))

  expect((await postJson('/api/claims', { code: second.code, wallet: bob.address })).status).toBe(409)
  expect((await postJson('/api/claims', { code: first.code, wallet: carol.address })).status).toBe(403)
  expect((await postJson('/api/claims', { code: first.code, wallet: 'not-a-wallet' })).status).toBe(400)
  expect((await postJson('/api/claims', { code: 'AAAA-BBBB-CCCC', wallet: alice.address })).status).toBe(404)
  const claimed = await postJson('/api/claims', { code: first.code, wallet: alice.address.toLowerCase() })
  expect(claimed).toMatchObject({ status: 200, body: { status: 'claimed', wallet: alice.address } })
  expect((await postJson('/api/claims', { code: first.code, wallet: bob.address })).status).toBe(409)

  const aliceBefore = fake.balance(alice.address)
  await tick(end(round) + GRACE_MS + 62_000)
  expect(fake.balance(alice.address) - aliceBefore).toBe(ETH)
  await tick(end(round) + GRACE_MS + 124_000)
  expect(query('SELECT status, amount FROM payouts')).toEqual([{ status: 'confirmed', amount: ETH.toString() }])
  expect((await postJson('/api/codes', { code: first.code })).body).toMatchObject({ status: 'claimed', wallet: alice.address })

  query(
    `INSERT INTO rounds (id, prompt, status, prize, winner_entry_id, claim_status, claim_deadline) VALUES (${round - 10}, 'old', 'settled', '7', 1, 'open', 1)`,
  )
  await tick(end(round + 1) + GRACE_MS + 1000)
  expect(query(`SELECT claim_status FROM rounds WHERE id = ${round - 10}`)).toEqual([{ claim_status: 'expired' }])
  const rows = query(`SELECT id, status, fees, prize, claim_status, judge_note FROM rounds WHERE id IN (${round}, ${round + 1}) ORDER BY id`)
  expect(rows).toEqual([
    expect.objectContaining({ id: round, status: 'settled', fees: ETH.toString(), prize: ETH.toString(), claim_status: 'claimed' }),
    expect.objectContaining({ id: round + 1, status: 'settled', fees: '0', prize: '7', claim_status: null, judge_note: 'Nobody drew this one.' }),
  ])
  expect(query("SELECT value FROM meta WHERE key = 'pool'")).toEqual([{ value: '"7"' }])
  expect(query(`SELECT prompt FROM rounds WHERE id = ${round + 2}`)).toEqual([{ prompt: 'a snail in a top hat' }])

  await sleep(Math.max(0, end(round) - Date.now() + 1000))
  const past = await getJson(`/api/rounds/${round}`)
  expect(past.body).toMatchObject({
    round,
    status: 'settled',
    entries: 2,
    prize: { wei: ETH.toString(), usd: 3000 },
    winner: { title: 'Cool Whale', name: 'alice' },
    claim: { status: 'claimed', wallet: alice.address },
    payout: { status: 'confirmed' },
    note: 'Best whale by a mile.',
  })
  expect(past.body.drawings.map((drawing: { name: string }) => drawing.name)).toEqual(['alice', 'bob'])
  expect(JSON.stringify(past.body)).not.toContain('code')
  const image = await fetch(`${API}${past.body.winner.image}`)
  expect(image.status).toBe(200)
  expect(image.headers.get('content-type')).toBe('image/png')
  expect(new Uint8Array(await image.arrayBuffer())).toEqual(alicePng)
  const list = await getJson(`/api/rounds?before=${round + 1}`)
  expect(list.body.rounds[0]).toMatchObject({ round, winner: { name: 'alice' } })
}, 420_000)
