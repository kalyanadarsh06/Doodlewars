import { fetchCurrentRound, type ApiLiveRound } from '../api/endpoints'
import { currentRound, finalEnd, finalNumber, finalOf, roundNumber } from './round'
import { onTick } from './ticker'

export interface LiveRound {
  round: number
  number: number
  prompt: string
  entries: number | null
  final: number
  finalNumber: number
  finalEndsAt: number
}

const DETECT_MS = 3000
const POLL_MS = 10 * 1000
const RETRY_MS = 2000

let latest: ApiLiveRound | null = null
let fetchedAt = 0
let loading = false

export async function loadLive(): Promise<void> {
  try {
    latest = await fetchCurrentRound(AbortSignal.timeout(DETECT_MS))
    fetchedAt = Date.now()
  } catch {
    fetchedAt = 0
  }
}

function refresh(now: number): void {
  const wait = latest?.round === currentRound(now) ? POLL_MS : RETRY_MS
  if (loading || now - fetchedAt < wait) return
  loading = true
  fetchCurrentRound()
    .then((round) => {
      latest = round
    })
    .catch(() => undefined)
    .finally(() => {
      fetchedAt = Date.now()
      loading = false
    })
}

function snapshot(now: number): LiveRound {
  const round = currentRound(now)
  const final = finalOf(round)
  const base = { round, number: roundNumber(round), final, finalNumber: finalNumber(final), finalEndsAt: finalEnd(final) }
  if (latest?.round === round) return { ...base, prompt: latest.prompt, entries: latest.entries }
  if (latest?.next?.round === round) return { ...base, prompt: latest.next.prompt, entries: 0 }
  return { ...base, prompt: '…', entries: null }
}

export function onLiveRound(listener: (round: LiveRound, now: number) => void): () => void {
  return onTick((now) => {
    refresh(now)
    listener(snapshot(now), now)
  })
}
