import { DRAW_HREF, HOME_HREF, ROUNDS_HREF } from '../router'
import { h } from '../ui/dom'
import { walletButton } from './wallet'

const LINKS = [
  ['#how', 'How it works'],
  ['#judge', 'Judge'],
  [ROUNDS_HREF, 'Rounds'],
  ['#faq', 'FAQ'],
] as const

export function header(): HTMLElement {
  return h(
    'header',
    { class: 'topbar' },
    h('a', { href: HOME_HREF, class: 'logo', 'aria-label': 'DoodleWars home' }, h('span', { class: 'boil' }, 'DoodleWars')),
    h('nav', { class: 'nav', 'aria-label': 'Main' }, ...LINKS.map(([href, label]) => h('a', { href }, label))),
    h('div', { class: 'topbar-actions' }, walletButton(), h('a', { href: DRAW_HREF, class: 'btn btn-orange' }, 'Draw now')),
  )
}
