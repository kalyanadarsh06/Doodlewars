import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { privateKeyToAccount } from 'viem/accounts'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { FINAL_ROUNDS, ROUND_MS } from '../../src/config'
import { currentRound, finalEnd, finalOf, finalRounds } from '../../src/game/round'
import { GRACE_MS } from '../src/constants'
import { startFake, type Fake } from './fake'
import { whitePng } from './png'

const PORT = 8797
const FAKE_PORT = 8798
const API = `http://localhost:${PORT}`
const ETH = 10n ** 18n
const TRADE_FEES = 10n * ETH
const TAX_BPS = 70n
const EARNED = 14n * ETH
const OWNER = '0xd7F272e27BDFE358eA77ce18Bd3c39a8282e531a'
const GAS_COST = 21_000n * 1_000_000_000n
const CARRY = 10n ** 15n
const TOKEN = '0x1000000000000000000000000000000000000001'
const ADMIN = 'test-admin-token'
const payout = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')
const alice = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d')
const bob = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a')
const carol = privateKeyToAccount('0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6')

let fake: Fake
let worker: ChildProcess
let state: string
let database: string

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

interface Upload {
  ip: string
  round: number
  name: string
  title: string
  png: Uint8Array
  wallet?: string
  token?: string
}

async function upload(method: string, entry: Upload): Promise<{ status: number; token?: string; wallet?: string; entered?: boolean }> {
  const form = new FormData()
  form.set('round', String(entry.round))
  form.set('title', entry.title)
  form.set('image', new Blob([entry.png], { type: 'image/png' }), 'drawing.png')
  if (entry.wallet !== undefined) form.set('wallet', entry.wallet)
  if (entry.token !== undefined) form.set('token', entry.token)
  const response = await fetch(`${API}/api/entries`, { method, body: form, headers: { 'cf-connecting-ip': entry.ip } })
  const body = (await response.json()) as { token?: string; wallet?: string; entered?: boolean }
  return { status: response.status, token: body.token, wallet: body.wallet, entered: body.entered }
}

const enter = (entry: Upload) => upload('POST', entry)
const update = (entry: Upload) => upload('PUT', entry)

async function postJson(path: string, body: unknown): Promise<{ status: number; body: any }> {
  const response = await fetch(`${API}${path}`, { method: 'POST', body: JSON.stringify(body) })
  return { status: response.status, body: await response.json() }
}

function wrangler(args: string[]): string {
  return execFileSync('npx', ['wrangler', ...args, '--local', '--persist-to', state], { encoding: 'utf8', env: { ...process.env, CI: 'true' } })
}

async function explorer(path: string, init: RequestInit): Promise<any> {
  const response = await fetch(`${API}/cdn-cgi/local/explorer/api${path}`, init)
  const body = (await response.json()) as { success: boolean; errors: unknown[]; result: any }
  if (!body.success) throw new Error(JSON.stringify(body.errors))
  return body.result
}

async function query(sql: string): Promise<Record<string, unknown>[]> {
  const [{ results }] = await explorer(`/d1/database/${database}/raw`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sql }) })
  return results.rows.map((row: unknown[]) => Object.fromEntries(results.columns.map((column: string, index: number) => [column, row[index]])))
}

async function getJson(path: string, headers: Record<string, string> = {}): Promise<{ status: number; body: any }> {
  const response = await fetch(`${API}${path}`, { headers })
  return { status: response.status, body: await response.json() }
}

async function addFinalist(round: number, name: string, wallet: string): Promise<void> {
  const png = whitePng(1200, 900, 42)
  const key = `entries/${round}/${createHash('sha256').update(png).digest('hex')}.png`
  await explorer(`/r2/buckets/doodlewars-images/objects/${encodeURIComponent(key)}`, { method: 'PUT', headers: { 'content-type': 'image/png' }, body: png })
  await query(`INSERT OR REPLACE INTO rounds (id, prompt, status) VALUES (${round}, 'a cat DJ', 'judged')`)
  await query(
    `INSERT INTO entries (round_id, title, wallet, entered, image_key, token_hash, source, created_at) VALUES (${round}, 'Cat DJ ${name}', '${wallet}', 1, '${key}', '${randomBytes(32).toString('hex')}', 'test', 0)`,
  )
  await query(`UPDATE rounds SET winner_entry_id = (SELECT id FROM entries WHERE round_id = ${round}) WHERE id = ${round}`)
}

