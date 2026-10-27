import { JUDGE_SVG } from '../content/judge'
import type { Entry, RoundResult } from '../game/results'
import { DRAW_HREF, roundHref } from '../router'
import { h, svg } from '../ui/dom'
import { icons } from '../ui/icons'
import { count, usd } from '../util/format'

export type Stage =
  | { phase: 'waiting'; number: number; prompt: string; latest: RoundResult | null }
  | { phase: 'thinking' | 'verdict'; result: RoundResult }

function link(href: string, text: string, className = 'btn btn-small'): HTMLElement {
  return h('a', { href, class: className }, text, svg(icons.arrow))
}

function caption(number: number, prompt: string): HTMLElement {
  return h('p', { class: 'exhibit-caption' }, `Round ${number} · `, h('mark', {}, prompt))
}

function winnerFrame(result: RoundResult, winner: Entry): HTMLElement {
  return h(
    'div',
    { class: 'exhibit-frame' },
    svg(winner.svg),
    result.prizeUsd === null ? null : h('span', { class: 'exhibit-prize' }, 'Won ', h('strong', {}, usd(result.prizeUsd))),
  )
}

function waiting(stage: Extract<Stage, { phase: 'waiting' }>, time: HTMLElement): Node[] {
  const next = h('p', { class: 'exhibit-next' }, h('i', { class: 'live-dot' }), 'Next judging in ', time)
  const draw = link(DRAW_HREF, 'Draw it', 'btn btn-small btn-yellow')
  const { latest } = stage
  if (!latest?.winner) {
    return [
      h('span', { class: 'exhibit-label' }, 'Now drawing'),
      h('div', { class: 'exhibit-frame' }, h('span', { class: 'exhibit-empty' }, '?')),
      caption(stage.number, stage.prompt),
      h('div', { class: 'verdict-actions' }, draw),
      next,
    ]
  }
  return [
    h('span', { class: 'exhibit-label' }, '★ Latest winner'),
    winnerFrame(latest, latest.winner),
    caption(latest.number, latest.prompt),
    h('div', { class: 'verdict-actions' }, draw, link(roundHref(latest.number), 'See all drawings')),
    next,
  ]
}

function bench(stage: Stage, time: HTMLElement): Node[] {
  switch (stage.phase) {
    case 'waiting':
      return waiting(stage, time)
    case 'thinking':
      return [
        h('span', { class: 'exhibit-label' }, `Judging ${count(stage.result.entries.length, 'drawing')}`),
        h('div', { class: 'exhibit-frame' }, h('span', { class: 'exhibit-empty' }, '…')),
        caption(stage.result.number, stage.result.prompt),
      ]
    case 'verdict': {
      const { winner } = stage.result
      return [
        h('span', { class: 'exhibit-label' }, winner ? '★ Winner' : 'No entries, prize rolls over'),
        winner ? winnerFrame(stage.result, winner) : h('div', { class: 'exhibit-frame' }, h('span', { class: 'exhibit-empty' }, '?')),
        caption(stage.result.number, stage.result.prompt),
        h('div', { class: 'verdict-actions' }, link(roundHref(stage.result.number), winner ? 'See all drawings' : 'See round')),
      ]
    }
  }
}

export function verdictView(stage: Stage, time: HTMLElement): HTMLElement {
  return h(
    'div',
    { class: 'verdict', 'data-phase': stage.phase },
    h('div', { class: 'verdict-judge' }, h('div', { class: 'judge-figure' }, svg(JUDGE_SVG))),
    h('div', { class: 'verdict-bench', 'aria-live': 'polite' }, ...bench(stage, time)),
  )
}
