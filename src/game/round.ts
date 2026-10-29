import { FINAL_ROUNDS, GENESIS_MS, ROUND_MS } from '../config'
import { PROMPTS } from '../content/themes'
import { seeded } from '../util/random'

const FIRST_ROUND = Math.floor(GENESIS_MS / ROUND_MS)
export const ROUND_OFFSET = FIRST_ROUND % FINAL_ROUNDS

export function currentRound(now = Date.now()): number {
  return Math.floor(now / ROUND_MS)
}

export function msLeft(round: number, now = Date.now()): number {
  return Math.max(0, (round + 1) * ROUND_MS - now)
}

export function roundNumber(round: number): number {
  return round - FIRST_ROUND + 1
}

export function roundAt(number: number): number {
  return number + FIRST_ROUND - 1
}

export function finalOf(round: number): number {
  return Math.floor((round - ROUND_OFFSET) / FINAL_ROUNDS)
}

const FIRST_FINAL = finalOf(FIRST_ROUND)

export function finalRounds(final: number): number[] {
  return Array.from({ length: FINAL_ROUNDS }, (_, index) => final * FINAL_ROUNDS + ROUND_OFFSET + index)
}

export function finalStart(final: number): number {
  return (final * FINAL_ROUNDS + ROUND_OFFSET) * ROUND_MS
}

export function finalEnd(final: number): number {
  return finalStart(final + 1)
}

export function finalNumber(final: number): number {
  return final - FIRST_FINAL + 1
}

export function finalAt(number: number): number {
  return number + FIRST_FINAL - 1
}

function promptIndex(round: number): number {
  return Math.floor(seeded(Math.imul(round, 2654435761))() * PROMPTS.length)
}

export function promptFor(round: number): string {
  const index = promptIndex(round)
  return PROMPTS[index === promptIndex(round - 1) ? (index + 1) % PROMPTS.length : index]
}
