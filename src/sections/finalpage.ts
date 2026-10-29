import { messageOf } from '../api/client'
import { EXPLORER_URL } from '../config'
import { JUDGE_NAME } from '../content/judge'
import { onLiveRound } from '../game/live'
import { finalDetail, finalKey, finalSettled, type Champion, type FinalResult, type Payout } from '../game/results'
import { currentRound, finalAt, finalOf } from '../game/round'
import { onRefresh } from '../game/ticker'
import { DRAW_HREF, finalHref, ROUNDS_HREF } from '../router'
import { h, ruleHeading, svg } from '../ui/dom'
import { icons } from '../ui/icons'
import { clock, count, drawingTitle, shortAddress, timeOfDay } from '../util/format'
import { finalistCard, finalWindow } from './finalcard'
import { judgeNote } from './judgenote'
import { drawingImage } from './roundcard'

const REFRESH_MS = 10 * 1000

function txLink(tx: string | null): HTMLElement | null {
  return tx ? h('a', { href: `${EXPLORER_URL}/tx/${tx}`, target: '_blank', rel: 'noopener', class: 'tx-link' }, 'View transaction') : null
}

function payoutNote(result: FinalResult, champion: Champion): HTMLElement {
  const to = champion.wallet ? shortAddress(champion.wallet) : 'the champion’s wallet'
  const payout: Payout | null = result.payout
  if (!payout) return h('p', { class: 'payout-note' }, 'No creator fees came in this time, so there was nothing to send.')
  switch (payout.state) {
    case 'sending':
      return h('p', { class: 'payout-note' }, `Sending to ${to} now. `, txLink(payout.tx))
    case 'paid':
      return h('p', { class: 'payout-note' }, `Creator fees sent to ${to} automatically. `, txLink(payout.tx))
    case 'failed':
      return h('p', { class: 'payout-note' }, 'Transfer failed. We’re on it and will resend.')
    case 'unpaid':
      return h('p', { class: 'payout-note' }, 'The fees were too small to cover the network cost, so nothing was sent.')
  }
}

function championCard(result: FinalResult, champion: Champion): HTMLElement {
  return h(
    'div',
    { class: 'winner-card' },
    h('div', { class: 'winner-art' }, drawingImage(champion)),
    h(
      'div',
      { class: 'winner-info' },
      h('span', { class: 'winner-kicker' }, '★ Champion'),
      h('h2', { class: 'winner-title' }, drawingTitle(champion)),
      h('p', { class: 'winner-by' }, `Won round ${champion.roundNumber}`, prompt(result, champion), ', then beat every other round winner.'),
      judgeNote(result.note),
      payoutNote(result, champion),
    ),
  )
}

function prompt(result: FinalResult, champion: Champion): string {
  const text = result.rounds.find((round) => round.round === champion.round)?.prompt
  return text ? ` with “${text}”` : ''
}

function noticeCard(kicker: string, title: string, ...body: (Node | null)[]): HTMLElement {
  return h('div', { class: 'winner-card is-empty' }, h('div', { class: 'winner-info' }, h('span', { class: 'winner-kicker' }, kicker), h('h2', { class: 'winner-title' }, title), ...body))
}

function liveCard(result: FinalResult): HTMLElement {
  const time = h('strong', {})
  onLiveRound((live, now) => {
    if (live.final !== result.final) return
    time.textContent = clock(result.endsAt - now)
  })
  return h(
    'div',
    { class: 'live-card blob-d' },
    h(
      'div',
      { class: 'live-card-copy' },
      h('span', { class: 'live-card-time' }, 'Final in ', time),
      h('p', {}, 'Win a round to make it in. The champion takes the creator fees.'),
    ),
    h('a', { href: DRAW_HREF, class: 'btn btn-big' }, 'Draw now', svg(icons.arrow)),
  )
}

function summary(result: FinalResult): HTMLElement {
  if (result.status === 'live') return liveCard(result)
  const finalists = result.rounds.filter((round) => round.winner).length
  if (result.status === 'judging') {
    return noticeCard('Judging', `${JUDGE_NAME} is comparing ${count(finalists, 'round winner')}.`, h('p', { class: 'payout-note' }, 'Champion drops here in a minute or two. No need to refresh.'))
  }
  if (result.champion) return championCard(result, result.champion)
  return noticeCard('No champion', 'No round had a winner.', judgeNote(result.note), h('p', { class: 'payout-note' }, 'Nobody won this Final, so its creator fees roll over to the next one.'))
}

function head(result: FinalResult): HTMLElement {
  const live = result.status === 'live'
  return h(
    'header',
    { class: 'round-head' },
    h('span', { class: 'round-label' }, live ? h('i', { class: 'live-dot' }) : null, `Final ${result.number} · ${finalWindow(result)}`),
    h('h1', { class: 'prompt-text round-title' }, h('mark', {}, live ? `Final at ${timeOfDay(result.endsAt)}` : `The ${timeOfDay(result.endsAt)} Final`)),
  )
}

function backLink(): HTMLElement {
  return h('a', { href: ROUNDS_HREF, class: 'back-link' }, '← Gallery')
}

function finalNav(number: number, live: boolean): HTMLElement {
  return h(
    'nav',
    { class: 'round-nav', 'aria-label': 'Other Finals' },
    number > 1 ? h('a', { href: finalHref(number - 1), class: 'btn btn-small' }, `← Final ${number - 1}`) : h('span'),
    live ? null : h('a', { href: finalHref(number + 1), class: 'btn btn-small' }, `Final ${number + 1} →`),
  )
}

function content(result: FinalResult): Node[] {
  return [
    backLink(),
    head(result),
    summary(result),
    ruleHeading('The rounds', 'h2'),
    h('p', { class: 'section-lede' }, 'Six rounds, six winners. Each one judged on its own prompt.'),
    h('div', { class: 'finalist-grid' }, ...result.rounds.map((round) => finalistCard(round, result.champion))),
    finalNav(result.number, result.status === 'live'),
  ].filter((node): node is HTMLElement => node !== null)
}

function message(number: number, text: string): Node[] {
  return [backLink(), h('h1', { class: 'prompt-text round-title' }, text), finalNav(number, false)]
}

export function finalPage(number: number): HTMLElement {
  const page = h('section', { class: 'section round-page final-page' })
  const final = finalAt(number)

  if (!Number.isInteger(number) || number < 1 || final > finalOf(currentRound())) {
    page.append(backLink(), h('h1', { class: 'prompt-text round-title' }, 'That Final hasn’t happened yet.'))
    return page
  }

  let shown = ''
  let settled = false
  onRefresh(REFRESH_MS, () => {
    if (settled) return
    finalDetail(final)
      .then((result) => {
        const key = result ? finalKey(result) : 'missing'
        if (key === shown) return
        shown = key
        settled = result ? finalSettled(result) : true
        page.replaceChildren(...(result ? content(result) : message(number, 'This Final didn’t run.')))
      })
      .catch((error) => {
        if (!shown) page.replaceChildren(...message(number, messageOf(error)))
      })
  })
  return page
}
