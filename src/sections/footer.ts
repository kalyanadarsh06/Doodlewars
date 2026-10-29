import { REPO_URL } from '../config'
import { DOODLES } from '../content/doodles'
import { LOGO } from '../content/ghost'
import { DRAW_HREF } from '../router'
import { h, svg } from '../ui/dom'
import { icons } from '../ui/icons'
import { contractAddress } from './contract'
import { HOLD_RULE } from './hold'

export function cta(): HTMLElement {
  return h(
    'section',
    { class: 'cta' },
    ...[0, 3, 5, 7].map((index, slot) => h('div', { class: `cta-doodle cta-doodle-${slot + 1}`, 'aria-hidden': 'true' }, svg(DOODLES[index].svg))),
    h('h2', { class: 'cta-title wiggle' }, 'Pencils ready?'),
    h('p', {}, `New prompt every 5 minutes. A champion gets paid every 6 rounds. ${HOLD_RULE}`),
    h('a', { href: DRAW_HREF, class: 'btn btn-yellow' }, 'Draw now', svg(icons.arrow)),
  )
}

export function footer(): HTMLElement {
  return h(
    'footer',
    { class: 'footer' },
    h('span', { class: 'footer-logo' }, svg(LOGO), 'DoodleWars'),
    h('span', { class: 'footer-links' }, contractAddress(), h('a', { href: REPO_URL, target: '_blank', rel: 'noopener' }, 'GitHub')),
  )
}
