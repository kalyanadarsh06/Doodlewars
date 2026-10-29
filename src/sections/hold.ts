import { TICKER } from '../config'
import { h, svg } from '../ui/dom'
import { icons } from '../ui/icons'
import { contractAddress } from './contract'

export const HOLD_RULE = `Hold any amount of ${TICKER} to compete.`

export function holdNotice(detail: string): HTMLElement {
  return h(
    'div',
    { class: 'hold-notice', role: 'note' },
    svg(icons.wallet),
    h('p', {}, h('strong', {}, `Hold ${TICKER} to compete`), h('span', {}, detail, ' ', contractAddress())),
  )
}
