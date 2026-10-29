export interface Transfer {
  to: string
  value: bigint
}

export interface Split {
  tax: bigint
  creator: bigint
}

export function feesBetween(previousBalance: bigint, balance: bigint, outflow: bigint): bigint {
  const fees = balance - previousBalance + outflow
  return fees > 0n ? fees : 0n
}

export function houseCut(fees: bigint, split: Split): bigint {
  const total = split.tax + split.creator
  return total > 0n ? (fees * split.tax) / total : 0n
}
