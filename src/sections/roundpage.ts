import { messageOf } from '../api/client'
import { SHAPES } from '../config'
import { JUDGE_NAME } from '../content/judge'
import { onLiveRound } from '../game/live'
import { roundSettled, resultKey, roundDetail, type Drawing, type FinalLink, type RoundDetail } from '../game/results'
import { currentRound, msLeft, roundAt } from '../game/round'
import { onRefresh } from '../game/ticker'
import { DRAW_HREF, finalHref, ROUNDS_HREF, roundHref } from '../router'
import { h, ruleHeading, svg } from '../ui/dom'
import { icons } from '../ui/icons'
import { clock, count, drawingTitle, timeOfDay, when } from '../util/format'
import { judgeNote } from './judgenote'
import { drawingImage } from './roundcard'

const REFRESH_MS = 10 * 1000

function finalLink(final: FinalLink): HTMLElement {
  return h('a', { href: finalHref(final.number), class: 'btn btn-small' }, `See the ${timeOfDay(final.endsAt)} Final`, svg(icons.arrow))
}

function finalNote(final: FinalLink): Node[] {
  const time = timeOfDay(final.endsAt)
  if (final.champion) return [h('p', { class: 'winner-split' }, `★ Won the ${time} Final. The creator fees went straight to their wallet.`), finalLink(final)]
  const text = final.settled ? `Made the ${time} Final. Didn’t take it this time.` : `Headed to the ${time} Final. The champion takes the creator fees.`
  return [h('p', { class: 'winner-split' }, text), finalLink(final)]
}

function winnerCard(result: RoundDetail, winner: Drawing): HTMLElement {
  return h(
    'div',
    { class: 'winner-card' },
    h('div', { class: 'winner-art' }, drawingImage(winner)),
    h(
      'div',
      { class: 'winner-info' },
      h('span', { class: 'winner-kicker' }, result.final.champion ? '★ Final champion' : '★ Round winner'),
      h('h2', { class: 'winner-title' }, drawingTitle(winner)),
      judgeNote(result.note),
      ...finalNote(result.final),
    ),
  )
}

function emptyCard(result: RoundDetail): HTMLElement {
  return h(
    'div',
    { class: 'winner-card is-empty' },
    h(
      'div',
      { class: 'winner-info' },
      h('span', { class: 'winner-kicker' }, result.entries ? 'No winner' : 'No entries'),
      h('h2', { class: 'winner-title' }, result.entries ? 'No winner this round.' : 'Nobody drew this one.'),
      judgeNote(result.note),
    ),
  )
}

function judgingCard(result: RoundDetail): HTMLElement {
  return h(
    'div',
    { class: 'winner-card is-empty' },
    h(
      'div',
      { class: 'winner-info' },
      h('span', { class: 'winner-kicker' }, 'Judging'),
      h('h2', { class: 'winner-title' }, `${JUDGE_NAME} is looking at ${count(result.entries, 'drawing')}.`),
      h('p', { class: 'payout-note' }, 'Winner drops here in a minute or two. No need to refresh.'),
    ),
  )
}

function entryCard(entry: Drawing, index: number, winner: Drawing | null): HTMLElement {
  return h(
    'figure',
    { class: 'entry' },
    h(
      'div',
      { class: `entry-frame ${SHAPES[index % SHAPES.length]}` },
      drawingImage(entry),
      entry.id === winner?.id ? h('span', { class: 'entry-badge', 'aria-label': 'Winner' }, '★') : null,
    ),
    h(
      'figcaption',
      {},
      h('span', { class: 'entry-title' }, drawingTitle(entry)),
      entry.entered ? h('span', { class: 'entered-badge' }, svg(icons.check), 'Entered') : h('span', { class: 'entry-meta' }, 'Just for fun'),
    ),
  )
}

