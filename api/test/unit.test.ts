import { describe, expect, it } from 'vitest'
import { ROUND_MS } from '../../src/config'
import { GRACE_MS } from '../src/constants'
import { acceptsEntries, cleanName, cleanTitle, newCode, normalizeCode, pngSize } from '../src/entries'
import { HttpError } from '../src/http'
import { feesBetween, toUsd } from '../src/money'
import { cleanPrompt } from '../src/prompts'
import { whitePng } from './png'

const ETH = 10n ** 18n

describe('money', () => {
  it('counts fees as the balance change plus what was paid out', () => {
    expect(feesBetween(5n * ETH, 4n * ETH, 2n * ETH)).toBe(ETH)
  })

  it('never reports negative fees', () => {
    expect(feesBetween(5n * ETH, 4n * ETH, 0n)).toBe(0n)
  })

  it('converts wei to dollars', () => {
    expect(toUsd(ETH / 2n, 3000)).toBe(1500)
    expect(toUsd(ETH, null)).toBeNull()
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
    expect(() => cleanTitle('')).toThrow(HttpError)
    expect(() => cleanTitle('x'.repeat(23))).toThrow(HttpError)
    expect(() => cleanTitle('Line\u0000break')).toThrow(HttpError)
  })

  it('cleans player names', () => {
    expect(cleanName('  doodle   king ')).toBe('doodle king')
    expect(() => cleanName('x'.repeat(21))).toThrow(HttpError)
  })

  it('makes readable claim codes and accepts them typed loosely', () => {
    const code = newCode()
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
    expect(normalizeCode(code.toLowerCase().replace(/-/g, ' '))).toBe(code.replace(/-/g, ''))
    expect(new Set(Array.from({ length: 200 }, newCode)).size).toBe(200)
    expect(() => normalizeCode('ABCD-EFGH-IJK0')).toThrow(HttpError)
    expect(() => normalizeCode('short')).toThrow(HttpError)
  })
})

describe('prompts', () => {
  it('cleans suggestions', () => {
    expect(cleanPrompt(' a  cat DJ ')).toBe('a cat DJ')
    expect(() => cleanPrompt('no')).toThrow(HttpError)
    expect(() => cleanPrompt('x'.repeat(61))).toThrow(HttpError)
  })
})
