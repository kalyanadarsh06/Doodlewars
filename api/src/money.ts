export interface Transfer {
  to: string
  value: bigint
}

export function feesBetween(previousBalance: bigint, balance: bigint, outflow: bigint): bigint {
  const fees = balance - previousBalance + outflow
  return fees > 0n ? fees : 0n
}

export function toUsd(wei: bigint, ethUsd: number | null): number | null {
  if (ethUsd === null) return null
  return Math.round((Number(wei) / 1e18) * ethUsd * 100) / 100
}
