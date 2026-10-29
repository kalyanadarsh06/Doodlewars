import { pastRounds, resultKey } from '../game/results'
import { onRefresh } from '../game/ticker'
import { ROUNDS_HREF } from '../router'
import { h, ruleHeading, svg } from '../ui/dom'
import { icons } from '../ui/icons'
import { roundCard } from './roundcard'

const REFRESH_MS = 15 * 1000
const SHOWN = 4

export function recent(): HTMLElement {
  const grid = h('div', { class: 'round-grid' })
  const empty = h('p', { class: 'empty-note', hidden: true }, 'No winners yet. Could be you.')
  let shown: string | null = null

  onRefresh(REFRESH_MS, () => {
    pastRounds(SHOWN)
      .then((rounds) => {
        const key = rounds.map(resultKey).join()
        if (key === shown) return
        shown = key
        grid.replaceChildren(...rounds.map(roundCard))
        empty.hidden = rounds.length > 0
      })
      .catch(() => undefined)
  })

  return h(
    'section',
    { class: 'section', id: 'recent' },
    ruleHeading('The Sketchbook', 'h2'),
    h('p', { class: 'section-lede' }, 'Fresh round winners, all headed for the Final.'),
    grid,
    empty,
    h('a', { href: ROUNDS_HREF, class: 'btn section-more' }, 'Open the gallery', svg(icons.arrow)),
  )
}
