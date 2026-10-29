import { ROUND_MS, TICKER } from '../config'
import { JUDGE_NAME, JUDGE_SVG } from '../content/judge'
import { onLiveRound } from '../game/live'
import { msLeft } from '../game/round'
import { h, ruleHeading, svg } from '../ui/dom'
import { clock } from '../util/format'

const WHALE = `<svg viewBox="0 0 200 150" fill="none" stroke="#161616" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M82 42c-4-10-14-14-22-12M88 40c0-10 6-18 16-20M85 40V24" stroke="#6e6cf3"/><ellipse cx="156" cy="42" rx="16" ry="8" fill="#6e6cf3" transform="rotate(35 156 42)"/><ellipse cx="182" cy="44" rx="16" ry="8" fill="#6e6cf3" transform="rotate(-35 182 44)"/><path d="M138 90c16-6 26-18 31-36" stroke-width="17"/><path d="M138 90c16-6 26-18 31-36" stroke="#6e6cf3" stroke-width="7"/><path d="M18 98c0-28 28-50 66-50 36 0 62 18 70 42 4 14-4 26-18 32-18 8-48 10-74 8-28-2-44-14-44-32z" fill="#6e6cf3"/><path d="M38 114c24 9 64 9 94-1M54 122c18 4 42 4 60-1" stroke="#ffffff" stroke-width="4"/><path d="M34 94c8 6 20 6 28 0"/><circle cx="74" cy="94" r="5" fill="#f09aae" stroke="none"/><path d="M92 70l28 5"/><rect x="34" y="62" width="27" height="18" rx="7" fill="#161616"/><rect x="66" y="62" width="27" height="18" rx="7" fill="#161616"/><path d="M61 68h5"/><path d="M40 67l6-2M72 67l6-2" stroke="#ffffff" stroke-width="3"/></svg>`

const ARROW = `<svg class="step-arrow" viewBox="0 0 80 40" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 24c14-12 34-14 62-6"/><path d="M56 8l13 10-15 8"/></svg>`

interface LiveArt {
  prompt: HTMLElement
  time: HTMLElement
  fill: HTMLElement
  final: HTMLElement
}

function promptArt(live: LiveArt): HTMLElement {
  return h(
    'div',
    { class: 'step-art art-prompt' },
    h('div', { class: 'art-note blob-d' }, h('span', {}, 'This round'), live.prompt),
    h('span', { class: 'art-clock blob-c' }, '5:00'),
  )
}

function drawArt(live: LiveArt): HTMLElement {
  return h(
    'div',
    { class: 'step-art art-draw' },
    h('div', { class: 'art-canvas' }, svg(WHALE)),
    h('div', { class: 'art-timer' }, h('span', { class: 'art-track' }, live.fill), live.time),
  )
}

function judgeArt(): HTMLElement {
  return h('div', { class: 'step-art art-judge' }, svg(JUDGE_SVG))
}

function prizeArt(live: LiveArt): HTMLElement {
  return h(
    'div',
    { class: 'step-art art-prize' },
    h('span', { class: 'art-coin' }, '$'),
    h('span', { class: 'art-share blob-d' }, live.final),
    h('span', { class: 'art-badge' }, 'Paid'),
  )
}

const STEPS = [
  { title: 'A prompt drops', body: ['New prompt every 5 minutes, ', 'picked from player suggestions', '.'], art: promptArt },
  { title: 'You draw it', body: ['Beat the clock. ', `Hold ${TICKER} to compete`, '.'], art: drawArt },
  { title: 'Judge picks', body: [`${JUDGE_NAME} checks every drawing and `, 'crowns one per round', '.'], art: judgeArt },
  { title: 'The Final pays', body: ['After 6 rounds, the winners face off. ', 'Champion takes the creator fees', '.'], art: prizeArt },
] as const

export function how(): HTMLElement {
  const live: LiveArt = { prompt: h('p', {}), time: h('strong', {}), fill: h('i'), final: h('span', {}) }
  onLiveRound((round, now) => {
    const left = msLeft(round.round, now)
    live.prompt.textContent = round.prompt
    live.time.textContent = clock(left)
    live.fill.style.width = `${(1 - left / ROUND_MS) * 100}%`
    live.final.textContent = clock(round.finalEndsAt - now)
  })

  return h(
    'section',
    { class: 'section', id: 'how' },
    ruleHeading('How it works', 'h2'),
    h(
      'ol',
      { class: 'steps' },
      ...STEPS.flatMap((step, index) => [
        index > 0 ? h('li', { class: 'step-link', 'aria-hidden': 'true' }, svg(ARROW)) : null,
        h(
          'li',
          { class: 'step' },
          step.art(live),
          h('h3', { class: 'step-title' }, h('span', { class: 'step-number' }, String(index + 1)), step.title),
          h('p', { class: 'step-body' }, step.body[0], h('mark', {}, step.body[1]), step.body[2]),
        ),
      ]).filter((item): item is HTMLLIElement => item !== null),
    ),
  )
}
