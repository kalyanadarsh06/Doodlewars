import { messageOf } from '../api/client'
import { checkWallet, submitEntry, updateEntry } from '../api/endpoints'
import { Sketchpad } from '../canvas/sketchpad'
import { TICKER, TITLE_MAX } from '../config'
import { JUDGE_NAME } from '../content/judge'
import { onLiveRound, type LiveRound } from '../game/live'
import { isWallet, saveEntry, savedEntry, savedWallet, saveWallet, type SavedEntry } from '../game/player'
import { msLeft } from '../game/round'
import { download, h, svg } from '../ui/dom'
import { icons } from '../ui/icons'
import { clock, fileName, timeOfDay } from '../util/format'
import { holdNotice } from './hold'
import { roundBar } from './roundbar'
import { houseRules } from './rules'
import { toolbar } from './toolbar'

type Phase = 'idle' | 'drawing' | 'done'

const GHOST = `<svg viewBox="0 0 320 240" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2 14" aria-hidden="true"><path d="M110 196c-6-58 18-108 52-112 6-6 14-6 20 0 34 6 54 50 50 92-2 14-12 20-28 20z"/><circle cx="150" cy="140" r="4" fill="currentColor" stroke="none"/><circle cx="182" cy="140" r="4" fill="currentColor" stroke="none"/><path d="M156 160c6 5 14 5 20 0" stroke-dasharray="none"/></svg>`

function field(label: string, input: HTMLInputElement, className = 'title-field'): HTMLElement {
  return h('label', { class: className }, h('span', {}, label), input)
}

