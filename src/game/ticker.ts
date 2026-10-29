import { currentRound } from './round'

type Listener = (now: number) => void

const listeners = new Set<Listener>()
let timer = 0

export function onTick(listener: Listener): () => void {
  listeners.add(listener)
  listener(Date.now())
  if (!timer) {
    timer = window.setInterval(() => {
      const now = Date.now()
      listeners.forEach((item) => item(now))
    }, 1000)
  }
  return () => {
    listeners.delete(listener)
  }
}

export function onRefresh(intervalMs: number, listener: (now: number) => void): () => void {
  let round = -1
  let last = 0
  return onTick((now) => {
    if (currentRound(now) === round && now - last < intervalMs) return
    round = currentRound(now)
    last = now
    listener(now)
  })
}
