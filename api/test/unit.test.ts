import { describe, expect, it } from 'vitest'
import { FINAL_MS, FINAL_ROUNDS, ROUND_MS } from '../../src/config'
import { finalEnd, finalOf, finalRounds } from '../../src/game/round'
import { GRACE_MS, TOKEN_BYTES } from '../src/constants'
import type { FinalRow } from '../src/db'
import { acceptsEntries, cleanTitle, cleanWallet, newToken, optionalWallet, pngSize, tokenHash } from '../src/entries'
import { HttpError } from '../src/http'
import { feesBetween } from '../src/money'
import { cleanPrompt } from '../src/prompts'
import { carryFrom } from '../src/rounds'
import { whitePng } from './png'

const ETH = 10n ** 18n

function settled(fields: Partial<FinalRow>): FinalRow {
  return {
    id: 1,
    status: 'settled',
    close_block: 1,
    close_balance: '0',
    fees: '0',
    carry: '0',
    prize: '0',
    winner_entry_id: null,
    judge_note: null,
    pay_status: null,
    closed_at: 0,
    settled_at: 0,
    ...fields,
  }
}

describe('money', () => {
  it('counts fees as the balance change plus what was paid out', () => {
    expect(feesBetween(5n * ETH, 4n * ETH, 2n * ETH)).toBe(ETH)
  })

  it('never reports negative fees', () => {
    expect(feesBetween(5n * ETH, 4n * ETH, 0n)).toBe(0n)
  })
})

describe('finals', () => {
  it('groups six rounds into each half-hour Final', () => {
    expect(FINAL_MS).toBe(30 * 60 * 1000)
    expect(finalRounds(10)).toEqual([60, 61, 62, 63, 64, 65])
    expect(finalOf(65)).toBe(10)
    expect(finalOf(66)).toBe(11)
    expect(finalEnd(10)).toBe(66 * ROUND_MS)
    expect(finalRounds(10)).toHaveLength(FINAL_ROUNDS)
  })

  it('rolls a prize over only when the previous Final had no champion', () => {
    expect(carryFrom(settled({ prize: '500' }))).toBe(500n)
    expect(carryFrom(settled({ prize: '500', winner_entry_id: 3 }))).toBe(0n)
    expect(carryFrom(settled({ prize: '500', status: 'closed' }))).toBe(0n)
    expect(carryFrom(null)).toBe(0n)
  })
})

describe('entries', () => {
  it('reads the size of a png', () => {
    expect(pngSize(whitePng(1200, 900))).toEqual({ width: 1200, height: 900 })
    expect(pngSize(new TextEncoder().encode('not a png at all, really'))).toBeNull()
  })

  it('accepts entries during the round and a short grace after it', () => {
    const round = 1000
    const start = round * ROUND_MS
    expect(acceptsEntries(round, start + 1000)).toBe(true)
    expect(acceptsEntries(round, start + ROUND_MS + GRACE_MS - 1)).toBe(true)
    expect(acceptsEntries(round, start + ROUND_MS + GRACE_MS)).toBe(false)
    expect(acceptsEntries(round + 1, start + 1000)).toBe(false)
  })

  it('cleans titles', () => {
    expect(cleanTitle('  Soggy   Toast ')).toBe('Soggy Toast')
    expect(cleanTitle('')).toBe('')
    expect(cleanTitle(null)).toBe('')
    expect(() => cleanTitle('x'.repeat(23))).toThrow(HttpError)
    expect(() => cleanTitle('Line\u0000break')).toThrow(HttpError)
  })

  it('treats a blank wallet as just for fun', () => {
    expect(optionalWallet('')).toBeNull()
    expect(optionalWallet('   ')).toBeNull()
    expect(optionalWallet(null)).toBeNull()
    expect(optionalWallet('0x70997970c51812dc3a010c7d01b50e0d17dc79c8')).toBe('0x70997970C51812dc3A010C7d01b50e0d17dc79C8')
    expect(() => optionalWallet('0x1234')).toThrow(HttpError)
  })

  it('checksums wallets and rejects anything else', () => {
    expect(cleanWallet(' 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 ')).toBe('0x70997970C51812dc3A010C7d01b50e0d17dc79C8')
    expect(() => cleanWallet('0x1234')).toThrow(HttpError)
    expect(() => cleanWallet(undefined)).toThrow(HttpError)
  })

  it('makes unguessable entry keys', async () => {
    const token = newToken()
    expect(token).toMatch(new RegExp(`^[0-9a-f]{${TOKEN_BYTES * 2}}$`))
    expect(new Set(Array.from({ length: 200 }, newToken)).size).toBe(200)
    expect(await tokenHash(token.toUpperCase())).toBe(await tokenHash(token))
    await expect(tokenHash('short')).rejects.toThrow(HttpError)
  })
})

describe('prompts', () => {
  it('cleans suggestions', () => {
    expect(cleanPrompt(' a  cat DJ ')).toBe('a cat DJ')
    expect(() => cleanPrompt('no')).toThrow(HttpError)
    expect(() => cleanPrompt('x'.repeat(61))).toThrow(HttpError)
  })
})
