import { getJson, postForm, postJson } from './client'

export interface ApiDrawing {
  id: number
  title: string
  entered: boolean
  image: string
}

export interface ApiLiveRound {
  round: number
  number: number
  prompt: string
  startsAt: number
  endsAt: number
  status: 'open'
  open: boolean
  entries: number
  next: { round: number; prompt: string } | null
  final: { final: number; number: number; endsAt: number }
}

export interface ApiPastRound {
  round: number
  number: number
  prompt: string
  startsAt: number
  endsAt: number
  status: 'judging' | 'done'
  entries: number
  note: string | null
  winner: ApiDrawing | null
  final: { final: number; number: number; endsAt: number; settled: boolean; champion: boolean }
}

export interface ApiRoundDetail extends ApiPastRound {
  drawings: ApiDrawing[]
}

export interface ApiFinalRound {
  round: number
  number: number
  prompt: string | null
  status: 'upcoming' | 'live' | 'judging' | 'done' | 'void'
  entries: number
  winner: ApiDrawing | null
}

export interface ApiChampion extends ApiDrawing {
  round: number
  roundNumber: number
  wallet: string
}

export interface ApiFinal {
  final: number
  number: number
  startsAt: number
  endsAt: number
  status: 'live' | 'judging' | 'settled'
  rounds: ApiFinalRound[]
  note: string | null
  champion: ApiChampion | null
  payout: ApiPayout | null
}

export type ApiPayout = { status: 'sending' | 'paid' | 'failed' | 'unpaid'; tx: string | null }

export interface ApiHallEntry {
  final: number
  number: number
  endsAt: number
  drawing: ApiDrawing
  round: number
  roundNumber: number
  prompt: string
  note: string | null
  payout: ApiPayout | null
}

export interface NewEntry {
  round: number
  title: string
  image: Blob
}

export function fetchCurrentRound(signal?: AbortSignal): Promise<ApiLiveRound> {
  return getJson('/rounds/current', signal)
}

export async function fetchRounds(before: number, limit: number): Promise<ApiPastRound[]> {
  const query = new URLSearchParams({ before: String(before), limit: String(limit) })
  return (await getJson<{ rounds: ApiPastRound[] }>(`/rounds?${query}`)).rounds
}

export function fetchRound(round: number): Promise<ApiLiveRound | ApiRoundDetail> {
  return getJson(`/rounds/${round}`)
}

export async function fetchFinals(before: number, limit: number): Promise<ApiFinal[]> {
  const query = new URLSearchParams({ before: String(before), limit: String(limit) })
  return (await getJson<{ finals: ApiFinal[] }>(`/finals?${query}`)).finals
}

export function fetchFinal(final: number): Promise<ApiFinal> {
  return getJson(`/finals/${final}`)
}

export async function fetchChampions(before: number, limit: number): Promise<ApiHallEntry[]> {
  const query = new URLSearchParams({ before: String(before), limit: String(limit) })
  return (await getJson<{ champions: ApiHallEntry[] }>(`/champions?${query}`)).champions
}

function entryForm(entry: NewEntry): FormData {
  const form = new FormData()
  form.set('round', String(entry.round))
  form.set('title', entry.title)
  form.set('image', entry.image, 'drawing.png')
  return form
}

export function submitEntry(entry: NewEntry, wallet: string | null): Promise<{ id: number; token: string; wallet: string | null; entered: boolean }> {
  const form = entryForm(entry)
  if (wallet) form.set('wallet', wallet)
  return postForm('/entries', form)
}

export function updateEntry(entry: NewEntry, token: string): Promise<{ id: number }> {
  const form = entryForm(entry)
  form.set('token', token)
  return postForm('/entries', form, 'PUT')
}

export function checkWallet(wallet: string): Promise<{ wallet: string; holds: boolean }> {
  return getJson(`/wallets/${wallet}`)
}

export function suggestPrompt(text: string): Promise<{ id: number }> {
  return postJson('/prompts', { text })
}
