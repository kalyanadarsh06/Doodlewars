import { Sketchpad } from '../canvas/sketchpad'
import { TICKER } from '../config'
import { JUDGE_NAME } from '../content/judge'
import { randomTitle } from '../content/themes'
import { currentRound } from '../game/round'
import { onTick } from '../game/ticker'
import { h, svg } from '../ui/dom'
import { icons } from '../ui/icons'
import { fileName } from '../util/format'
import { roundBar } from './roundbar'
import { roundInfo } from './roundinfo'
import { toolbar } from './toolbar'

type Phase = 'idle' | 'drawing' | 'done'

const GHOST = `<svg viewBox="0 0 320 240" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2 14" aria-hidden="true"><path d="M110 196c-6-58 18-108 52-112 6-6 14-6 20 0 34 6 54 50 50 92-2 14-12 20-28 20z"/><circle cx="150" cy="140" r="4" fill="currentColor" stroke="none"/><circle cx="182" cy="140" r="4" fill="currentColor" stroke="none"/><path d="M156 160c6 5 14 5 20 0" stroke-dasharray="none"/></svg>`

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const link = h('a', { href: url, download: name })
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function studio(): HTMLElement {
  const canvas = h('canvas', { class: 'pad', 'aria-label': 'Drawing canvas' })
  const pad = new Sketchpad(canvas)
  pad.enabled = false
  const hint = h('div', { class: 'pad-hint', 'aria-hidden': 'true' }, svg(GHOST), h('p', {}, 'go go go!'))
  pad.onChange(() => hint.classList.toggle('is-hidden', !pad.isEmpty))

  const title = h('input', { class: 'title-input', maxlength: 22, spellcheck: 'false', 'aria-label': 'Drawing name' })
  const stage = h('section', { class: 'stage', 'aria-label': 'Draw', 'data-phase': 'idle' })
  let round = 0

  const setPhase = (phase: Phase): void => {
    stage.dataset.phase = phase
  }

  function start(): void {
    pad.clear()
    pad.enabled = true
    round = currentRound()
    title.value = randomTitle().replace(/_/g, ' ')
    setPhase('drawing')
  }

  function finish(): void {
    if (stage.dataset.phase !== 'drawing') return
    pad.stopStroke()
    pad.enabled = false
    setPhase('done')
    done.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  onTick((now) => {
    if (currentRound(now) !== round) finish()
  })

  const save = async (): Promise<void> => {
    const blob = await pad.toBlob()
    if (blob) download(blob, fileName(title.value))
  }

  const idle = h(
    'div',
    { class: 'pad-overlay overlay-idle' },
    h(
      'div',
      { class: 'overlay-card' },
      h('p', { class: 'overlay-kicker' }, 'Practice mode'),
      h('h2', { class: 'overlay-title' }, 'Ready?'),
      h('p', { class: 'overlay-text' }, 'Draw the prompt until the timer ends. Practice is free and can’t win.'),
      h('button', { type: 'button', class: 'btn btn-yellow btn-big', onclick: start }, svg(icons.play), 'Start practice'),
      h(
        'div',
        { class: 'entry-ticket' },
        svg(icons.lock),
        h('p', {}, h('strong', {}, 'Enter to win'), h('span', {}, `Hold any amount of ${TICKER}. Opens at launch.`)),
      ),
    ),
  )

  const done = h(
    'div',
    { class: 'done-panel' },
    h('p', { class: 'done-copy' }, h('strong', {}, 'Pencils down!'), h('span', {}, `In a real round, this goes to ${JUDGE_NAME}.`)),
    h('label', { class: 'title-field' }, h('span', {}, 'Name'), title),
    h(
      'div',
      { class: 'done-actions' },
      h('button', { type: 'button', class: 'btn btn-small', onclick: save }, svg(icons.download), 'Save'),
      h('button', { type: 'button', class: 'btn btn-small btn-yellow', onclick: start }, 'Draw again'),
    ),
  )

  stage.append(
    roundBar(),
    h(
      'div',
      { class: 'bench' },
      h('div', { class: 'frame' }, canvas, hint, idle),
      h(
        'div',
        { class: 'bench-side' },
        toolbar(pad),
        h('button', { type: 'button', class: 'btn btn-yellow pencils-down', onclick: finish }, 'Pencils down'),
      ),
    ),
    done,
  )

  return h('div', { class: 'studio' }, stage, roundInfo())
}