export function studio(): HTMLElement {
  const canvas = h('canvas', { class: 'pad', 'aria-label': 'Drawing canvas' })
  const pad = new Sketchpad(canvas)
  pad.enabled = false
  const hint = h('div', { class: 'pad-hint', 'aria-hidden': 'true' }, svg(GHOST), h('p', {}, 'go go go!'))

  const title = h('input', { class: 'title-input', maxlength: TITLE_MAX, placeholder: 'untitled', spellcheck: 'false', 'aria-label': 'Drawing title (optional)' })
  const wallet = h('input', { class: 'title-input wallet-input', maxlength: 42, value: savedWallet(), placeholder: '0x…', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Your wallet address' })
  const fun = h('input', { type: 'checkbox', 'aria-label': 'Just for fun, skip the judging' })
  const stage = h('section', { class: 'stage', 'aria-label': 'Draw', 'data-phase': 'idle' })
  const startLabel = h('span', {}, 'Start drawing')
  const startButton = h('button', { type: 'button', class: 'btn btn-yellow btn-big', onclick: () => void start() }, svg(icons.play), startLabel)
  const startNote = h('p', { class: 'stage-note', role: 'alert' })
  const submitLabel = h('span', {}, 'Submit')
  const submitButton = h('button', { type: 'button', class: 'btn btn-yellow submit-button', onclick: () => void submit() }, submitLabel)
  const submitNote = h('p', { class: 'submit-note', 'aria-live': 'polite' })
  const doneTitle = h('strong', {})
  const doneText = h('span', {})
  const doneNote = h('p', { class: 'done-note' })
  const kicker = h('p', { class: 'overlay-kicker' })
  let current: LiveRound | null = null
  let round = -1
  let prompt = ''
  let finalAt = 0
  let entry: SavedEntry | null = null
  let competing = true
  let checking = false
  let version = 0
  let sentVersion = 0
  let sending = false
  let error = ''

  const phase = (): Phase => stage.dataset.phase as Phase
  const setPhase = (next: Phase): void => {
    stage.dataset.phase = next
  }
  const changed = (): boolean => version !== sentVersion

  function refresh(): void {
    hint.classList.toggle('is-hidden', !pad.isEmpty)
    submitButton.disabled = sending || (entry !== null && !changed())
    submitLabel.textContent = sending ? 'Sending…' : !entry ? 'Submit' : changed() ? 'Update' : 'Submitted'
    if (error) submitNote.textContent = error
    else if (!entry) submitNote.textContent = competing ? 'You can keep editing after you submit.' : 'Just for fun: it goes in the gallery and skips the judging.'
    else if (changed()) submitNote.textContent = 'Unsaved changes. Hit Update.'
    else submitNote.textContent = entry.entered ? 'You’re in. Keep tweaking till 0:00.' : 'In the gallery. Keep tweaking till 0:00.'
  }

  const touch = (): void => {
    version += 1
    error = ''
    refresh()
  }
  pad.onChange(touch)
  title.addEventListener('input', touch)
  fun.addEventListener('change', () => {
    stage.toggleAttribute('data-fun', fun.checked)
    startNote.textContent = ''
  })

  function refuse(text: string, input: HTMLInputElement): void {
    startNote.textContent = text
    input.focus()
  }

  async function walletReady(address: string): Promise<boolean> {
    checking = true
    startButton.disabled = true
    startLabel.textContent = 'Checking wallet…'
    try {
      if ((await checkWallet(address)).holds) return true
      refuse(`No ${TICKER} in this wallet yet. Grab some, or tick “Just for fun”.`, wallet)
      return false
    } catch {
      return true
    } finally {
      checking = false
      startButton.disabled = false
      startLabel.textContent = 'Start drawing'
    }
  }

  async function start(): Promise<void> {
    if (!current || checking) return
    const saved = savedEntry(current.round)
    competing = saved ? saved.entered : !fun.checked
    if (!saved && competing) {
      const address = wallet.value.trim()
      if (!isWallet(address)) return refuse('Paste a wallet holding ' + TICKER + ' (0x…), or tick “Just for fun”.', wallet)
      if (!(await walletReady(address))) return
    }
    round = current.round
    finalAt = current.finalEndsAt
    prompt = current.prompt
    entry = saved
    pad.clear()
    title.value = entry?.title ?? ''
    version = 0
    sentVersion = 0
    error = ''
    pad.enabled = true
    startNote.textContent = ''
    setPhase('drawing')
    refresh()
  }

  function finish(): void {
    pad.stopStroke()
    pad.enabled = false
    doneTitle.textContent = 'Time’s up!'
    if (!entry) doneText.textContent = error ? `It didn’t send: ${error}` : 'Nothing was sent this round. Catch the next one.'
    else if (changed()) doneText.textContent = 'Your earlier version is in, but the last changes didn’t send.'
    else if (entry.entered) doneText.textContent = `${JUDGE_NAME} has it. Win this round and you’re in the ${timeOfDay(finalAt)} Final.`
    else doneText.textContent = 'It’s in the gallery. Add a wallet next round to compete.'
    setPhase('done')
  }

  async function submit(): Promise<void> {
    if (sending) return
    if (pad.isEmpty) {
      error = 'Draw something first.'
      refresh()
      return
    }
    sending = true
    error = ''
    refresh()
    const snapshot = version
    try {
      const image = await pad.toBlob()
      if (!image) throw new Error('The drawing could not be exported.')
      const upload = { round, title: title.value.trim(), image }
      if (entry) {
        await updateEntry(upload, entry.token)
        entry = { ...entry, title: upload.title }
      } else {
        const address = wallet.value.trim()
        const { token, entered } = await submitEntry(upload, competing ? address : null)
        if (entered) saveWallet(address)
        entry = { round, title: upload.title, token, entered }
      }
      saveEntry(entry)
      sentVersion = snapshot
    } catch (failure) {
      error = messageOf(failure)
    } finally {
      sending = false
      refresh()
    }
  }

  async function timeUp(): Promise<void> {
    pad.stopStroke()
    pad.enabled = false
    if (!pad.isEmpty && (!entry || changed())) await submit()
    if (phase() === 'drawing') finish()
  }

  onLiveRound((next, now) => {
    current = next
    if (!checking) startLabel.textContent = savedEntry(next.round) ? 'Keep editing' : 'Start drawing'
    kicker.textContent = `Round ${next.number}`
    if (phase() === 'done') doneNote.textContent = next.round !== round ? `Round ${next.number} is on: ${clock(msLeft(next.round, now))} left.` : ''
    if (next.round !== round && phase() === 'drawing') void timeUp()
  })

  const save = async (): Promise<void> => {
    const blob = await pad.toBlob()
    if (blob) download(blob, fileName(title.value || prompt))
  }

  const idle = h(
    'div',
    { class: 'pad-overlay overlay-idle' },
    h(
      'div',
      { class: 'overlay-card' },
      kicker,
      h('h2', { class: 'overlay-title' }, 'Ready?'),
      h('p', { class: 'overlay-text' }, 'Draw the prompt and submit before 0:00. Win the round, make the Final.'),
      field(`Wallet holding ${TICKER}`, wallet, 'title-field wallet-field'),
      h('label', { class: 'fun-toggle' }, fun, h('span', {}, 'Just for fun, skip the judging')),
      startButton,
      startNote,
      holdNotice('Any amount works. We check it each time you submit. Take the Final and the creator fees go to this wallet.'),
    ),
  )

  const entryBar = h(
    'div',
    { class: 'entry-bar' },
    field('Title (optional)', title),
    h('button', { type: 'button', class: 'btn btn-small', onclick: save }, svg(icons.download), 'Save a copy'),
  )

  const done = h(
    'div',
    { class: 'done-panel' },
    h('p', { class: 'done-copy' }, doneTitle, doneText, doneNote),
    h(
      'div',
      { class: 'done-actions' },
      h('button', { type: 'button', class: 'btn btn-small', onclick: save }, svg(icons.download), 'Save'),
      h('button', { type: 'button', class: 'btn btn-small btn-yellow', onclick: () => void start() }, 'Next round'),
    ),
  )

  stage.append(
    roundBar(),
    h(
      'div',
      { class: 'bench' },
      h('div', { class: 'frame' }, canvas, hint, idle),
      h('div', { class: 'bench-side' }, toolbar(pad), h('div', { class: 'submit-box' }, submitButton, submitNote)),
    ),
    entryBar,
    done,
  )

  refresh()
  return h('div', { class: 'studio' }, stage, houseRules())
}
