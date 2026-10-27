import { CONTRACT_ADDRESS } from '../config'
import { h, svg } from '../ui/dom'
import { icons } from '../ui/icons'
import { shortAddress } from '../util/format'

const RESET_MS = 1600

export function contractAddress(): HTMLElement {
  const address = CONTRACT_ADDRESS
  if (!address) return h('span', { class: 'ca' }, 'CA: coming soon')
  const text = h('span', {}, `CA: ${shortAddress(address)}`)
  const flash = (message: string): void => {
    text.textContent = message
    window.setTimeout(() => (text.textContent = `CA: ${shortAddress(address)}`), RESET_MS)
  }
  return h(
    'button',
    {
      type: 'button',
      class: 'ca ca-copy',
      title: address,
      'aria-label': `Copy contract address ${address}`,
      onclick: () => navigator.clipboard.writeText(address).then(() => flash('Copied!'), () => flash(address)),
    },
    text,
    svg(icons.copy),
  )
}
