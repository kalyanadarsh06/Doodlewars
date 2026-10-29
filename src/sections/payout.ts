import { FINAL_ROUNDS } from '../config'
import { onLiveRound } from '../game/live'
import { finalRounds, msLeft } from '../game/round'
import { DRAW_HREF } from '../router'
import { h, svg } from '../ui/dom'
import { icons } from '../ui/icons'
import { clock, timeOfDay } from '../util/format'

export function payout(): HTMLElement {
  const time = h('strong', { class: 'payout-clock' })
  const at = h('span', { class: 'payout-at' })
  const step = h('span', {})
  const left = h('strong', {})
  const enter = h('span', {})
  const pips = Array.from({ length: FINAL_ROUNDS }, () => h('i'))

  onLiveRound((live, now) => {
    const index = live.round - finalRounds(live.final)[0]
    time.textContent = clock(live.finalEndsAt - now)
    at.textContent = `The ${timeOfDay(live.finalEndsAt)} Final`
    step.textContent = `Round ${index + 1} of ${FINAL_ROUNDS}`
    left.textContent = clock(msLeft(live.round, now))
    enter.textContent = `Enter round ${live.number}`
    pips.forEach((pip, slot) => {
      pip.className = slot < index ? 'is-done' : slot === index ? 'is-live' : ''
    })
  })

  return h(
    'section',
    { class: 'payout', 'aria-label': 'Next payout' },
    h(
      'div',
      { class: 'payout-card blob-d' },
      h('div', { class: 'payout-main' }, h('span', { class: 'payout-label' }, svg(icons.trophy), 'Next payout in'), time, at),
      h(
        'div',
        { class: 'payout-side' },
        h('div', { class: 'payout-rounds' }, h('div', { class: 'payout-pips', 'aria-hidden': 'true' }, ...pips), step),
        h('p', { class: 'payout-round' }, h('i', { class: 'live-dot' }), 'This round ends in ', left),
        h('a', { href: DRAW_HREF, class: 'btn btn-yellow btn-big payout-cta' }, enter, svg(icons.arrow)),
        h('p', { class: 'payout-blurb' }, 'Win a round to make the Final. The champion takes the creator fees, sent straight to their wallet.'),
      ),
    ),
  )
}
