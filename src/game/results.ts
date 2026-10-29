import { ApiError } from '../api/client'
import {
  fetchChampions,
  fetchFinal,
  fetchFinals,
  fetchRound,
  fetchRounds,
  type ApiDrawing,
  type ApiFinal,
  type ApiFinalRound,
  type ApiHallEntry,
  type ApiPastRound,
  type ApiPayout,
} from '../api/endpoints'
import { currentRound, finalOf } from './round'

export interface Drawing {
  id: string
  title: string
  entered: boolean
  image: string
}

export interface FinalLink {
  final: number
  number: number
  endsAt: number
  settled: boolean
  champion: boolean
}

export interface RoundResult {
  round: number
  number: number
  prompt: string
  startsAt: number
  status: 'judging' | 'done'
  entries: number
  winner: Drawing | null
  note: string | null
  final: FinalLink
}

export interface RoundDetail extends RoundResult {
  drawings: Drawing[]
}

export type Payout = { state: 'sending'; tx: string | null } | { state: 'paid'; tx: string } | { state: 'failed' } | { state: 'unpaid' }

export interface FinalRound {
  round: number
  number: number
  prompt: string | null
  status: 'upcoming' | 'live' | 'judging' | 'done' | 'void'
  entries: number
  winner: Drawing | null
}

export interface Champion extends Drawing {
  round: number
  roundNumber: number
  wallet: string | null
}

export interface FinalResult {
  final: number
  number: number
  startsAt: number
  endsAt: number
  status: 'live' | 'judging' | 'done'
  rounds: FinalRound[]
  note: string | null
  champion: Champion | null
  payout: Payout | null
}

export interface HallEntry {
  final: number
  number: number
  endsAt: number
  drawing: Drawing
  roundNumber: number
  prompt: string
  note: string | null
  payout: Payout | null
}

function drawing(item: ApiDrawing): Drawing {
  return { ...item, id: String(item.id) }
}

function roundFromApi(round: ApiPastRound): RoundResult {
  const done = round.status === 'done'
  return {
    round: round.round,
    number: round.number,
    prompt: round.prompt,
    startsAt: round.startsAt,
    status: done ? 'done' : 'judging',
    entries: round.entries,
    winner: done && round.winner ? drawing(round.winner) : null,
    note: done ? round.note : null,
    final: round.final,
  }
}

function finalRoundFromApi(round: ApiFinalRound): FinalRound {
  return { ...round, winner: round.winner ? drawing(round.winner) : null }
}

function payout(value: ApiPayout | null): Payout | null {
  if (!value) return null
  if (value.status === 'paid' && value.tx) return { state: 'paid', tx: value.tx }
  if (value.status === 'failed' || value.status === 'unpaid') return { state: value.status }
  return { state: 'sending', tx: value.tx }
}

function finalFromApi(final: ApiFinal): FinalResult {
  const done = final.status === 'settled' && final.endsAt <= Date.now()
  return {
    final: final.final,
    number: final.number,
    startsAt: final.startsAt,
    endsAt: final.endsAt,
    status: done ? 'done' : final.status === 'live' ? 'live' : 'judging',
    rounds: final.rounds.map(finalRoundFromApi),
    note: done ? final.note : null,
    champion: done && final.champion ? { ...drawing(final.champion), round: final.champion.round, roundNumber: final.champion.roundNumber, wallet: final.champion.wallet } : null,
    payout: done ? payout(final.payout) : null,
  }
}

function hallFromApi(entry: ApiHallEntry): HallEntry {
  return {
    final: entry.final,
    number: entry.number,
    endsAt: entry.endsAt,
    drawing: drawing(entry.drawing),
    roundNumber: entry.roundNumber,
    prompt: entry.prompt,
    note: entry.note,
    payout: payout(entry.payout),
  }
}

export function resultKey(result: RoundResult): string {
  return `${result.round}:${result.status}:${result.final.settled}`
}

export function finalKey(result: FinalResult): string {
  return `${result.final}:${result.status}:${result.payout?.state ?? ''}:${result.rounds.map((round) => round.status).join()}`
}

export function hallKey(entry: HallEntry): string {
  return `${entry.final}:${entry.payout?.state ?? ''}`
}

export function roundSettled(result: RoundResult): boolean {
  return result.status === 'done' && result.final.settled
}

export function finalSettled(result: FinalResult): boolean {
  return result.status === 'done' && (result.payout === null || result.payout.state === 'paid' || result.payout.state === 'unpaid')
}

export async function pastRounds(limit: number, before = currentRound()): Promise<RoundResult[]> {
  return (await fetchRounds(before, limit)).map(roundFromApi)
}

export async function roundDetail(round: number): Promise<RoundDetail | null> {
  try {
    const result = await fetchRound(round)
    return result.status === 'open' ? null : { ...roundFromApi(result), drawings: result.drawings.map(drawing) }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export async function recentFinals(limit: number, before = finalOf(currentRound()) + 1): Promise<FinalResult[]> {
  return (await fetchFinals(before, limit)).map(finalFromApi)
}

export async function finalDetail(final: number): Promise<FinalResult | null> {
  try {
    return finalFromApi(await fetchFinal(final))
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export async function hallOfFame(limit: number, before = Number.MAX_SAFE_INTEGER): Promise<HallEntry[]> {
  return (await fetchChampions(before, limit)).map(hallFromApi)
}
