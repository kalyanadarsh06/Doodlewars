import { TICKER } from '../config'
import { h, svg } from '../ui/dom'
import { icons } from '../ui/icons'
import { shortAddress } from '../util/format'
import { KNOWN_WALLETS } from '../wallet/catalog'
import { connect, disconnect, onWallet, type WalletOption } from '../wallet/wallet'

let dialog: HTMLDialogElement | null = null

function row(term: string, detail: string): HTMLElement {
  return h('div', { class: 'wallet-row' }, h('dt', {}, term), h('dd', {}, detail))
}

function installed(options: WalletOption[], error: HTMLElement): HTMLElement {
  const choose = async (option: WalletOption): Promise<void> => {
    error.textContent = ''
    try {
      await connect(option)
    } catch {
      error.textContent = 'Connection cancelled. Try again.'
    }
  }

  return h(
    'div',
    { class: 'wallet-list' },
    ...options.map((option) =>
      h(
        'button',
        { type: 'button', class: 'wallet-option', onclick: () => choose(option) },
        option.icon ? h('img', { src: option.icon, alt: '', width: 32, height: 32 }) : h('span', { class: 'wallet-icon' }, svg(icons.wallet)),
        h('span', { class: 'wallet-name' }, option.name),
        h('span', { class: 'wallet-tag' }, 'Connect'),
      ),
    ),
  )
}

function others(options: WalletOption[]): HTMLElement | null {
  const inApp = matchMedia('(pointer: coarse)').matches
  const wallets = KNOWN_WALLETS.filter((wallet) => !options.some((option) => option.id === wallet.id)).filter((wallet) => !inApp || wallet.openInApp)
  if (!wallets.length) return null
  return h(
    'div',
    { class: 'wallet-more' },
    h('p', { class: 'wallet-subtitle' }, inApp ? 'Open in your wallet app' : options.length ? 'Other wallets' : 'No wallet found. Get one:'),
    h(
      'div',
      { class: 'wallet-chips' },
      ...wallets.map((wallet) =>
        h(
          'a',
          { class: 'wallet-chip', href: inApp && wallet.openInApp ? wallet.openInApp(location.href) : wallet.install, target: inApp ? undefined : '_blank', rel: 'noopener' },
          h('img', { src: wallet.icon, alt: '', width: 24, height: 24 }),
          h('span', { class: 'wallet-name' }, wallet.name),
          h('span', { class: 'wallet-tag' }, inApp ? 'Open' : 'Install'),
        ),
      ),
    ),
  )
}

function picker(options: WalletOption[], error: HTMLElement): Node[] {
  return [
    h('h2', { class: 'wallet-title' }, 'Connect wallet'),
    h('p', { class: 'wallet-text' }, 'You need a wallet to enter. Prizes are sent to it automatically. Practice is free.'),
    options.length ? installed(options, error) : null,
    others(options),
  ].filter((node): node is HTMLElement => node !== null)
}

function account(address: string): Node[] {
  return [
    h('h2', { class: 'wallet-title' }, 'Your wallet'),
    h('dl', { class: 'wallet-rows' }, row('Address', shortAddress(address)), row(TICKER, 'Not live yet'), row('Prizes', 'Sent here automatically')),
    h('button', { type: 'button', class: 'btn btn-small', onclick: disconnect }, 'Disconnect'),
  ]
}

function walletDialog(): HTMLDialogElement {
  const body = h('div', { class: 'wallet-body' })
  const error = h('p', { class: 'wallet-error', role: 'alert' })
  const element = h(
    'dialog',
    { class: 'wallet-dialog blob-d', 'aria-label': 'Wallet' },
    h(
      'div',
      { class: 'wallet-card' },
      h('button', { type: 'button', class: 'wallet-close', 'aria-label': 'Close', onclick: () => element.close() }, '×'),
      body,
      error,
    ),
  )
  element.addEventListener('click', (event) => {
    if (event.target === element) element.close()
  })
  onWallet((state) => {
    if (state.address) error.textContent = ''
    body.replaceChildren(...(state.address ? account(state.address) : picker(state.options, error)))
  })
  document.body.append(element)
  return element
}

export function openWallet(): void {
  dialog ??= walletDialog()
  dialog.showModal()
}

export function walletButton(): HTMLElement {
  const label = h('span', { class: 'wallet-label' })
  const button = h('button', { type: 'button', class: 'btn wallet-btn', onclick: openWallet }, svg(icons.wallet), label)
  onWallet(({ address }) => {
    button.classList.toggle('is-connected', Boolean(address))
    button.setAttribute('aria-label', address ? `Wallet ${shortAddress(address)}` : 'Connect wallet')
    label.textContent = address ? shortAddress(address) : 'Connect wallet'
  })
  return button
}
