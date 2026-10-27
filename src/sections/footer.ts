import { REPO_URL, TICKER } from '../config'
import { DRAW_HREF } from '../router'
import { h, svg } from '../ui/dom'
import { icons } from '../ui/icons'
import { contractAddress } from './contract'

export function cta(): HTMLElement {
  return h(
    'section',
    { class: 'cta' },
    h('h2', { class: 'cta-title wiggle' }, 'Pencils ready?'),
    h('p', {}, `Practice is open now. Real rounds start when ${TICKER} launches.`),
    h('a', { href: DRAW_HREF, class: 'btn btn-yellow' }, 'Start practicing', svg(icons.arrow)),
  )
}

export function footer(): HTMLElement {
  return h(
    'footer',
    { class: 'footer' },
    h('span', {}, 'DoodleWars'),
    h('span', { class: 'footer-links' }, contractAddress(), h('a', { href: REPO_URL, target: '_blank', rel: 'noopener' }, 'GitHub')),
  )
}
