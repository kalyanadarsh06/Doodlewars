import { messageOf } from '../api/client'
import { suggestPrompt } from '../api/endpoints'
import { PROMPT_MAX, PROMPT_MIN } from '../config'
import { randomIdea } from '../content/themes'
import { h, ruleHeading, svg } from '../ui/dom'
import { icons } from '../ui/icons'

export function promptForm(): HTMLElement {
  const input = h('input', { class: 'prompt-input', placeholder: 'a whale wearing sunglasses', maxlength: PROMPT_MAX, 'aria-label': 'Your prompt' })
  const button = h('button', { type: 'submit', class: 'btn btn-small' }, 'Suggest')
  const status = h('p', { class: 'prompt-status', 'aria-live': 'polite' }, 'Fun, drawable ideas get picked.')

  const submit = async (event: Event): Promise<void> => {
    event.preventDefault()
    const prompt = input.value.trim().replace(/\s+/g, ' ')
    if (prompt.length < PROMPT_MIN) {
      status.textContent = 'Write a few more words.'
      return
    }
    button.disabled = true
    try {
      await suggestPrompt(prompt)
      input.value = ''
      status.textContent = `“${prompt}” is in. If it’s fun and drawable, it could be the next prompt.`
    } catch (error) {
      status.textContent = messageOf(error)
    } finally {
      button.disabled = false
    }
  }

  const surprise = (): void => {
    input.value = randomIdea()
    input.focus()
  }

  return h(
    'div',
    { class: 'prompt-box' },
    h('form', { class: 'prompt-form', onsubmit: submit }, input, button),
    h('button', { type: 'button', class: 'idea-button', onclick: surprise }, svg(icons.dice), 'Stuck? Roll a random idea'),
    status,
  )
}

export function suggest(): HTMLElement {
  return h(
    'section',
    { class: 'section', id: 'suggest' },
    ruleHeading('Suggest a prompt', 'h2'),
    h('p', { class: 'section-lede' }, 'What should everyone draw next? Short, silly, drawable.'),
    h('div', { class: 'suggest-card blob-d' }, promptForm()),
  )
}
