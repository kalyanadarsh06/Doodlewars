import { TICKER } from '../config'
import { JUDGE_NAME, JUDGE_SCORES } from '../content/judge'
import { pastRounds, resultKey } from '../game/results'
import { onRefresh } from '../game/ticker'
import { ROUNDS_HREF } from '../router'
import { h, ruleHeading } from '../ui/dom'
import { roundCard } from './roundcard'

const REFRESH_MS = 15 * 1000

const RULES = [
  `To compete, add a wallet holding any amount of ${TICKER}. We check it every time you submit.`,
  'One drawing per person per round. Submit before 0:00, and keep editing until then.',
  `${JUDGE_NAME} picks one winner per round: ${JUDGE_SCORES.join(', ').toLowerCase()}.`,
  'Every 6 rounds, the round winners face off. The champion gets the creator fees, sent straight to their wallet.',
  'Nobody draws? Those creator fees roll over to the next Final and keep stacking.',
  'Just want to draw? Tick “Just for fun”. You’ll show up in the gallery, not the judging.',
] as const

export function houseRules(): HTMLElement {
  const last = h('div', { class: 'info-last' })
  let shown = ''
  onRefresh(REFRESH_MS, () => {
    pastRounds(1)
      .then(([result]) => {
        const key = result ? resultKey(result) : 'none'
        if (key === shown) return
        shown = key
        last.replaceChildren(result ? roundCard(result) : h('p', { class: 'empty-note' }, 'The first round is underway.'))
      })
      .catch(() => undefined)
  })

  return h(
    'section',
    { class: 'round-info-strip', 'aria-label': 'House rules' },
    h('div', { class: 'info-block' }, ruleHeading('House rules'), h('ul', { class: 'quick-rules' }, ...RULES.map((rule) => h('li', {}, rule)))),
    h('div', { class: 'info-block' }, ruleHeading('Last round'), last, h('a', { href: ROUNDS_HREF, class: 'info-link' }, 'See every round →')),
  )
}
