export function fileName(title: string): string {
  return `${title.replace(/\s+/g, '_')}.sk`
}

export function prettyTitle(title: string): string {
  return title.replace(/_/g, ' ')
}