function summaryCard(result: RoundDetail): HTMLElement {
  if (result.status === 'judging') return judgingCard(result)
  return result.winner ? winnerCard(result, result.winner) : emptyCard(result)
}

function endedBody(result: RoundDetail): Node[] {
  const { drawings, winner } = result
  return [
    summaryCard(result),
    drawings.length ? ruleHeading(`All drawings (${drawings.length})`, 'h2') : null,
    drawings.length ? h('div', { class: 'entry-grid' }, ...drawings.map((entry, index) => entryCard(entry, index, winner))) : null,
  ].filter((node): node is HTMLElement => node !== null)
}

function liveBody(): HTMLElement {
  const time = h('strong', {})
  const entries = h('p', {})
  onLiveRound((live, now) => {
    time.textContent = clock(msLeft(live.round, now))
    const next = `Winner drops here at 0:00, then heads to the ${timeOfDay(live.finalEndsAt)} Final.`
    entries.textContent = live.entries === null ? next : `${count(live.entries, 'drawing')} so far. ${next}`
  })
  return h(
    'div',
    { class: 'live-card blob-d' },
    h('div', { class: 'live-card-copy' }, h('span', { class: 'live-card-time' }, time, ' left to draw'), entries),
    h('a', { href: DRAW_HREF, class: 'btn btn-big' }, 'Draw it', svg(icons.arrow)),
  )
}

function roundNav(number: number, live: boolean): HTMLElement {
  return h(
    'nav',
    { class: 'round-nav', 'aria-label': 'Other rounds' },
    number > 1 ? h('a', { href: roundHref(number - 1), class: 'btn btn-small' }, `← Round ${number - 1}`) : h('span'),
    live ? null : h('a', { href: roundHref(number + 1), class: 'btn btn-small' }, `Round ${number + 1} →`),
  )
}

function head(number: number, label: string, prompt: Node | string, live: boolean): HTMLElement {
  return h(
    'header',
    { class: 'round-head' },
    h('span', { class: 'round-label' }, live ? h('i', { class: 'live-dot' }) : null, `Round ${number} · ${label}`),
    h('h1', { class: 'prompt-text round-title' }, h('mark', {}, prompt)),
  )
}

function backLink(): HTMLElement {
  return h('a', { href: ROUNDS_HREF, class: 'back-link' }, '← Gallery')
}

function liveContent(number: number): Node[] {
  const prompt = h('span', {})
  onLiveRound((live) => {
    if (live.number === number) prompt.textContent = live.prompt
  })
  return [backLink(), head(number, 'live now', prompt, true), liveBody(), roundNav(number, true)]
}

function endedContent(result: RoundDetail): Node[] {
  return [backLink(), head(result.number, when(result.startsAt), result.prompt, false), ...endedBody(result), roundNav(result.number, false)]
}

function message(number: number, text: string): Node[] {
  return [backLink(), h('h1', { class: 'prompt-text round-title' }, text), roundNav(number, false)]
}

export function roundPage(number: number): HTMLElement {
  const page = h('section', { class: 'section round-page' })
  const round = roundAt(number)

  if (!Number.isInteger(number) || number < 1 || round > currentRound()) {
    page.append(backLink(), h('h1', { class: 'prompt-text round-title' }, 'That round hasn’t happened yet.'))
    return page
  }

  let shown = ''
  let final = false
  onRefresh(REFRESH_MS, (now) => {
    if (round >= currentRound(now)) {
      if (shown !== 'live') page.replaceChildren(...liveContent(number))
      shown = 'live'
      return
    }
    if (final) return
    roundDetail(round)
      .then((result) => {
        const key = result ? resultKey(result) : 'missing'
        if (key === shown) return
        shown = key
        final = result ? roundSettled(result) : true
        page.replaceChildren(...(result ? endedContent(result) : message(number, 'This round didn’t run.')))
      })
      .catch((error) => {
        if (!shown) page.replaceChildren(...message(number, messageOf(error)))
      })
  })
  return page
}
