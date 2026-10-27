import { pastRounds, roundResult } from '../game/results'
import { currentRound, msLeft, promptFor, roundNumber } from '../game/round'
import { onTick } from '../game/ticker'
import { DRAW_HREF } from '../router'
import { h, ruleHeading, svg } from '../ui/dom'
import { icons } from '../ui/icons'
import { clock } from '../util/format'
import { exampleNote, roundCard } from './roundcard'

const PAGE_SIZE = 12

function liveCard(): HTMLElement {
  const label = h('span', {})
  const prompt = h('p', { class: 'live-card-prompt' })
  const time = h('strong', {})
  onTick((now) => {
    const round = currentRound(now)
    label.textContent = `Round ${roundNumber(round)} · live now`
    prompt.textContent = promptFor(round)
    time.textContent = clock(msLeft(round, now))
  })

  return h(
    'div',
    { class: 'live-card blob-d' },
    h(
      'div',
      { class: 'live-card-copy' },
      h('span', { class: 'round-label' }, h('i', { class: 'live-dot' }), label),
      prompt,
      h('span', { class: 'live-card-time' }, time, ' left to draw'),
    ),
    h('a', { href: DRAW_HREF, class: 'btn btn-big' }, 'Draw it', svg(icons.arrow)),
  )
}

export function rounds(): HTMLElement {
  const grid = h('div', { class: 'round-grid' })
  const more = h('button', { type: 'button', class: 'btn rounds-more' }, 'Show older rounds')
  let newest = currentRound()
  let oldest = newest

  const loadOlder = (): void => {
    const batch = pastRounds(PAGE_SIZE, oldest)
    grid.append(...batch.map(roundCard))
    oldest -= batch.length
    more.hidden = batch.length < PAGE_SIZE
  }

  more.addEventListener('click', loadOlder)
  loadOlder()
  onTick((now) => {
    for (; newest < currentRound(now); newest += 1) grid.prepend(roundCard(roundResult(newest, now)))
  })

  return h(
    'section',
    { class: 'section rounds-page' },
    ruleHeading('Every round', 'h2'),
    h('p', { class: 'section-lede' }, 'Newest first. Open one to see every drawing.'),
    liveCard(),
    exampleNote(),
    grid,
    more,
  )
}
