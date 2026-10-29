import { messageOf } from '../api/client'
import { recentFinals, finalKey, type FinalResult } from '../game/results'
import { onRefresh } from '../game/ticker'
import { h, ruleHeading } from '../ui/dom'
import { finalBlock } from './finalcard'

const PAGE_SIZE = 4
const REFRESH_MS = 15 * 1000
const EMPTY = 'No Finals yet. The first champion lands here.'

export function rounds(): HTMLElement {
  const list = h('div', { class: 'final-list' })
  const status = h('p', { class: 'empty-note', hidden: true })
  const more = h('button', { type: 'button', class: 'btn rounds-more', hidden: true }, 'Show older Finals')
  const blocks = new Map<number, { key: string; block: HTMLElement }>()
  let oldest = Number.POSITIVE_INFINITY

  const show = (results: FinalResult[], older: boolean): void => {
    const fresh: HTMLElement[] = []
    for (const result of results) {
      const key = finalKey(result)
      const existing = blocks.get(result.final)
      if (existing?.key === key) continue
      const block = finalBlock(result)
      blocks.set(result.final, { key, block })
      if (existing) existing.block.replaceWith(block)
      else fresh.push(block)
      oldest = Math.min(oldest, result.final)
    }
    if (older) list.append(...fresh)
    else list.prepend(...fresh)
    status.textContent = EMPTY
    status.hidden = blocks.size > 0
  }

  const failed = (error: unknown): void => {
    status.hidden = false
    status.textContent = messageOf(error)
  }

  more.addEventListener('click', () => {
    more.disabled = true
    recentFinals(PAGE_SIZE, oldest)
      .then((batch) => {
        show(batch, true)
        more.hidden = batch.length < PAGE_SIZE
      })
      .catch(failed)
      .finally(() => {
        more.disabled = false
      })
  })

  onRefresh(REFRESH_MS, () => {
    const first = blocks.size === 0
    recentFinals(PAGE_SIZE)
      .then((batch) => {
        show(batch, false)
        if (first) more.hidden = batch.length < PAGE_SIZE
      })
      .catch(failed)
  })

  return h(
    'section',
    { class: 'section rounds-page' },
    ruleHeading('Gallery', 'h2'),
    h('p', { class: 'section-lede' }, 'Every Final, newest first. 6 rounds, 6 winners, 1 champion. Tap a round to see every drawing.'),
    list,
    status,
    more,
  )
}
