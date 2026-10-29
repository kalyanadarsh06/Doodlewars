export const HOME_HREF = '#/'
export const DRAW_HREF = '#/draw'
export const ROUNDS_HREF = '#/rounds'
export const WINNERS_HREF = '#/winners'

export type Route = { name: 'home' } | { name: 'draw' } | { name: 'rounds' } | { name: 'winners' } | { name: 'round'; number: number } | { name: 'final'; number: number }

export function roundHref(number: number): string {
  return `${ROUNDS_HREF}/${number}`
}

export function finalHref(number: number): string {
  return `#/finals/${number}`
}

export function currentRoute(): Route {
  const [, page, id] = location.hash.split('/')
  if (page === 'draw') return { name: 'draw' }
  if (page === 'winners') return { name: 'winners' }
  if (page === 'finals' && id) return { name: 'final', number: Number(id) }
  if (page === 'rounds') return id ? { name: 'round', number: Number(id) } : { name: 'rounds' }
  return { name: 'home' }
}

export function routeKey(route: Route): string {
  return route.name === 'round' || route.name === 'final' ? `${route.name}/${route.number}` : route.name
}

export function anchorTarget(): HTMLElement | null {
  const { hash } = location
  return hash.length > 1 && !hash.startsWith('#/') ? document.getElementById(hash.slice(1)) : null
}
