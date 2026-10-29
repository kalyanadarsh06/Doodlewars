import { SHAPES } from '../config'
import type { Drawing, RoundResult } from '../game/results'
import { roundHref } from '../router'
import { h } from '../ui/dom'
import { count, drawingTitle } from '../util/format'

export function drawingImage(drawing: Drawing): HTMLImageElement {
  return h('img', { src: drawing.image, alt: drawingTitle(drawing), loading: 'lazy', decoding: 'async' })
}

function summary(result: RoundResult): string {
  const drawings = count(result.entries, 'drawing')
  if (result.status === 'judging') return `Judging · ${drawings}`
  if (!result.winner) return result.entries ? `No winner · ${drawings}` : 'No entries'
  if (result.final.champion) return `★ Final champion · ${drawings}`
  return result.final.settled ? `Round winner · ${drawings}` : `In the Final · ${drawings}`
}

export function roundCard(result: RoundResult): HTMLElement {
  const { winner } = result
  return h(
    'a',
    { href: roundHref(result.number), class: `round-card${result.final.champion ? ' is-champion' : ''}` },
    h(
      'div',
      { class: `round-thumb ${SHAPES[result.round % SHAPES.length]}` },
      winner ? drawingImage(winner) : h('span', { class: 'round-empty' }, result.status === 'judging' ? 'Judging' : result.entries ? 'No winner' : 'No entries'),
      result.final.champion ? h('span', { class: 'entry-badge', 'aria-label': 'Final champion' }, '★') : null,
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
