import { TICKER, WINNER_SHARE } from '../config'
import { JUDGE_NAME } from '../content/judge'
import { roundResult } from '../game/results'
import { currentRound } from '../game/round'
import { onTick } from '../game/ticker'
import { ROUNDS_HREF } from '../router'
import { h, ruleHeading } from '../ui/dom'
import { roundCard } from './roundcard'

const RULES = [
  `Hold any amount of ${TICKER} to enter`,
  'One drawing per round, before the timer ends',
  `${JUDGE_NAME} picks one winner`,
  `The winner gets ${WINNER_SHARE}% of the round’s fees, paid automatically`,
] as const

export function roundInfo(): HTMLElement {
  const last = h('div', { class: 'info-last' })
  let shown = 0
  onTick((now) => {
    const round = currentRound(now)
    if (round === shown) return
    shown = round
    last.replaceChildren(roundCard(roundResult(round - 1, now)))
  })

  return h(
    'section',
    { class: 'round-info-strip', 'aria-label': 'Round info' },
    h('div', { class: 'info-block' }, ruleHeading('How a round works'), h('ul', { class: 'quick-rules' }, ...RULES.map((rule) => h('li', {}, rule)))),
    h('div', { class: 'info-block' }, ruleHeading('Last round'), last, h('a', { href: ROUNDS_HREF, class: 'info-link' }, 'See every round →')),
  )
}
