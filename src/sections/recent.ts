import { pastRounds } from '../game/results'
import { currentRound } from '../game/round'
import { onTick } from '../game/ticker'
import { ROUNDS_HREF } from '../router'
import { h, ruleHeading, svg } from '../ui/dom'
import { icons } from '../ui/icons'
import { exampleNote, roundCard } from './roundcard'

export function recent(): HTMLElement {
  const grid = h('div', { class: 'round-grid' })
  let shown = 0
  onTick((now) => {
    const round = currentRound(now)
    if (round === shown) return
    shown = round
    grid.replaceChildren(...pastRounds(4, round).map(roundCard))
  })

  return h(
    'section',
    { class: 'section', id: 'recent' },
    ruleHeading('Recent rounds', 'h2'),
    h('p', { class: 'section-lede' }, 'The winner and every drawing from each round.'),
    exampleNote(),
    grid,
    h('a', { href: ROUNDS_HREF, class: 'btn section-more' }, 'See every round', svg(icons.arrow)),
  )
}
