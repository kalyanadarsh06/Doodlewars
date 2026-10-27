export function fileName(title: string): string {
  return `${title.replace(/\s+/g, '_')}.sk`
}

export function prettyTitle(title: string): string {
  return title.replace(/_/g, ' ')
}

export function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
