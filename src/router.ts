export const HOME_HREF = '#/'
export const DRAW_HREF = '#/draw'

export type Route = 'home' | 'draw'

export function currentRoute(): Route {
  return location.hash === DRAW_HREF ? 'draw' : 'home'
}

export function anchorTarget(): HTMLElement | null {
  const { hash } = location
  return hash.length > 1 && !hash.startsWith('#/') ? document.getElementById(hash.slice(1)) : null
}