beforeAll(async () => {
  state = mkdtempSync(join(tmpdir(), 'doodlewars-'))
  fake = await startFake(FAKE_PORT)
  fake.setBalance(payout.address, ETH / 20n)
  fake.hold(alice.address)
  fake.hold(bob.address)
  fake.launch(TOKEN, payout.address, TAX_BPS)
  execFileSync('npm', ['--prefix', '..', 'run', 'build'], { stdio: 'ignore' })
  wrangler(['d1', 'migrations', 'apply', 'doodlewars'])
  const vars = {
    RPC_URL: fake.url,
    TOKEN_ADDRESS: TOKEN,
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
  database = (await explorer('/d1/database', {}))[0].uuid
}, 120_000)

afterAll(async () => {
  worker?.kill()
  await fake?.close()
  rmSync(state, { recursive: true, force: true })
})

it('runs rounds into a Final: wallet entries, judging, rollover, payout and history', async () => {
  if (end(currentRound(Date.now())) - Date.now() < 40_000) await sleep(end(currentRound(Date.now())) - Date.now() + 1000)
  const round = currentRound(Date.now())
  const final = finalOf(round)

  await tick(Date.now())
  fake.accrue(TRADE_FEES)
  await tick(Date.now())
  expect(fake.sweeps).toBe(0)
  const current = await getJson('/api/rounds/current')
  expect(current.body).toMatchObject({ round, open: true, entries: 0, final: { final, endsAt: finalEnd(final) } })
  expect(JSON.stringify(current.body)).not.toMatch(/pot|prize|fees|carry/)

  const alicePng = whitePng(1200, 900, 1)
  const first = await enter({ ip: '10.0.0.1', round, name: 'alice', title: 'Cool Whale', png: alicePng, wallet: alice.address.toLowerCase() })
  expect(first).toMatchObject({ status: 201, wallet: alice.address, entered: true })
  expect(first.token).toMatch(/^[0-9a-f]{48}$/)
  expect((await enter({ ip: '10.0.0.1', round, name: 'alice', title: 'Again', png: whitePng(1200, 900, 2), wallet: bob.address })).status).toBe(409)
  expect((await enter({ ip: '10.0.0.3', round, name: 'alice', title: 'Same wallet', png: whitePng(1200, 900, 3), wallet: alice.address })).status).toBe(409)
  expect((await enter({ ip: '10.0.0.2', round, name: 'bob', title: 'Copycat', png: alicePng, wallet: bob.address })).status).toBe(409)
  expect((await enter({ ip: '10.0.0.2', round, name: 'bob', title: 'Tiny', png: whitePng(600, 450, 4), wallet: bob.address })).status).toBe(400)
  expect((await enter({ ip: '10.0.0.2', round, name: 'bob', title: 'Bad Wallet', png: whitePng(1200, 900, 5), wallet: '0x1234' })).status).toBe(400)
  expect((await enter({ ip: '10.0.0.4', round, name: 'carol', title: 'Not Holding', png: whitePng(1200, 900, 5), wallet: carol.address })).status).toBe(403)
  expect(await enter({ ip: '10.0.0.4', round, name: 'carol', title: 'Just Doodling', png: whitePng(1200, 900, 9), wallet: '' })).toMatchObject({ status: 201, entered: false })
  expect((await enter({ ip: '10.0.0.2', round: round + 1, name: 'bob', title: 'Too Early', png: whitePng(1200, 900, 5), wallet: bob.address })).status).toBe(409)
  const aliceFinal = whitePng(1200, 900, 7)
  expect((await update({ ip: '10.0.0.9', round, name: 'alice', title: '', png: aliceFinal, token: 'f'.repeat(48) })).status).toBe(404)
  expect((await update({ ip: '10.0.0.9', round, name: 'alice', title: '', png: aliceFinal, token: 'not-a-key' })).status).toBe(400)
  expect((await update({ ip: '10.0.0.9', round, name: 'alice', title: '', png: aliceFinal, token: first.token })).status).toBe(200)
  expect(await query(`SELECT title, wallet, entered FROM entries WHERE round_id = ${round} ORDER BY id`)).toEqual([
    { title: '', wallet: alice.address, entered: 1 },
    { title: 'Just Doodling', wallet: null, entered: 0 },
  ])
  const second = await enter({ ip: '10.0.0.2', round, name: 'bob', title: 'Shady Whale', png: whitePng(1200, 900, 6), wallet: bob.address })
  expect(second.status).toBe(201)
  expect((await getJson('/api/rounds/current')).body.entries).toBe(3)

  const liveImage = (await query(`SELECT image_key FROM entries WHERE round_id = ${round} ORDER BY id LIMIT 1`))[0].image_key
  expect((await fetch(`${API}/api/images/${liveImage}`)).status).toBe(404)
  expect((await query(`SELECT token_hash FROM entries WHERE round_id = ${round}`)).every((row) => row.token_hash !== first.token)).toBe(true)

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

  const bobEntry = (await query(`SELECT id FROM entries WHERE round_id = ${round} AND title = 'Shady Whale'`))[0].id
  await query(
    `INSERT INTO finals (id, status, close_block, close_balance, fees, prize, winner_entry_id, pay_status, closed_at) VALUES (${final - 5}, 'settled', 0, '0', '7', '7', ${bobEntry}, 'due', 0)`,
  )
  await query(`INSERT INTO finals (id, status, close_block, close_balance, fees, prize, closed_at) VALUES (${final - 1}, 'settled', 0, '0', '${CARRY}', '${CARRY}', 0)`)
  const extra = round === finalRounds(final)[0] ? round + 1 : round - 1
  if (extra < round) await addFinalist(extra, 'dave', alice.address)
  const aliceBefore = fake.balance(alice.address)

  await tick(end(round) + GRACE_MS + 1000)
  expect(fake.judgeCalls.length).toBeGreaterThanOrEqual(1)
  expect((await update({ ip: '10.0.0.1', round, name: 'alice', title: 'Too Late', png: whitePng(1200, 900, 8), token: first.token })).status).toBe(409)
  const [call] = fake.judgeCalls
  expect(call.body.model).toBe('claude-haiku-5-5')
  expect(call.body.fallbacks).toBeUndefined()
  expect(call.body.messages[0].content.filter((block) => block.type === 'image')).toHaveLength(3)
  expect(call.body.messages[0].content.filter((block) => block.text?.includes(', just for fun'))).toHaveLength(1)
  expect(call.body.messages[0].content.some((block) => block.text?.includes('"Shady Whale"'))).toBe(true)
  expect(await query(`SELECT pay_status FROM finals WHERE id = ${final - 5}`)).toEqual([{ pay_status: 'unpaid' }])
  if (extra > round) await addFinalist(extra, 'dave', alice.address)

  await tick(finalEnd(final) + GRACE_MS + 1000)
  expect(fake.judgeCalls).toHaveLength(2)
  const finalCall = fake.judgeCalls[1]
  expect(finalCall.body.messages[0].content.filter((block) => block.type === 'image')).toHaveLength(2)
  expect(finalCall.body.messages[0].content.some((block) => block.text?.includes('drawn for the prompt "a cat DJ"'))).toBe(true)
  const champion = extra < round ? 'dave' : 'alice'
  expect(fake.sweeps).toBe(1)
  const earned = EARNED - 2n * GAS_COST
  const house = earned / 2n
  const fees = earned - house
  const prize = fees + CARRY
  const sent = prize - 21_000n * 1_200_000_000n
  const houseSent = house - 21_000n * 1_200_000_000n
  expect(fake.balance(alice.address) - aliceBefore).toBe(sent)
  expect(fake.balance(OWNER)).toBe(0n)
  expect(await query(`SELECT status, fees, house, house_status, carry, prize, pay_status FROM finals WHERE id = ${final}`)).toEqual([
    {
      status: 'settled',
      fees: fees.toString(),
      house: house.toString(),
      house_status: 'due',
      carry: CARRY.toString(),
      prize: prize.toString(),
      pay_status: 'sent',
    },
  ])
  const missed = await query(`SELECT status, judge_note FROM rounds WHERE id = ${finalRounds(final).at(-1)}`)
  if (round !== finalRounds(final).at(-1)) expect(missed).toEqual([{ status: 'judged', judge_note: 'Nobody drew this one.' }])

  await tick(finalEnd(final) + GRACE_MS + 62_000)
  await tick(finalEnd(final) + GRACE_MS + 124_000)
  expect(fake.balance(OWNER)).toBe(houseSent)
  expect(await query(`SELECT house_status FROM finals WHERE id = ${final}`)).toEqual([{ house_status: 'sent' }])
  expect(await query(`SELECT final_id, kind, recipient, status, amount, gas FROM payouts ORDER BY id`)).toEqual([
    { final_id: final, kind: 'prize', recipient: alice.address, status: 'confirmed', amount: sent.toString(), gas: GAS_COST.toString() },
    { final_id: final, kind: 'house', recipient: OWNER, status: 'confirmed', amount: houseSent.toString(), gas: GAS_COST.toString() },
  ])
  expect(await query(`SELECT prompt FROM rounds WHERE id = ${round + 2}`)).toEqual([{ prompt: 'a snail in a top hat' }])

  await sleep(Math.max(0, end(round) - Date.now() + 1000))
  const detail = await getJson(`/api/finals/${final}`)
  expect(detail.body).toMatchObject({
    final,
    note: 'Best whale by a mile.',
    champion: { wallet: alice.address, round: extra < round ? extra : round },
    payout: { status: 'paid' },
  })
  expect(detail.body.rounds).toHaveLength(FINAL_ROUNDS)
  expect(JSON.stringify(detail.body)).not.toMatch(/pot|prize|fees|carry|amount/)
  expect(detail.body.rounds.find((item: { round: number }) => item.round === round)).toMatchObject({ status: 'done', entries: 3, winner: { title: '' } })
  const list = await getJson(`/api/finals?before=${final + 1}&limit=1`)
  expect(list.body.finals).toEqual([expect.objectContaining({ final, champion: expect.objectContaining({ round: extra < round ? extra : round }) })])
  const champions = await getJson('/api/champions')
  expect(champions.body.champions).toEqual([
    expect.objectContaining({ final, round: extra < round ? extra : round, prompt: 'a cat DJ', payout: { status: 'paid', tx: expect.stringMatching(/^0x/) } }),
  ])
  expect(JSON.stringify(champions.body)).not.toMatch(/pot|prize|fees|carry|amount|wallet/)

  const past = await getJson(`/api/rounds/${round}`)
  expect(past.body).toMatchObject({
    round,
    status: 'done',
    entries: 3,
    winner: { title: '', entered: true },
    note: 'Best whale by a mile.',
    final: { final, settled: true, champion: champion === 'alice' },
  })
  expect(past.body.drawings.map((drawing: { title: string; entered: boolean }) => [drawing.title, drawing.entered])).toEqual([
    ['', true],
    ['Just Doodling', false],
    ['Shady Whale', true],
  ])
  expect(JSON.stringify(past.body)).not.toMatch(/token|wallet|0x/)
  const image = await fetch(`${API}${past.body.winner.image}`)
  expect(image.status).toBe(200)
  expect(image.headers.get('content-type')).toBe('image/png')
  expect(new Uint8Array(await image.arrayBuffer())).toEqual(aliceFinal)
  const rounds = await getJson(`/api/rounds?before=${round + 1}`)
  expect(rounds.body.rounds[0]).toMatchObject({ round, winner: { title: '' } })

  const fun = await postJson('/api/prompts', { text: 'a penguin on rollerskates' })
  const spam = await postJson('/api/prompts', { text: 'buy my coin at example dot com' })
  await tick(Date.now())
  expect(fake.screenCalls).toHaveLength(1)
  expect(await query(`SELECT id, status FROM prompts WHERE id IN (${fun.body.id}, ${spam.body.id}) ORDER BY id`)).toEqual([
    { id: fun.body.id, status: 'approved' },
    { id: spam.body.id, status: 'rejected' },
  ])
}, 420_000)
