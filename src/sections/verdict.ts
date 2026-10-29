import { JUDGE_NAME, JUDGE_QUIPS, JUDGE_SVG } from '../content/judge'
import type { Champion, Drawing, FinalResult, RoundResult } from '../game/results'
import { DRAW_HREF, finalHref, roundHref } from '../router'
import { h, svg } from '../ui/dom'
import { icons } from '../ui/icons'
import { count, drawingTitle, timeOfDay } from '../util/format'
import { drawingImage } from './roundcard'

type Phase = 'thinking' | 'verdict'

export type Stage =
  | { phase: 'waiting'; number: number; prompt: string; latest: RoundResult | null }
  | { phase: Phase; result: RoundResult }
  | { phase: Phase; final: FinalResult }

function link(href: string, text: string, className = 'btn btn-small'): HTMLElement {
  return h('a', { href, class: className }, text, svg(icons.arrow))
}

function caption(number: number, prompt: string): HTMLElement {
  return h('p', { class: 'exhibit-caption' }, `Round ${number} · `, h('mark', {}, prompt))
}

function finalCaption(final: FinalResult): HTMLElement {
  return h('p', { class: 'exhibit-caption' }, `Final ${final.number} · `, h('mark', {}, `the ${timeOfDay(final.endsAt)} Final`))
}

function tag(result: RoundResult): HTMLElement {
  if (result.final.champion) return h('span', { class: 'exhibit-prize' }, '★ ', h('strong', {}, 'Final champion'))
  return h('span', { class: 'exhibit-prize' }, result.final.settled ? 'Made the ' : 'Into the ', h('strong', {}, `${timeOfDay(result.final.endsAt)} Final`))
}

function frame(drawing: Drawing, label: HTMLElement | null): HTMLElement {
  return h('div', { class: 'exhibit-frame' }, drawingImage(drawing), label)
}

function emptyFrame(mark: string): HTMLElement {
  return h('div', { class: 'exhibit-frame' }, h('span', { class: 'exhibit-empty' }, mark))
}

function noteFrame(text: string): HTMLElement {
  return h('div', { class: 'exhibit-frame' }, h('span', { class: 'exhibit-empty exhibit-empty-text' }, text))
}

function waiting(stage: Extract<Stage, { phase: 'waiting' }>, time: HTMLElement): Node[] {
  const winner = stage.latest?.winner ? { result: stage.latest, drawing: stage.latest.winner } : null
  return [
    h('span', { class: 'exhibit-label is-live' }, h('i', { class: 'live-dot' }), `Round ${stage.number} in progress`),
    h('p', { class: 'exhibit-prompt' }, 'Draw this: ', h('mark', {}, stage.prompt)),
    winner ? frame(winner.drawing, tag(winner.result)) : noteFrame('No winners yet'),
    winner ? h('p', { class: 'exhibit-caption' }, `Last winner · Round ${winner.result.number} · `, h('mark', {}, winner.result.prompt)) : null,
    h(
      'div',
      { class: 'verdict-actions' },
      link(DRAW_HREF, 'Draw it', 'btn btn-small btn-yellow'),
      winner ? link(roundHref(winner.result.number), 'See all drawings') : null,
    ),
    h('p', { class: 'exhibit-next' }, 'Round ends in ', time),
  ].filter((node): node is HTMLElement => node !== null)
}

function roundBench(phase: Phase, result: RoundResult): Node[] {
  if (phase === 'thinking') return [h('span', { class: 'exhibit-label' }, `Judging ${count(result.entries, 'drawing')}`), emptyFrame('…'), caption(result.number, result.prompt)]
  const { winner } = result
  return [
    h('span', { class: 'exhibit-label' }, winner ? '★ Round winner' : result.entries ? 'No winner' : 'No entries'),
    winner ? frame(winner, tag(result)) : emptyFrame('?'),
    caption(result.number, result.prompt),
    h('div', { class: 'verdict-actions' }, link(roundHref(result.number), winner ? 'See all drawings' : 'See round')),
  ]
}

function finalists(final: FinalResult): number {
  return final.rounds.filter((round) => round.winner).length
}

function championFrame(final: FinalResult, champion: Champion): HTMLElement {
  return frame(champion, h('span', { class: 'exhibit-prize' }, `Final ${final.number}`, h('strong', {}, '★ Champion')))
}

function finalBench(phase: Phase, final: FinalResult): Node[] {
  if (phase === 'thinking') return [h('span', { class: 'exhibit-label' }, `Final · ${count(finalists(final), 'round winner')}`), emptyFrame('…'), finalCaption(final)]
  const { champion } = final
  return [
    h('span', { class: 'exhibit-label' }, champion ? '★ Champion' : 'No champion'),
    champion ? championFrame(final, champion) : emptyFrame('?'),
    finalCaption(final),
    h('div', { class: 'verdict-actions' }, link(finalHref(final.number), 'See the Final')),
  ]
}

function bench(stage: Stage, time: HTMLElement): Node[] {
  if (stage.phase === 'waiting') return waiting(stage, time)
  return 'final' in stage ? finalBench(stage.phase, stage.final) : roundBench(stage.phase, stage.result)
}

function roundLine(phase: Phase, result: RoundResult): string {
  if (phase === 'thinking') return `Hmm… let me look at all ${count(result.entries, 'drawing')}.`
  const { winner, note } = result
  if (winner) return note ?? `And the round goes to… “${drawingTitle(winner)}”!`
  return result.entries ? 'Nothing I can pick this time.' : 'Nobody drew? Next round, then.'
}

function finalLine(phase: Phase, final: FinalResult): string {
  if (phase === 'thinking') return `${count(finalists(final), 'round winner')}. One champion. Let’s go.`
  const { champion, note } = final
  if (champion) return note ?? `And the champion is… “${drawingTitle(champion)}”!`
  return 'No round winners this time. The creator fees roll over.'
}

function line(stage: Stage): string {
  if (stage.phase === 'waiting') return JUDGE_QUIPS[stage.number % JUDGE_QUIPS.length]
  return 'final' in stage ? finalLine(stage.phase, stage.final) : roundLine(stage.phase, stage.result)
}

export function verdictView(stage: Stage, time: HTMLElement): HTMLElement {
  return h(
    'div',
    { class: 'verdict', 'data-phase': stage.phase },
    h(
      'div',
      { class: 'verdict-judge' },
      h('p', { class: 'judge-bubble' }, line(stage)),
      h(
        'div',
        { class: 'judge-seat' },
        ...[1, 2, 3, 4].map((index) => h('span', { class: `sparkle sparkle-${index}`, 'aria-hidden': 'true' }, '✦')),
        h('div', { class: 'judge-figure' }, svg(JUDGE_SVG)),
        h('div', { class: 'judge-bench' }, h('p', { class: 'judge-plate' }, h('strong', {}, JUDGE_NAME), h('span', {}, 'AI judge'))),
      ),
    ),
    h('div', { class: 'verdict-bench', 'aria-live': 'polite' }, ...bench(stage, time)),
  )
}
