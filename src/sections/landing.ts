import { TICKER, WINNER_SHARE } from '../config'
import { DOODLES } from '../content/doodles'
import { PROMPTS } from '../content/themes'
import { currentRound, msLeft, promptFor } from '../game/round'
import { onTick } from '../game/ticker'
import { DRAW_HREF } from '../router'
import { h, svg } from '../ui/dom'
import { icons } from '../ui/icons'
import { clock } from '../util/format'
import { contractAddress } from './contract'

const SKETCH = `<svg class="sketch" viewBox="0 0 300 220" fill="none" stroke="#161616" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path pathLength="1" d="M96 166c-8-62 20-114 58-118 7-8 17-8 24 0 38 8 58 54 52 98-2 14-14 20-30 20z"/><path pathLength="1" d="M34 82c-6 16 6 46 22 52 13 5 23-6 18-19-5-13-13-21-17-33-5-14-18-13-23 0z"/><path pathLength="1" d="M148 128c8 9 22 9 30 0"/><circle class="eye" cx="146" cy="110" r="6" fill="#161616" stroke="none"/><circle class="eye" cx="180" cy="110" r="6" fill="#161616" stroke="none"/></svg>`

const SQUIGGLE = `<svg class="squiggle" viewBox="0 0 300 24" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" aria-hidden="true"><path pathLength="1" d="M6 16c30-10 50 6 80-2s48-10 76 0 52 8 80-2 36-6 52 0"/></svg>`

const STATS = ['new prompt every 5 min', 'draw until the timer ends', `winner gets ${WINNER_SHARE}% of fees`] as const

function collage(): HTMLElement {
  const time = h('strong', {})
  const prompt = h('p', {})
  onTick((now) => {
    const round = currentRound(now)
    time.textContent = clock(msLeft(round, now))
    prompt.textContent = promptFor(round)
  })

  return h(
    'div',
    { class: 'collage' },
    h(
      'div',
      { class: 'collage-card blob-d' },
      h('div', { class: 'card-bar' }, contractAddress(), h('span', { class: 'card-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'))),
      h('div', { class: 'card-canvas', 'aria-hidden': 'true' }, svg(SKETCH)),
    ),
    h('div', { class: 'sticker sticker-timer blob-c', 'aria-hidden': 'true' }, time, h('span', {}, 'left')),
    h('div', { class: 'sticker sticker-prompt blob-d', 'aria-hidden': 'true' }, h('span', {}, 'This round'), prompt),
    h('div', { class: 'sticker sticker-prize', 'aria-hidden': 'true' }, h('span', { class: 'prize-coin' }, '$'), `${WINNER_SHARE}% to the winner`),
    h('div', { class: 'floater floater-a', 'aria-hidden': 'true' }, svg(DOODLES[1].svg)),
    h('div', { class: 'floater floater-b', 'aria-hidden': 'true' }, svg(DOODLES[6].svg)),
    h('div', { class: 'floater floater-c', 'aria-hidden': 'true' }, svg(DOODLES[2].svg)),
  )
}

function marquee(): HTMLElement {
  const track = (): HTMLElement =>
    h('div', { class: 'marquee-track' }, ...PROMPTS.flatMap((prompt) => [h('span', {}, prompt), h('span', { class: 'marquee-star' }, '✶')]))
  return h('div', { class: 'marquee', 'aria-hidden': 'true' }, track(), track())
}

export function landing(): HTMLElement {
  return h(
    'section',
    { class: 'landing', id: 'top' },
    h(
      'div',
      { class: 'landing-inner' },
      h(
        'div',
        { class: 'landing-copy' },
        h('p', { class: 'kicker' }, h('i', { class: 'live-dot' }), 'New prompt every 5 minutes'),
        h('h1', { class: 'headline' }, h('span', {}, 'Draw to.'), h('span', {}, 'Get ', h('em', {}, 'paid', svg(SQUIGGLE)), '.')),
        h(
          'p',
          { class: 'lede' },
          `A new prompt every 5 minutes. Hold ${TICKER} and draw it before the timer runs out. `,
          h('mark', {}, `The best drawing wins ${WINNER_SHARE}% of the fees traded that round.`),
        ),
        h(
          'div',
          { class: 'landing-actions' },
          h('a', { href: DRAW_HREF, class: 'btn btn-yellow btn-big' }, 'Draw now', svg(icons.arrow)),
          h('a', { href: '#how', class: 'btn' }, 'How it works'),
        ),
        h('ul', { class: 'stats' }, ...STATS.map((stat) => h('li', {}, stat))),
      ),
      collage(),
    ),
    marquee(),
  )
}
