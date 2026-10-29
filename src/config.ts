export const INK = '#161616'
export const PALETTE = [
  { name: 'Ink', value: '#161616' },
  { name: 'Gray', value: '#9a9a90' },
  { name: 'Red', value: '#ee5d57' },
  { name: 'Orange', value: '#f1a55a' },
  { name: 'Yellow', value: '#f9d85e' },
  { name: 'Green', value: '#5cc08a' },
  { name: 'Sky', value: '#72c4ef' },
  { name: 'Blue', value: '#6e6cf3' },
  { name: 'Pink', value: '#f09aae' },
  { name: 'Brown', value: '#a8693a' },
] as const
export const BRUSH_SIZES = [4, 9, 16] as const
export const SHAPES = ['blob-a', 'blob-b', 'blob-c', 'blob-d'] as const
export const EXPORT_WIDTH = 1200
export const EXPORT_HEIGHT = 900
export const TITLE_MAX = 22
export const PROMPT_MIN = 3
export const PROMPT_MAX = 60

export const ROUND_MS = 5 * 60 * 1000
export const FINAL_ROUNDS = 6
export const FINAL_MS = ROUND_MS * FINAL_ROUNDS
export const GENESIS_MS = Date.UTC(2026, 9, 26)
export const TICKER = '$DOODLEWARS'
export const CONTRACT_ADDRESS: string | null = null
export const EXPLORER_URL = 'https://robinhoodchain.blockscout.com'
export const REPO_URL = 'https://github.com/kalyanadarsh06/Doodlewars'
