import { ROUND_MS } from '../config'
import { onLiveRound } from '../game/live'
import { msLeft } from '../game/round'
import { h } from '../ui/dom'
import { clock, count, timeOfDay } from '../util/format'

const LOW_MS = 10 * 1000

export function roundBar(): HTMLElement {
  const label = h('span', {})
  const time = h('strong', {})
  const final = h('strong', {})
  const finalLabel = h('span', {})
  const note = h('small', {})
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
    h('div', { class: 'roundbar-prize' }, finalLabel, final, note),
    h('div', { class: 'roundbar-timer blob-c' }, time, h('span', {}, 'left')),
    h('div', { class: 'roundbar-track', 'aria-hidden': 'true' }, fill),
  )

  onLiveRound((live, now) => {
    const left = msLeft(live.round, now)
    label.textContent = `Round ${live.number} · Draw this`
    time.textContent = clock(left)
    finalLabel.textContent = `${timeOfDay(live.finalEndsAt)} Final in`
    final.textContent = clock(live.finalEndsAt - now)
    note.textContent = live.entries === null ? 'Champion takes the creator fees' : `${count(live.entries, 'drawing')} this round`
    fill.style.width = `${(left / ROUND_MS) * 100}%`
    root.classList.toggle('is-low', left <= LOW_MS)
    if (prompt.textContent !== live.prompt) prompt.textContent = live.prompt
  })

  return root
}
