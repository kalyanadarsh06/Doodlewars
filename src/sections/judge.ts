import { ROUND_MS } from '../config'
import { JUDGE_NAME } from '../content/judge'
import { roundResult, type RoundResult } from '../game/results'
import { currentRound, msLeft, promptFor, roundNumber } from '../game/round'
import { onTick } from '../game/ticker'
import { h, ruleHeading } from '../ui/dom'
import { clock } from '../util/format'
import { exampleNote } from './roundcard'
import { verdictView, type Stage } from './verdict'

const JUDGING_MS = 8 * 1000
const REVEAL_MS = 60 * 1000
const LOOKBACK = 50

function latestWinner(round: number, now: number): RoundResult | null {
  for (let back = 1; back <= LOOKBACK; back += 1) {
    const result = roundResult(round - back, now)
    if (result.winner) return result
  }
  return null
}

function stageAt(now: number): Stage {
  const round = currentRound(now)
  const since = now - round * ROUND_MS
  if (since >= REVEAL_MS) return { phase: 'waiting', number: roundNumber(round), prompt: promptFor(round), latest: latestWinner(round, now) }
  const last = roundResult(round - 1, now)
  if (since < JUDGING_MS && last.entries.length) return { phase: 'thinking', result: last }
  return { phase: 'verdict', result: last }
}

export function judge(): HTMLElement {
  const stage = h('div', { class: 'judge-stage' })
  const time = h('strong', {})
  let shown = ''
  onTick((now) => {
    const round = currentRound(now)
    time.textContent = clock(msLeft(round, now))
    const current = stageAt(now)
    const key = `${round}:${current.phase}`
    if (key === shown) return
    shown = key
    stage.replaceChildren(verdictView(current, time))
  })

  return h(
    'section',
    { class: 'section', id: 'judge' },
    ruleHeading(`Meet ${JUDGE_NAME}`, 'h2'),
    h('p', { class: 'section-lede' }, 'When a round’s timer runs out, it picks the winner live, right here.'),
    exampleNote(),
    stage,
  )
}
