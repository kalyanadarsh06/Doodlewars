import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { keccak256, numberToHex, parseTransaction, recoverTransactionAddress, toFunctionSelector, type Address, type Hex } from 'viem'
import { PONS } from '../src/pons'

const GAS = 21000n
const GAS_PRICE = 10n ** 9n
const HOLDING = 10n ** 21n
const ZERO_HASH = `0x${'0'.repeat(64)}`
const CURVE = '0x000000000000000000000000000000000000c0de'
const PROTOCOL_SHARE = 3000n
const BPS = 10_000n
const FEE_BPS = 100n

const SELECTOR = {
  balanceOf: toFunctionSelector('balanceOf(address)'),
  getLaunchedToken: toFunctionSelector('getLaunchedToken(address)'),
  getLaunchFeePolicy: toFunctionSelector('getLaunchFeePolicy(address)'),
  graduated: toFunctionSelector('graduated()'),
  quoteFeeBalance: toFunctionSelector('quoteFeeBalance()'),
  creatorTaxBalance: toFunctionSelector('creatorTaxBalance()'),
  sweepFees: toFunctionSelector('sweepFees(uint256)'),
  claim: toFunctionSelector('claim()'),
}

function words(...values: (bigint | string)[]): Hex {
  return `0x${values.map((value) => (typeof value === 'bigint' ? value.toString(16) : value.slice(2).toLowerCase()).padStart(64, '0')).join('')}`
}

function same(a: string | undefined, b: string): boolean {
  return a?.toLowerCase() === b.toLowerCase()
}

interface Receipt {
  hash: Hex
  from: Address
  to: Address
  block: number
}

export interface JudgeCall {
  beta: string | null
  body: {
    model: string
    system: string
    fallbacks?: unknown
    messages: { content: { type: string; text?: string }[] }[]
  }
}

interface ScreenCall {
  body: { system: string; messages: { content: string }[] }
}

export interface Fake {
  url: string
  setBalance(address: Address, wei: bigint): void
  addBalance(address: Address, wei: bigint): void
  balance(address: Address): bigint
  hold(address: Address): void
  launch(token: Address, recipient: Address, taxBps: bigint): void
  accrue(wei: bigint): void
  sweeps: number
  judgeCalls: JudgeCall[]
  screenCalls: ScreenCall[]
  close(): Promise<void>
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}

