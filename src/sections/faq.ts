import { TICKER, WINNER_SHARE } from '../config'
import { JUDGE_NAME } from '../content/judge'
import { h, ruleHeading } from '../ui/dom'

const QUESTIONS = [
  ['Who can enter?', `Anyone holding ${TICKER}, any amount. Your wallet is checked when you submit. One drawing per wallet per round.`],
  ['Where do prompts come from?', 'Anyone can suggest one. Every round, one gets picked at random. Until launch, they come from our starter list.'],
  [`How does ${JUDGE_NAME} pick?`, 'It picks the drawing that fits the prompt best. Creativity and effort count. Words written in the drawing don’t.'],
  ['How do I get paid?', `Automatically. When you win, ${WINNER_SHARE}% of the fees traded that round are sent to the wallet you entered with.`],
  ['What if nobody enters?', 'The prize rolls into the next round.'],
  ['Can I play for free?', 'Yes. Practice mode lets anyone draw the live prompt. Practice drawings can’t win.'],
  ['How do I suggest a prompt?', 'Use the Suggest a prompt box on the home page or the draw page. No wallet needed. Keep it simple, like “a whale wearing sunglasses”.'],
] as const

export function faq(): HTMLElement {
  return h(
    'section',
    { class: 'section', id: 'faq' },
    ruleHeading('Questions', 'h2'),
    h('div', { class: 'faq-note' }, ...QUESTIONS.map(([question, answer]) => h('details', { class: 'faq-item' }, h('summary', {}, question), h('p', {}, answer)))),
  )
}
