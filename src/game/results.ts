import { ROUND_MS, WINNER_SHARE } from '../config'
import { DOODLES } from '../content/doodles'
import { pick, seeded, shuffle } from '../util/random'
import { currentRound, promptFor, roundNumber } from './round'

export interface Entry {
  id: string
  title: string
  svg: string
  wallet: string | null
}

export interface RoundResult {
  round: number
  number: number
  prompt: string
  startsAt: number
  live: boolean
  entries: Entry[]
  winner: Entry | null
  feesUsd: number | null
  prizeUsd: number | null
  example: boolean
}

type Outcome = Pick<RoundResult, 'entries' | 'winner' | 'feesUsd'>

function exampleRound(round: number): Outcome & { feesUsd: number } {
  const rng = seeded(Math.imul(round, 2246822519))
  const count = Math.floor(rng() * (DOODLES.length + 1))
  const entries = shuffle(rng, DOODLES)
    .slice(0, count)
    .map((doodle, index) => ({ id: `${round}-${index}`, title: doodle.title, svg: doodle.svg, wallet: null }))
  const winner = entries.length ? pick(rng, entries) : null
  const feesUsd = Math.round((25 + rng() ** 2 * 900) * 100) / 100
  return { entries, winner, feesUsd }
}

function winnerShare(feesUsd: number | null): number | null {
  return feesUsd === null ? null : Math.round(feesUsd * WINNER_SHARE) / 100
}

export function roundResult(round: number, now = Date.now()): RoundResult {
  const live = round >= currentRound(now)
  const outcome: Outcome = live ? { entries: [], winner: null, feesUsd: null } : exampleRound(round)
  return {
    round,
    number: roundNumber(round),
    prompt: promptFor(round),
    startsAt: round * ROUND_MS,
    live,
    ...outcome,
    prizeUsd: winnerShare(outcome.feesUsd),
    example: true,
  }
}

export function livePrizeUsd(round: number, now = Date.now()): number {
  const progress = Math.min(1, Math.max(0, (now - round * ROUND_MS) / ROUND_MS))
  return Math.round(exampleRound(round).feesUsd * progress * WINNER_SHARE) / 100
}

export function pastRounds(count: number, before: number): RoundResult[] {
  return Array.from({ length: count }, (_, index) => roundResult(before - 1 - index)).filter((result) => result.number >= 1)
}
