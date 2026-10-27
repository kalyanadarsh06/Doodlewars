import { SHAPES, TICKER } from '../config'
import type { RoundResult } from '../game/results'
import { roundHref } from '../router'
import { h, svg } from '../ui/dom'
import { count, usd } from '../util/format'

export function exampleNote(): HTMLElement {
  return h('p', { class: 'example-note' }, `Example drawings for now. Real entries start when ${TICKER} launches.`)
}

function summary(result: RoundResult): string {
  const prize = result.prizeUsd === null ? null : usd(result.prizeUsd)
  if (!result.winner) return prize ? `No entries · ${prize} rolled over` : 'No entries · rolled over'
  const drawings = count(result.entries.length, 'drawing')
  return prize ? `Won ${prize} · ${drawings}` : drawings
}

export function roundCard(result: RoundResult): HTMLElement {
  const { winner } = result
  return h(
    'a',
    { href: roundHref(result.number), class: 'round-card' },
    h(
      'div',
      { class: `round-thumb ${SHAPES[result.round % SHAPES.length]}` },
      winner ? svg(winner.svg) : h('span', { class: 'round-empty' }, 'Rolled over'),
    ),
    h(
      'div',
      { class: 'round-info' },
      h('span', { class: 'round-label' }, `Round ${result.number}`),
      h('p', { class: 'round-prompt' }, result.prompt),
      h('span', { class: 'round-meta' }, summary(result)),
    ),
  )
}
