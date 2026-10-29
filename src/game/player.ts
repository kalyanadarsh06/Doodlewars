import { readStored, writeStored } from '../util/storage'

export interface SavedEntry {
  token: string
  round: number
  title: string
  entered: boolean
}

const ENTRIES_KEY = 'doodlewars:entries'
const WALLET_KEY = 'doodlewars:wallet'
const KEEP = 30

function savedEntries(): SavedEntry[] {
  const entries = readStored<unknown>(ENTRIES_KEY, [])
  return Array.isArray(entries) ? (entries as SavedEntry[]) : []
}

export function saveEntry(entry: SavedEntry): void {
  writeStored(ENTRIES_KEY, [entry, ...savedEntries().filter((saved) => saved.round !== entry.round)].slice(0, KEEP))
}

export function savedEntry(round: number): SavedEntry | null {
  return savedEntries().find((entry) => entry.round === round) ?? null
}

function savedText(key: string): string {
  const value = readStored<unknown>(key, '')
  return typeof value === 'string' ? value : ''
}

export function savedWallet(): string {
  return savedText(WALLET_KEY)
}

export function saveWallet(wallet: string): void {
  writeStored(WALLET_KEY, wallet)
}

export function isWallet(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value)
}
