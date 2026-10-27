import { GENESIS_MS, ROUND_MS } from '../config'
import { THESES } from '../content/themes'
import { seeded } from '../util/random'

export function currentRound(now = Date.now()): number {
  return Math.floor(now / ROUND_MS)
}

export function msLeft(round: number, now = Date.now()): number {
  return Math.max(0, (round + 1) * ROUND_MS - now)
}

export function roundNumber(round: number): number {
  return round - Math.floor(GENESIS_MS / ROUND_MS) + 1
}

function promptIndex(round: number): number {
  return Math.floor(seeded(Math.imul(round, 2654435761))() * THESES.length)
}

export function promptFor(round: number): string {
  const index = promptIndex(round)
  return THESES[index === promptIndex(round - 1) ? (index + 1) % THESES.length : index]
}
