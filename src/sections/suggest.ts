import { REPO_URL } from '../config'
import { h, ruleHeading } from '../ui/dom'

const MIN_LENGTH = 3
const MAX_LENGTH = 60

function suggestionUrl(prompt: string): string {
  return `${REPO_URL}/issues/new?${new URLSearchParams({ title: `Prompt: ${prompt}` })}`
}

export function promptForm(): HTMLElement {
  const input = h('input', { class: 'prompt-input', placeholder: 'a whale wearing sunglasses', maxlength: MAX_LENGTH, 'aria-label': 'Your prompt' })
  const status = h('p', { class: 'prompt-status', 'aria-live': 'polite' }, 'Anyone can suggest one. No wallet needed.')

  const submit = (event: Event): void => {
    event.preventDefault()
    const prompt = input.value.trim().replace(/\s+/g, ' ')
    if (prompt.length < MIN_LENGTH) {
      status.textContent = 'Write a few more words.'
      return
    }
    window.open(suggestionUrl(prompt), '_blank', 'noopener')
    input.value = ''
    status.textContent = `Thanks! Finish sending “${prompt}” on GitHub.`
  }

  return h(
    'div',
    { class: 'prompt-box' },
    h('form', { class: 'prompt-form', onsubmit: submit }, input, h('button', { type: 'submit', class: 'btn btn-small' }, 'Suggest')),
    status,
  )
}

export function suggest(): HTMLElement {
  return h(
    'section',
    { class: 'section', id: 'suggest' },
    ruleHeading('Suggest a prompt', 'h2'),
    h('p', { class: 'section-lede' }, 'What should people draw next? Keep it short and drawable.'),
    h('div', { class: 'suggest-card blob-d' }, promptForm()),
  )
}