export async function startFake(port: number): Promise<Fake> {
  let block = 1000
  const history = new Map<string, { block: number; balance: bigint }[]>()
  const nonces = new Map<string, number>()
  const receipts = new Map<string, Receipt>()
  const holders = new Set<string>()
  const judgeCalls: JudgeCall[] = []
  const screenCalls: ScreenCall[] = []
  const escrow = new Map<string, bigint>()
  const pons = { token: '', recipient: '', taxBps: 0n, fees: 0n, tax: 0n, sweeps: 0 }

  const balanceAt = (address: string, at: number): bigint => {
    const entries = history.get(address.toLowerCase()) ?? []
    return entries.filter((entry) => entry.block <= at).at(-1)?.balance ?? 0n
  }
  const setBalance = (address: string, balance: bigint): void => {
    const key = address.toLowerCase()
    const entries = history.get(key) ?? []
    if (entries.at(-1)?.block === block) entries.pop()
    entries.push({ block, balance })
    history.set(key, entries)
  }
  const addBalance = (address: string, wei: bigint): void => {
    block += 1
    setBalance(address, balanceAt(address, block) + wei)
  }
  const blockTag = (tag: string): number => (tag.startsWith('0x') ? Number(tag) : block)

  const sendRaw = async (raw: Hex): Promise<Hex> => {
    const hash = keccak256(raw)
    if (receipts.has(hash)) return hash
    const transaction = parseTransaction(raw)
    const from = await recoverTransactionAddress({ serializedTransaction: raw as never })
    const nonce = nonces.get(from.toLowerCase()) ?? 0
    if (transaction.nonce !== nonce) throw new Error(`nonce too low: next nonce ${nonce}, tx nonce ${transaction.nonce}`)
    const value = transaction.value ?? 0n
    const cost = value + GAS * GAS_PRICE
    if (balanceAt(from, block) < cost) throw new Error('insufficient funds for gas * price + value')
    block += 1
    setBalance(from, balanceAt(from, block) - cost)
    setBalance(transaction.to as string, balanceAt(transaction.to as string, block) + value)
    nonces.set(from.toLowerCase(), nonce + 1)
    receipts.set(hash, { hash, from, to: transaction.to as Address, block })
    settle(from, transaction.to as string, transaction.data ?? '0x')
    return hash
  }

  const settle = (from: string, to: string, data: string): void => {
    if (same(to, CURVE) && data.startsWith(SELECTOR.sweepFees)) {
      if (!same(from, pons.recipient)) throw new Error('execution reverted')
      escrow.set(from.toLowerCase(), (escrow.get(from.toLowerCase()) ?? 0n) + (pons.fees * (BPS - PROTOCOL_SHARE)) / BPS + pons.tax)
      pons.fees = 0n
      pons.tax = 0n
      pons.sweeps += 1
    }
    if (same(to, PONS.escrow) && data.startsWith(SELECTOR.claim)) {
      const owed = escrow.get(from.toLowerCase()) ?? 0n
      escrow.delete(from.toLowerCase())
      setBalance(from, balanceAt(from, block) + owed)
    }
  }

  const call = ({ from, to, data }: { from?: string; to: string; data: string }): Hex => {
    const argument = `0x${data.slice(34, 74)}`
    if (same(to, PONS.factory) && data.startsWith(SELECTOR.getLaunchedToken) && same(argument, pons.token)) {
      return words(pons.token, CURVE, pons.recipient, pons.recipient, 0n, 0n, 0n, 200n, pons.taxBps, 0n, 0n, 0n, 0n, 0n, 1n)
    }
    if (same(to, PONS.factory) && data.startsWith(SELECTOR.getLaunchFeePolicy)) return words(PONS.factory, PROTOCOL_SHARE, 5000n, FEE_BPS, 300n)
    if (same(to, CURVE) && data.startsWith(SELECTOR.graduated)) return words(0n)
    if (same(to, CURVE) && data.startsWith(SELECTOR.quoteFeeBalance)) return words(pons.fees)
    if (same(to, CURVE) && data.startsWith(SELECTOR.creatorTaxBalance)) return words(pons.tax)
    if (same(to, CURVE) && data.startsWith(SELECTOR.sweepFees) && same(from, pons.recipient)) return '0x'
    if (same(to, PONS.escrow) && data.startsWith(SELECTOR.balanceOf)) return words(escrow.get(argument.toLowerCase()) ?? 0n)
    if (same(to, PONS.escrow) && data.startsWith(SELECTOR.claim) && (escrow.get(from?.toLowerCase() ?? '') ?? 0n) > 0n) return '0x'
    if (data.startsWith(SELECTOR.balanceOf)) return numberToHex(holders.has(argument.toLowerCase()) ? HOLDING : 0n, { size: 32 })
    throw new Error('execution reverted')
  }

  const rpc = async (method: string, params: unknown[]): Promise<unknown> => {
    switch (method) {
      case 'eth_chainId':
        return '0x1237'
      case 'eth_blockNumber':
        block += 1
        return numberToHex(block)
      case 'eth_getBalance':
        return numberToHex(balanceAt(params[0] as string, blockTag(params[1] as string)))
      case 'eth_getTransactionCount':
        return numberToHex(nonces.get((params[0] as string).toLowerCase()) ?? 0)
      case 'eth_call':
        return call(params[0] as { from?: string; to: string; data: string })
      case 'eth_estimateGas':
        return numberToHex(GAS)
      case 'eth_gasPrice':
        return numberToHex(GAS_PRICE)
      case 'eth_maxPriorityFeePerGas':
        return '0x0'
      case 'eth_getBlockByNumber':
        return {
          number: numberToHex(block),
          hash: keccak256(numberToHex(block)),
          parentHash: ZERO_HASH,
          timestamp: numberToHex(Math.floor(Date.now() / 1000)),
          baseFeePerGas: numberToHex(GAS_PRICE),
          gasLimit: numberToHex(140_000_000),
          gasUsed: '0x0',
          miner: `0x${'0'.repeat(40)}`,
          transactions: [],
          uncles: [],
        }
      case 'eth_sendRawTransaction':
        return sendRaw(params[0] as Hex)
      case 'eth_getTransactionReceipt': {
        const receipt = receipts.get(params[0] as string)
        if (!receipt) return null
        return {
          transactionHash: receipt.hash,
          blockHash: keccak256(numberToHex(receipt.block)),
          blockNumber: numberToHex(receipt.block),
          from: receipt.from,
          to: receipt.to,
          contractAddress: null,
          cumulativeGasUsed: numberToHex(GAS),
          gasUsed: numberToHex(GAS),
          effectiveGasPrice: numberToHex(GAS_PRICE),
          logs: [],
          logsBloom: `0x${'0'.repeat(512)}`,
          status: '0x1',
          transactionIndex: '0x0',
          type: '0x2',
        }
      }
      default:
        throw new Error(`unsupported method ${method}`)
    }
  }

  const reply = (model: string, output: unknown) => ({
    id: 'msg_fake',
    type: 'message',
    role: 'assistant',
    model,
    content: [{ type: 'text', text: JSON.stringify(output) }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  })

  const judgeReply = (call: JudgeCall) => {
    const ids = call.body.messages[0].content.flatMap((block) => {
      const text = block.type === 'text' ? (block.text ?? '') : ''
      const match = /^Entry (\d+)/.exec(text)
      return match && !text.includes('just for fun') ? [Number(match[1])] : []
    })
    return reply(call.body.model, { winner: ids[0] ?? null, disqualified: [], reason: 'Best whale by a mile.' })
  }

  const screenReply = (model: string, call: ScreenCall) => {
    const approved = [...call.body.messages[0].content.matchAll(/^Suggestion (\d+): (.*)$/gm)].filter(([, , text]) => !text.includes('buy')).map(([, id]) => Number(id))
    return reply(model, { approved })
  }

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost')
      if (url.pathname.startsWith('/v1/messages')) {
        const body = JSON.parse(await readBody(request))
        if (body.system.startsWith('You pick prompts')) {
          screenCalls.push({ body })
          return send(response, 200, screenReply(body.model, { body }))
        }
        const call: JudgeCall = { beta: (request.headers['anthropic-beta'] as string) ?? null, body }
        judgeCalls.push(call)
        return send(response, 200, judgeReply(call))
      }
      const { id, method, params } = JSON.parse(await readBody(request)) as { id: number; method: string; params: unknown[] }
      try {
        send(response, 200, { jsonrpc: '2.0', id, result: await rpc(method, params ?? []) })
      } catch (error) {
        send(response, 200, { jsonrpc: '2.0', id, error: { code: -32000, message: (error as Error).message } })
      }
    } catch (error) {
      send(response, 500, { error: (error as Error).message })
    }
  })
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve))

  return {
    url: `http://127.0.0.1:${port}`,
    setBalance: (address, wei) => setBalance(address, wei),
    addBalance,
    balance: (address) => balanceAt(address, block),
    hold: (address) => holders.add(address.toLowerCase()),
    launch: (token, recipient, taxBps) => Object.assign(pons, { token, recipient, taxBps }),
    accrue: (wei) => {
      pons.fees += wei
      pons.tax += (wei * pons.taxBps) / FEE_BPS
    },
    get sweeps() {
      return pons.sweeps
    },
    judgeCalls,
    screenCalls,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}
