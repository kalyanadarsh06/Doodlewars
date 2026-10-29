export interface Transfer {
  to: string
  value: bigint
}

export function feesBetween(previousBalance: bigint, balance: bigint, outflow: bigint): bigint {
  const fees = balance - previousBalance + outflow
  return fees > 0n ? fees : 0n
}
