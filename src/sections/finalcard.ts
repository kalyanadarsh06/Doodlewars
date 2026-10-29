import { SHAPES } from '../config'
import type { Champion, FinalResult, FinalRound } from '../game/results'
import { finalHref, roundHref } from '../router'
import { h } from '../ui/dom'
import { count, drawingTitle, timeOfDay } from '../util/format'
import { drawingImage } from './roundcard'

const EMPTY: Record<FinalRound['status'], string> = {
  upcoming: 'Up next',
  live: 'Drawing now',
  judging: 'Judging',
  done: 'No winner',
  void: 'Before launch',
}

function emptyLabel(round: FinalRound): string {
  return round.status === 'done' && round.entries === 0 ? 'No entries' : EMPTY[round.status]
}

export function finalWindow(result: Pick<FinalResult, 'startsAt' | 'endsAt'>): string {
  return `${timeOfDay(result.startsAt)}–${timeOfDay(result.endsAt)}`
}

export function finalistCard(round: FinalRound, champion: Champion | null): HTMLElement {
  const crowned = champion !== null && round.winner?.id === champion.id
  const meta = round.winner ? drawingTitle(round.winner) : round.entries > 0 && (round.status === 'done' || round.status === 'judging') ? count(round.entries, 'drawing') : ''
  return h(
    round.status === 'upcoming' ? 'div' : 'a',
    { href: round.status === 'upcoming' ? undefined : roundHref(round.number), class: `round-card finalist${crowned ? ' is-champion' : ''}` },
    h(
      'div',
      { class: `round-thumb ${SHAPES[round.round % SHAPES.length]}` },
      round.winner ? drawingImage(round.winner) : h('span', { class: 'round-empty' }, emptyLabel(round)),
      crowned ? h('span', { class: 'entry-badge', 'aria-label': 'Champion' }, '★') : null,
    ),
    h(
      'div',
      { class: 'round-info' },
      h('span', { class: 'round-label' }, `Round ${round.number}`),
      h('p', { class: 'round-prompt' }, round.prompt ?? 'Prompt drops soon'),
      meta ? h('span', { class: 'round-meta' }, round.winner ? `★ ${meta}` : meta) : null,
    ),
  )
}

function status(result: FinalResult): string {
  if (result.status === 'live') return 'Live now'
  if (result.status === 'judging') return 'Judging the Final'
  if (!result.champion) return 'No champion · fees roll over'
  return `★ Champion: ${drawingTitle(result.champion)}`
}

export function finalBlock(result: FinalResult): HTMLElement {
  return h(
    'section',
    { class: `final-block${result.status === 'live' ? ' is-live' : ''}` },
    h(
      'a',
      { href: finalHref(result.number), class: 'final-block-head' },
      h('span', { class: 'round-label' }, result.status === 'live' ? h('i', { class: 'live-dot' }) : null, `Final ${result.number} · ${finalWindow(result)}`),
      h('strong', { class: 'final-block-status' }, status(result)),
      h('span', { class: 'final-block-open' }, 'Open →'),
    ),
    h('div', { class: 'finalist-grid' }, ...result.rounds.map((round) => finalistCard(round, result.champion))),
  )
}
