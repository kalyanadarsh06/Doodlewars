import { SHAPES, WINNER_SHARE } from '../config'
import { roundResult, type Entry, type RoundResult } from '../game/results'
import { currentRound, msLeft, roundAt } from '../game/round'
import { onTick } from '../game/ticker'
import { DRAW_HREF, ROUNDS_HREF, roundHref } from '../router'
import { h, ruleHeading, svg } from '../ui/dom'
import { icons } from '../ui/icons'
import { clock, prettyTitle, shortAddress, usd, when } from '../util/format'
import { exampleNote } from './roundcard'

function artist(entry: Entry): string {
  return entry.wallet ? shortAddress(entry.wallet) : 'example wallet'
}

function winnerCard(result: RoundResult, winner: Entry): HTMLElement {
  return h(
    'div',
    { class: 'winner-card' },
    h('div', { class: 'winner-art' }, svg(winner.svg)),
    h(
      'div',
      { class: 'winner-info' },
      h('span', { class: 'winner-kicker' }, '★ Winner'),
      h('h2', { class: 'winner-title' }, prettyTitle(winner.title)),
      h('p', { class: 'winner-by' }, `Drawn by ${artist(winner)}`),
      result.prizeUsd === null ? null : h('p', { class: 'winner-amount' }, h('span', {}, 'Won'), h('strong', {}, usd(result.prizeUsd))),
      result.feesUsd === null ? null : h('p', { class: 'winner-split' }, `${WINNER_SHARE}% of the ${usd(result.feesUsd)} in fees traded this round.`),
      h('p', { class: 'payout-note' }, 'Sent automatically to the wallet that entered.'),
    ),
  )
}

function rolloverCard(result: RoundResult): HTMLElement {
  return h(
    'div',
    { class: 'winner-card is-empty' },
    h(
      'div',
      { class: 'winner-info' },
      h('span', { class: 'winner-kicker' }, 'No winner'),
      h('h2', { class: 'winner-title' }, 'Nobody drew this one.'),
      result.prizeUsd === null ? null : h('p', { class: 'winner-split' }, `${usd(result.prizeUsd)} rolled over to round ${result.number + 1}.`),
    ),
  )
}

function entryCard(entry: Entry, index: number, winner: Entry | null): HTMLElement {
  return h(
    'figure',
    { class: 'entry' },
    h(
      'div',
      { class: `entry-frame ${SHAPES[index % SHAPES.length]}` },
      svg(entry.svg),
      entry === winner ? h('span', { class: 'entry-badge', 'aria-label': 'Winner' }, '★') : null,
    ),
    h(
      'figcaption',
      {},
      h('span', { class: 'entry-title' }, prettyTitle(entry.title)),
      h('span', { class: 'entry-meta' }, artist(entry)),
    ),
  )
}

function liveBody(result: RoundResult): Node[] {
  const time = h('strong', {})
  onTick((now) => {
    time.textContent = clock(msLeft(result.round, now))
  })
  return [
    h(
      'div',
      { class: 'live-card blob-d' },
      h(
        'div',
        { class: 'live-card-copy' },
        h('span', { class: 'live-card-time' }, time, ' left to draw'),
        h('p', {}, 'The winner shows up here when the timer ends.'),
      ),
      h('a', { href: DRAW_HREF, class: 'btn btn-big' }, 'Draw it', svg(icons.arrow)),
    ),
  ]
}

function endedBody(result: RoundResult): Node[] {
  const { entries, winner } = result
  return [
    result.example ? exampleNote() : null,
    winner ? winnerCard(result, winner) : rolloverCard(result),
    entries.length ? ruleHeading(`All drawings (${entries.length})`, 'h2') : null,
    entries.length ? h('div', { class: 'entry-grid' }, ...entries.map((entry, index) => entryCard(entry, index, winner))) : null,
  ].filter((node): node is HTMLElement => node !== null)
}

function roundNav(result: RoundResult): HTMLElement {
  return h(
    'nav',
    { class: 'round-nav', 'aria-label': 'Other rounds' },
    result.number > 1 ? h('a', { href: roundHref(result.number - 1), class: 'btn btn-small' }, `← Round ${result.number - 1}`) : h('span'),
    result.live ? null : h('a', { href: roundHref(result.number + 1), class: 'btn btn-small' }, `Round ${result.number + 1} →`),
  )
}

function content(result: RoundResult): Node[] {
  return [
    h('a', { href: ROUNDS_HREF, class: 'back-link' }, '← All rounds'),
    h(
      'header',
      { class: 'round-head' },
      h('span', { class: 'round-label' }, result.live ? h('i', { class: 'live-dot' }) : null, `Round ${result.number} · ${result.live ? 'live now' : when(result.startsAt)}`),
      h('h1', { class: 'prompt-text round-title' }, h('mark', {}, result.prompt)),
    ),
    ...(result.live ? liveBody(result) : endedBody(result)),
    roundNav(result),
  ]
}

function missing(): Node[] {
  return [
    h('a', { href: ROUNDS_HREF, class: 'back-link' }, '← All rounds'),
    h('h1', { class: 'prompt-text round-title' }, 'That round hasn’t happened yet.'),
  ]
}

export function roundPage(number: number): HTMLElement {
  const page = h('section', { class: 'section round-page' })
  const round = roundAt(number)

  if (!Number.isInteger(number) || number < 1 || round > currentRound()) {
    page.append(...missing())
    return page
  }

  let ended = round < currentRound()
  page.append(...content(roundResult(round)))
  onTick((now) => {
    if (ended || currentRound(now) <= round) return
    ended = true
    page.replaceChildren(...content(roundResult(round, now)))
  })
  return page
}
