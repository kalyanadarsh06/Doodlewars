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
