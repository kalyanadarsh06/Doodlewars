import { messageOf } from '../api/client'
import { hallKey, hallOfFame, type HallEntry } from '../game/results'
import { onRefresh } from '../game/ticker'
import { finalHref, WINNERS_HREF } from '../router'
import { h, ruleHeading, svg } from '../ui/dom'
import { icons } from '../ui/icons'
import { drawingTitle, when } from '../util/format'
import { drawingImage } from './roundcard'

const REFRESH_MS = 30 * 1000
const SHOWN = 4
const PAGE_SIZE = 12
const EMPTY = 'No champions yet. The first one gets framed right here.'

function stamp(entry: HallEntry): HTMLElement {
  return h('span', { class: 'hall-stamp' }, entry.payout?.state === 'paid' ? 'Paid' : 'Paying')
}

function hallCard(entry: HallEntry): HTMLElement {
  return h(
    'a',
    { href: finalHref(entry.number), class: 'hall-card' },
    h('div', { class: 'hall-frame' }, drawingImage(entry.drawing), stamp(entry)),
    h(
      'div',
      { class: 'hall-info' },
      h('span', { class: 'round-label' }, svg(icons.trophy), `Final ${entry.number} · ${when(entry.endsAt)}`),
      h('p', { class: 'hall-title' }, drawingTitle(entry.drawing)),
      h('p', { class: 'hall-prompt' }, `Round ${entry.roundNumber}: `, h('mark', {}, entry.prompt)),
    ),
  )
}

function hallList(limit: number, onPage?: (entries: HallEntry[]) => void): { grid: HTMLElement; status: HTMLElement } {
  const grid = h('div', { class: 'hall-grid' })
  const status = h('p', { class: 'empty-note', hidden: true })
  let shown: string | null = null
  onRefresh(REFRESH_MS, () => {
    hallOfFame(limit)
      .then((entries) => {
        const key = entries.map(hallKey).join()
        if (key === shown) return
        shown = key
        grid.replaceChildren(...entries.map(hallCard))
        status.textContent = EMPTY
        status.hidden = entries.length > 0
        onPage?.(entries)
      })
      .catch((error) => {
        if (shown) return
        status.textContent = messageOf(error)
        status.hidden = false
      })
  })
  return { grid, status }
}

export function hall(): HTMLElement {
  const { grid, status } = hallList(SHOWN)
  return h(
    'section',
    { class: 'section hall', id: 'winners' },
    ruleHeading('Hall of Fame', 'h2'),
    h('p', { class: 'section-lede' }, 'Every drawing here won creator fees.'),
    grid,
    status,
    h('a', { href: WINNERS_HREF, class: 'btn section-more' }, 'See every champion', svg(icons.arrow)),
  )
}

export function winnersPage(): HTMLElement {
  const more = h('button', { type: 'button', class: 'btn rounds-more', hidden: true }, 'Show older champions')
  let oldest = Number.MAX_SAFE_INTEGER
  const { grid, status } = hallList(PAGE_SIZE, (entries) => {
    oldest = entries.at(-1)?.final ?? oldest
    more.hidden = entries.length < PAGE_SIZE
  })
  more.addEventListener('click', () => {
    more.disabled = true
    hallOfFame(PAGE_SIZE, oldest)
      .then((entries) => {
        grid.append(...entries.map(hallCard))
        oldest = entries.at(-1)?.final ?? oldest
        more.hidden = entries.length < PAGE_SIZE
      })
      .catch((error) => {
        status.textContent = messageOf(error)
        status.hidden = false
      })
      .finally(() => {
        more.disabled = false
      })
  })
  return h(
    'section',
    { class: 'section hall-page' },
    ruleHeading('Hall of Fame', 'h2'),
    h('p', { class: 'section-lede' }, 'Every Final champion, newest first. Each one took home that Final’s creator fees. Tap a drawing to see the whole Final.'),
    grid,
    status,
    more,
  )
}
