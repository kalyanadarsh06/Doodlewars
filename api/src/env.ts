import { isAddress } from 'viem'

export interface Env {
  DB: D1Database
  IMAGES: R2Bucket
  TOKEN_ADDRESS: string
  OWNER_WALLET: string
  MIN_HOLD: string
  JUDGE_MODEL: string
  RPC_URL: string
  PAYOUT_PRIVATE_KEY?: string
  ANTHROPIC_API_KEY?: string
  ANTHROPIC_BASE_URL?: string
  ADMIN_TOKEN?: string
  IP_SALT?: string
}

export function isLive(env: Env): boolean {
  return env.TOKEN_ADDRESS !== '' && isAddress(env.OWNER_WALLET) && Boolean(env.PAYOUT_PRIVATE_KEY)
}
