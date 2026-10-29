import { DRAW_HREF, HOME_HREF, ROUNDS_HREF, WINNERS_HREF } from '../router'
import { LOGO } from '../content/ghost'
import { h, svg } from '../ui/dom'

const LINKS = [
  ['#how', 'How it works'],
  ['#judge', 'Judging'],
  [WINNERS_HREF, 'Winners'],
  [ROUNDS_HREF, 'Gallery'],
  ['#faq', 'FAQ'],
] as const

export function header(): HTMLElement {
  return h(
    'header',
    { class: 'topbar' },
    h('a', { href: HOME_HREF, class: 'logo', 'aria-label': 'DoodleWars home' }, svg(LOGO), h('span', { class: 'boil' }, 'DoodleWars')),
    h('nav', { class: 'nav', 'aria-label': 'Main' }, ...LINKS.map(([href, label]) => h('a', { href }, label))),
    h('div', { class: 'topbar-actions' }, h('a', { href: DRAW_HREF, class: 'btn btn-orange' }, 'Draw now')),
  )
}
