import { DOODLES } from '../content/doodles'
import { SKETCH } from '../content/ghost'
import { PROMPTS } from '../content/themes'
import { onLiveRound } from '../game/live'
import { msLeft } from '../game/round'
import { DRAW_HREF } from '../router'
import { h, svg } from '../ui/dom'
import { icons } from '../ui/icons'
import { clock } from '../util/format'
import { contractAddress } from './contract'
import { HOLD_RULE } from './hold'

const HIGHLIGHT = `<svg class="highlight" viewBox="0 0 200 80" preserveAspectRatio="none" fill="none" stroke="currentColor" stroke-width="30" stroke-linecap="round" aria-hidden="true"><path pathLength="1" d="M10 34c48-8 132-12 180-4M14 56c56-8 120-10 172-2"/></svg>`

const SQUIGGLE = `<svg class="squiggle" viewBox="0 0 300 24" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" aria-hidden="true"><path pathLength="1" d="M6 16c30-10 50 6 80-2s48-10 76 0 52 8 80-2 36-6 52 0"/></svg>`

const LETTER_MS = 70

function written(text: string, start: number): HTMLElement[] {
  return [...text].map((letter, index) =>
    h('span', { class: letter === ' ' ? 'ink ink-gap' : 'ink', style: `--delay: ${(start + index) * LETTER_MS}ms` }, letter),
  )
}

function headline(): HTMLElement {
  return h(
    'h1',
    { class: 'headline', 'aria-label': 'Draw to get paid.' },
    h('span', { class: 'headline-line', 'aria-hidden': 'true' }, ...written('Draw to', 0)),
    h(
      'span',
      { class: 'headline-line', 'aria-hidden': 'true' },
      ...written('get ', 7),
      h('em', {}, svg(HIGHLIGHT), ...written('paid', 11), svg(SQUIGGLE)),
      ...written('.', 15),
    ),
  )
}

function collage(): HTMLElement {
  const time = h('strong', {})
  const label = h('span', {})
  const prompt = h('p', {})
  const final = h('span', {})
  onLiveRound((live, now) => {
    time.textContent = clock(msLeft(live.round, now))
    label.textContent = `Round ${live.number} · draw this`
    prompt.textContent = live.prompt
    final.textContent = `Final in ${clock(live.finalEndsAt - now)}`
  })

  return h(
    'div',
    { class: 'collage' },
    h('div', { class: 'collage-card blob-d', 'aria-hidden': 'true' }, svg(SKETCH)),
    h('div', { class: 'sticker sticker-prompt blob-d', 'aria-hidden': 'true' }, label, prompt),
    h('div', { class: 'sticker sticker-timer blob-c', 'aria-hidden': 'true' }, time, h('span', {}, 'left')),
    h('div', { class: 'sticker sticker-prize', 'aria-hidden': 'true' }, h('span', { class: 'prize-coin' }, '$'), final),
    h('div', { class: 'floater floater-a', 'aria-hidden': 'true' }, svg(DOODLES[1].svg)),
    h('div', { class: 'floater floater-b', 'aria-hidden': 'true' }, svg(DOODLES[6].svg)),
    h('div', { class: 'floater floater-c', 'aria-hidden': 'true' }, svg(DOODLES[2].svg)),
  )
}

function marquee(): HTMLElement {
  const items = (): HTMLElement[] => PROMPTS.flatMap((prompt) => [h('span', {}, prompt), h('span', { class: 'marquee-star' }, '✶')])
  return h('div', { class: 'marquee', 'aria-hidden': 'true' }, h('div', { class: 'marquee-track' }, ...items(), ...items()))
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
        h('div', { class: 'kicker' }, contractAddress()),
        headline(),
        h(
          'p',
          { class: 'lede' },
          'New prompt every 5 minutes. You draw, the AI judges. ',
          h('mark', {}, 'Every 6 rounds, the champion takes the creator fees.'),
        ),
        h(
          'div',
          { class: 'landing-actions' },
          h('a', { href: DRAW_HREF, class: 'btn btn-yellow btn-big' }, 'Draw now', svg(icons.arrow)),
          h('a', { href: '#how', class: 'btn' }, 'How it works'),
        ),
        h('p', { class: 'landing-hold' }, svg(icons.wallet), HOLD_RULE),
      ),
      collage(),
    ),
    marquee(),
  )
}
