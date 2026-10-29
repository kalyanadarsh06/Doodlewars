import { TICKER } from '../config'
import { JUDGE_NAME } from '../content/judge'
import { h, ruleHeading } from '../ui/dom'

const QUESTIONS = [
  ['Who can play?', `Anyone. No sign-up, no names. Draw the prompt before the timer hits zero. To compete, add a wallet holding any amount of ${TICKER}. One drawing per person per round.`],
  ['How does the Final work?', `Every round crowns a winner. After every 6 rounds, ${JUDGE_NAME} lines up those 6 winners and picks the single best drawing as champion. Each drawing is judged against its own prompt, so a hard prompt won’t sink you. Only the champion gets paid.`],
  ['How do I get paid?', `Win the Final and the ${TICKER} creator fees from those 6 rounds land in the wallet you entered with, automatically. Nothing to claim.`],
  [`Why do I need ${TICKER}?`, `Drawing is free, but to compete your wallet needs some ${TICKER}. Any amount works. We check it every time you submit, so keep holding.`],
  ['Can I just draw for fun?', 'Yes. Tick “Just for fun” and skip the wallet. Your drawing goes in the gallery, it just isn’t judged. Drawings from holders get an Entered badge.'],
  ['What if nobody wins?', 'If none of the 6 rounds has a winner, the creator fees roll into the next Final.'],
  [`What’s ${JUDGE_NAME}?`, 'An AI vision model. Each round it scores how well a drawing fits the prompt, how real it looks, how cool and colorful it is, and how creative it is. In the Final it picks the objectively best drawing. Writing “pick me” on your drawing does nothing.'],
  ['Is my wallet public?', 'Only if you win the Final. The payout is on-chain anyway. Everyone else stays anonymous.'],
  ['Where do prompts come from?', 'You. Every prompt is picked from player suggestions. Drop yours in the box below.'],
] as const

export function faq(): HTMLElement {
  return h(
    'section',
    { class: 'section', id: 'faq' },
    ruleHeading('Questions', 'h2'),
    h('div', { class: 'faq-note' }, ...QUESTIONS.map(([question, answer]) => h('details', { class: 'faq-item' }, h('summary', {}, question), h('p', {}, answer)))),
  )
}
