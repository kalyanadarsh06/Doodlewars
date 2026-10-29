export function fileName(title: string): string {
  return `${title.trim().replace(/\s+/g, '_') || 'doodle'}.png`
}

export function prettyTitle(title: string): string {
  return title.replace(/_/g, ' ').trim()
}

export function drawingTitle(drawing: { title: string }): string {
  return prettyTitle(drawing.title) || 'Untitled'
}

export function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function count(amount: number, noun: string): string {
  return `${amount} ${noun}${amount === 1 ? '' : 's'}`
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function when(ms: number): string {
  return new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function timeOfDay(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
