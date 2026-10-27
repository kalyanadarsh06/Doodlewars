import { ROUND_MS } from '../config'
import { livePrizeUsd } from '../game/results'
import { currentRound, msLeft, promptFor, roundNumber } from '../game/round'
import { onTick } from '../game/ticker'
import { h } from '../ui/dom'
import { clock, usd } from '../util/format'

const LOW_MS = 10 * 1000

export function roundBar(): HTMLElement {
  const label = h('span', {})
  const time = h('strong', {})
  const prize = h('strong', {})
  const prompt = h('mark', {})
  const fill = h('i', { class: 'roundbar-fill' })
  const root = h(
    'header',
    { class: 'roundbar' },
    h(
      'div',
      { class: 'roundbar-copy' },
      h('span', { class: 'roundbar-live' }, h('i', { class: 'live-dot' }), label),
      h('h1', { class: 'prompt-text roundbar-prompt' }, prompt),
    ),
    h('div', { class: 'roundbar-prize' }, h('span', {}, 'Prize so far'), prize, h('small', {}, 'example until launch')),
    h('div', { class: 'roundbar-timer blob-c' }, time, h('span', {}, 'left')),
    h('div', { class: 'roundbar-track', 'aria-hidden': 'true' }, fill),
  )

  onTick((now) => {
    const round = currentRound(now)
    const left = msLeft(round, now)
    label.textContent = `Round ${roundNumber(round)} · Draw this`
    time.textContent = clock(left)
    prize.textContent = usd(livePrizeUsd(round, now))
    fill.style.width = `${(left / ROUND_MS) * 100}%`
    root.classList.toggle('is-low', left <= LOW_MS)
    if (prompt.textContent !== promptFor(round)) prompt.textContent = promptFor(round)
  })

  return root
}
