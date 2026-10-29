import { JUDGE_NAME } from '../content/judge'
import { h } from '../ui/dom'

export function judgeNote(note: string | null): HTMLElement | null {
  return note ? h('blockquote', { class: 'judge-note' }, h('p', {}, `“${note}”`), h('cite', {}, JUDGE_NAME)) : null
}
