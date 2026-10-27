interface Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
  on?(event: string, listener: (value: unknown) => void): void
  removeListener?(event: string, listener: (value: unknown) => void): void
}

interface Announcement {
  info: { uuid: string; name: string; icon: string; rdns: string }
  provider: Provider
}

declare global {
  interface WindowEventMap {
    'eip6963:announceProvider': CustomEvent<Announcement>
  }

  interface Window {
    ethereum?: Provider
  }
}

export interface WalletOption {
  id: string
  name: string
  icon: string
  provider: Provider
}

export interface WalletState {
  address: string | null
  options: WalletOption[]
}

type Listener = (state: WalletState) => void

const STORAGE_KEY = 'doodlewars:wallet'
const options = new Map<string, WalletOption>()
const listeners = new Set<Listener>()
let active: WalletOption | null = null
let address: string | null = null

function remembered(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function remember(id: string | null): void {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    return
  }
}

function emit(): void {
  const state: WalletState = { address, options: [...options.values()] }
  listeners.forEach((listener) => listener(state))
}

function firstAccount(accounts: unknown): string | null {
  return Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : null
}

function onAccounts(accounts: unknown): void {
  const next = firstAccount(accounts)
  if (!next) return disconnect()
  address = next
  emit()
}

function use(option: WalletOption, accounts: unknown): void {
  const next = firstAccount(accounts)
  if (!next) return
  if (active !== option) {
    active?.provider.removeListener?.('accountsChanged', onAccounts)
    option.provider.on?.('accountsChanged', onAccounts)
  }
  active = option
  address = next
  remember(option.id)
  emit()
}

function add(option: WalletOption): void {
  options.set(option.id, option)
  if (!active && option.id === remembered()) {
    option.provider
      .request({ method: 'eth_accounts' })
      .then((accounts) => use(option, accounts))
      .catch(() => undefined)
  }
  emit()
}

export function onWallet(listener: Listener): () => void {
  listeners.add(listener)
  listener({ address, options: [...options.values()] })
  return () => {
    listeners.delete(listener)
  }
}

export async function connect(option: WalletOption): Promise<void> {
  use(option, await option.provider.request({ method: 'eth_requestAccounts' }))
}

export function disconnect(): void {
  active?.provider.removeListener?.('accountsChanged', onAccounts)
  active = null
  address = null
  remember(null)
  emit()
}

export function discoverWallets(): void {
  window.addEventListener('eip6963:announceProvider', ({ detail }) =>
    add({ id: detail.info.rdns, name: detail.info.name, icon: detail.info.icon, provider: detail.provider }),
  )
  window.dispatchEvent(new Event('eip6963:requestProvider'))
  if (window.ethereum && options.size === 0) add({ id: 'injected', name: 'Browser wallet', icon: '', provider: window.ethereum })
}
