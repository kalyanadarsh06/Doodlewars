import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  isAddress,
  keccak256,
  parseAbi,
  TransactionReceiptNotFoundError,
  type Address,
  type Hex,
  type Chain as ViemChain,
  type PrivateKeyAccount,
  type PublicClient,
  type Transport,
  type WalletClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { EXPLORER_URL } from '../../src/config'
import type { Env } from './env'
import type { Transfer } from './money'

export const robinhood = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [] } },
  blockExplorers: { default: { name: 'Blockscout', url: EXPLORER_URL } },
})

const ERC20 = parseAbi(['function balanceOf(address owner) view returns (uint256)'])

export interface Chain {
  client: PublicClient
  wallet: WalletClient<Transport, ViemChain, PrivateKeyAccount>
}

export interface Snapshot {
  block: number
  balance: bigint
}

export interface SignedTransfer extends Transfer {
  nonce: number
  raw: Hex
  hash: Hex
}

export interface Receipt {
  block: number
  success: boolean
  gas: bigint
}

export function publicClient(env: Env): PublicClient {
  return createPublicClient({ chain: robinhood, transport: http(env.RPC_URL), pollingInterval: 1000 })
}

export function connect(env: Env): Chain {
  if (!env.PAYOUT_PRIVATE_KEY) throw new Error('PAYOUT_PRIVATE_KEY is not set.')
  const account = privateKeyToAccount(env.PAYOUT_PRIVATE_KEY as Hex)
  return { client: publicClient(env), wallet: createWalletClient({ account, chain: robinhood, transport: http(env.RPC_URL) }) }
}

export async function snapshot(chain: Chain): Promise<Snapshot> {
  const blockNumber = await chain.client.getBlockNumber({ cacheTime: 0 })
  const balance = await chain.client.getBalance({ address: chain.wallet.account.address, blockNumber })
  return { block: Number(blockNumber), balance }
}

export async function holds(env: Env, wallet: Address): Promise<boolean> {
  const balance = await publicClient(env).readContract({
    address: env.TOKEN_ADDRESS as Address,
    abi: ERC20,
    functionName: 'balanceOf',
    args: [wallet],
  })
  return balance >= BigInt(env.MIN_HOLD)
}

export async function signTransfer(chain: Chain, transfer: Transfer): Promise<SignedTransfer | null> {
  if (!isAddress(transfer.to)) throw new Error(`Invalid payout address ${transfer.to}.`)
  const nonce = await chain.client.getTransactionCount({ address: chain.wallet.account.address, blockTag: 'pending' })
  const request = await chain.wallet.prepareTransactionRequest({ to: transfer.to, value: 0n, nonce, type: 'eip1559' })
  const value = transfer.value - request.gas * request.maxFeePerGas
  if (value <= 0n) return null
  const raw = await chain.wallet.signTransaction({ ...request, value })
  return { to: transfer.to, value, nonce, raw, hash: keccak256(raw) }
}

export async function broadcast(chain: Chain, raw: Hex): Promise<void> {
  try {
    await chain.client.sendRawTransaction({ serializedTransaction: raw })
  } catch (error) {
    console.error('broadcast failed', error)
  }
}

export async function receipt(chain: Chain, hash: Hex): Promise<Receipt | null> {
  try {
    const result = await chain.client.getTransactionReceipt({ hash })
    return { block: Number(result.blockNumber), success: result.status === 'success', gas: result.gasUsed * result.effectiveGasPrice }
  } catch (error) {
    if (error instanceof TransactionReceiptNotFoundError) return null
    throw error
  }
}
