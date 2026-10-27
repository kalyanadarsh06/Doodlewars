export interface KnownWallet {
  id: string
  name: string
  icon: string
  install: string
  openInApp?: (url: string) => string
}

export const KNOWN_WALLETS: readonly KnownWallet[] = [
  {
    id: 'io.metamask',
    name: 'MetaMask',
    icon: 'wallets/metamask.svg',
    install: 'https://metamask.io/download/',
    openInApp: (url) => `https://metamask.app.link/dapp/${url.replace(/^https?:\/\//, '')}`,
  },
  {
    id: 'com.trustwallet.app',
    name: 'Trust Wallet',
    icon: 'wallets/trust.svg',
    install: 'https://trustwallet.com/download',
    openInApp: (url) => `https://link.trustwallet.com/open_url?coin_id=20000714&url=${encodeURIComponent(url)}`,
  },
  {
    id: 'com.coinbase.wallet',
    name: 'Coinbase Wallet',
    icon: 'wallets/coinbase.svg',
    install: 'https://www.coinbase.com/wallet/downloads',
    openInApp: (url) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`,
  },
  {
    id: 'app.phantom',
    name: 'Phantom',
    icon: 'wallets/phantom.svg',
    install: 'https://phantom.com/download',
    openInApp: (url) => `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(url)}`,
  },
  {
    id: 'com.okex.wallet',
    name: 'OKX Wallet',
    icon: 'wallets/okx.svg',
    install: 'https://www.okx.com/web3',
    openInApp: (url) => `okx://wallet/dapp/url?dappUrl=${encodeURIComponent(url)}`,
  },
  { id: 'io.rabby', name: 'Rabby', icon: 'wallets/rabby.svg', install: 'https://rabby.io' },
  {
    id: 'com.binance.wallet',
    name: 'Binance Wallet',
    icon: 'wallets/binance.svg',
    install: 'https://www.binance.com/en/web3wallet',
  },
]
