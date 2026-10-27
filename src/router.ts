export const HOME_HREF = '#/'
export const DRAW_HREF = '#/draw'
export const ROUNDS_HREF = '#/rounds'

export type Route = { name: 'home' } | { name: 'draw' } | { name: 'rounds' } | { name: 'round'; number: number }

export function roundHref(number: number): string {
  return `${ROUNDS_HREF}/${number}`
}

export function currentRoute(): Route {
  const [, page, id] = location.hash.split('/')
  if (page === 'draw') return { name: 'draw' }
  if (page === 'rounds') return id ? { name: 'round', number: Number(id) } : { name: 'rounds' }
  return { name: 'home' }
}

export function routeKey(route: Route): string {
  return route.name === 'round' ? `round/${route.number}` : route.name
}

export function anchorTarget(): HTMLElement | null {
  const { hash } = location
  return hash.length > 1 && !hash.startsWith('#/') ? document.getElementById(hash.slice(1)) : null
}
