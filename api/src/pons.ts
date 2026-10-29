import { encodeAbiParameters, isAddressEqual, keccak256, parseAbi, zeroAddress, type Abi, type Address, type Hex } from 'viem'
import type { Chain } from './chain'
import { RECEIPT_WAIT_MS } from './constants'
import type { Split } from './money'

export const PONS = {
  factory: '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e',
  hook: '0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044',
  escrow: '0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e',
} as const

const BPS = 10_000n

const FACTORY = parseAbi([
  'function getLaunchedToken(address token) view returns (address, address, address, address, address, uint256, uint256, int24, uint256, uint256, uint256, uint256, uint256, uint256, uint256)',
  'function getLaunchFeePolicy(address token) view returns (address, uint16, uint16, uint16, uint16)',
])

const CURVE = parseAbi([
  'function graduated() view returns (bool)',
  'function quoteFeeBalance() view returns (uint256)',
  'function creatorTaxBalance() view returns (uint256)',
  'function sweepFees(uint256 minBuybackTokensOut)',
])

const HOOK = parseAbi(['function sweepPoolFees(bytes32 poolId, uint256 minConversionQuoteOut, uint256 minBuybackTokensOut)'])

const ESCROW = parseAbi(['function balanceOf(address recipient) view returns (uint256)', 'function claim()'])

interface Launch {
  token: Address
  curve: Address
  recipient: Address
  pair: Address
  tickSpacing: number
  graduated: boolean
}

async function launchOf(chain: Chain, token: Address): Promise<Launch> {
  const record = await chain.client.readContract({ address: PONS.factory, abi: FACTORY, functionName: 'getLaunchedToken', args: [token] })
  const graduated = await chain.client.readContract({ address: record[1], abi: CURVE, functionName: 'graduated' })
  return { token, curve: record[1], recipient: record[3], pair: record[4], tickSpacing: record[7], graduated }
}

function poolId(launch: Launch): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'address' }, { type: 'uint24' }, { type: 'int24' }, { type: 'address' }],
      [zeroAddress, launch.token, 0, launch.tickSpacing, PONS.hook],
    ),
  )
}

async function busy(chain: Chain): Promise<boolean> {
  const { address } = chain.wallet.account
  const [mined, pending] = await Promise.all([
    chain.client.getTransactionCount({ address, blockTag: 'latest' }),
    chain.client.getTransactionCount({ address, blockTag: 'pending' }),
  ])
  return pending > mined
}

async function execute(chain: Chain, call: { address: Address; abi: Abi; functionName: string; args?: readonly unknown[] }): Promise<boolean> {
  try {
    const { request } = await chain.client.simulateContract({ ...call, account: chain.wallet.account })
    const hash = await chain.wallet.writeContract(request)
    const receipt = await chain.client.waitForTransactionReceipt({ hash, timeout: RECEIPT_WAIT_MS })
    return receipt.status === 'success'
  } catch (error) {
    console.error(`pons ${call.functionName} skipped`, error)
    return false
  }
}

async function sweep(chain: Chain, launch: Launch): Promise<void> {
  if (launch.graduated) {
    await execute(chain, { address: PONS.hook, abi: HOOK, functionName: 'sweepPoolFees', args: [poolId(launch), 0n, 0n] })
    return
  }
  const [fees, tax] = await Promise.all([
    chain.client.readContract({ address: launch.curve, abi: CURVE, functionName: 'quoteFeeBalance' }),
    chain.client.readContract({ address: launch.curve, abi: CURVE, functionName: 'creatorTaxBalance' }),
  ])
  if (fees + tax > 0n) await execute(chain, { address: launch.curve, abi: CURVE, functionName: 'sweepFees', args: [0n] })
}

function usable(chain: Chain, launch: Launch): boolean {
  if (!isAddressEqual(launch.pair, zeroAddress)) {
    console.error(`pons launch ${launch.token} is paired with ${launch.pair}, not ETH; fees cannot fund ETH payouts`)
    return false
  }
  if (!isAddressEqual(launch.recipient, chain.wallet.account.address)) {
    console.error(`pons sends ${launch.token} creator fees to ${launch.recipient}, not the payout wallet`)
    return false
  }
  return true
}

export async function feeSplit(chain: Chain, token: Address): Promise<Split> {
  const [record, policy] = await Promise.all([
    chain.client.readContract({ address: PONS.factory, abi: FACTORY, functionName: 'getLaunchedToken', args: [token] }),
    chain.client.readContract({ address: PONS.factory, abi: FACTORY, functionName: 'getLaunchFeePolicy', args: [token] }),
  ])
  return { tax: record[8], creator: (BigInt(policy[3]) * (BPS - BigInt(policy[1]))) / BPS }
}

export async function collectFees(chain: Chain, token: Address): Promise<void> {
  try {
    const launch = await launchOf(chain, token)
    if (!usable(chain, launch) || (await busy(chain))) return
    await sweep(chain, launch)
    const owed = await chain.client.readContract({ address: PONS.escrow, abi: ESCROW, functionName: 'balanceOf', args: [chain.wallet.account.address] })
    if (owed > 0n) await execute(chain, { address: PONS.escrow, abi: ESCROW, functionName: 'claim' })
  } catch (error) {
    console.error('pons fee collection failed', error)
  }
}
