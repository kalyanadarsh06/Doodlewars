export interface Env {
  DB: D1Database
  IMAGES: R2Bucket
  TOKEN_ADDRESS: string
  MIN_HOLD: string
  MIN_PAYOUT_WEI: string
  JUDGE_MODEL: string
  PRICE_URL: string
  RPC_URL: string
  PAYOUT_PRIVATE_KEY?: string
  ANTHROPIC_API_KEY?: string
  ANTHROPIC_BASE_URL?: string
  ADMIN_TOKEN?: string
  IP_SALT?: string
}

export function isLive(env: Env): boolean {
  return env.TOKEN_ADDRESS !== '' && Boolean(env.PAYOUT_PRIVATE_KEY)
}
