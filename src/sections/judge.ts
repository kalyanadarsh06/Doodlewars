import { ROUND_MS } from '../config'
import { JUDGE_NAME, JUDGE_SCORES } from '../content/judge'
import { onLiveRound, type LiveRound } from '../game/live'
import { finalKey, pastRounds, recentFinals, resultKey, type FinalResult, type RoundResult } from '../game/results'
import { msLeft } from '../game/round'
import { h, ruleHeading } from '../ui/dom'
import { clock } from '../util/format'
import { verdictView, type Stage } from './verdict'

const REVEAL_MS = 60 * 1000
const FINAL_REVEAL_MS = 3 * 60 * 1000
const REFRESH_MS = 10 * 1000
const LOOKBACK = 10

function finalStage(finals: FinalResult[], live: LiveRound, now: number): Stage | null {
  const last = finals.find((final) => final.final === live.final - 1)
  if (!last || now - last.endsAt >= FINAL_REVEAL_MS) return null
  if (last.status === 'judging') return { phase: 'thinking', final: last }
  return last.status === 'done' ? { phase: 'verdict', final: last } : null
}

function stageFor(rounds: RoundResult[], finals: FinalResult[], live: LiveRound, now: number): Stage {
  const last = rounds[0]?.round === live.round - 1 ? rounds[0] : null
  if (last?.status === 'judging') return { phase: 'thinking', result: last }
  const final = finalStage(finals, live, now)
  if (final) return final
  if (last && now - live.round * ROUND_MS < REVEAL_MS) return { phase: 'verdict', result: last }
  return { phase: 'waiting', number: live.number, prompt: live.prompt, latest: rounds.find((result) => result.winner) ?? null }
}

function stageKey(stage: Stage): string {
  if (stage.phase === 'waiting') return `waiting:${stage.number}:${stage.prompt}:${stage.latest ? resultKey(stage.latest) : ''}`
  return 'final' in stage ? `final:${stage.phase}:${finalKey(stage.final)}` : `${stage.phase}:${resultKey(stage.result)}`
}

function criteria(): HTMLElement {
  return h(
    'div',
    { class: 'criteria-card blob-d' },
    h('h3', { class: 'criteria-title' }, 'Judges on'),
    h('ol', { class: 'criteria-list' }, ...JUDGE_SCORES.map((score) => h('li', {}, score))),
  )
}

export function judge(): HTMLElement {
  const stage = h('div', { class: 'judge-stage' })
  const time = h('strong', {})
  let rounds: RoundResult[] = []
  let finals: FinalResult[] = []
  let readyRound = -1
  let loadedRound = -1
  let loadedAt = 0
  let shown = ''

  onLiveRound((live, now) => {
    time.textContent = clock(msLeft(live.round, now))
    if (live.round !== loadedRound || now - loadedAt >= REFRESH_MS) {
      const { round } = live
      loadedRound = round
      loadedAt = now
      Promise.all([pastRounds(LOOKBACK), recentFinals(2)])
        .then(([nextRounds, nextFinals]) => {
          rounds = nextRounds
          finals = nextFinals
          readyRound = round
        })
        .catch(() => undefined)
    }
    if (readyRound !== live.round && shown) return
    const current = stageFor(rounds, finals, live, now)
    const key = stageKey(current)
    if (key === shown) return
    shown = key
    stage.replaceChildren(verdictView(current, time))
  })

  return h(
    'section',
    { class: 'section', id: 'judge' },
    ruleHeading(`Meet ${JUDGE_NAME}`, 'h2'),
    h('p', { class: 'section-lede lede-wide' }, 'Our AI judge. Picks a winner every round and a champion every Final. Can’t be bribed.'),
    criteria(),
    stage,
  )
}
