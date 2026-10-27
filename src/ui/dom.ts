type Child = Node | string | null | undefined | false
type Handler = (event: Event) => void
type Attrs = Record<string, string | number | boolean | Handler | undefined>

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue
    if (typeof value === 'function') element.addEventListener(key.replace(/^on/, ''), value)
    else if (key === 'class') element.className = String(value)
    else element.setAttribute(key, value === true ? '' : String(value))
  }
  for (const child of children) {
    if (child !== null && child !== undefined && child !== false) element.append(child)
  }
  return element
}

export function svg(markup: string): SVGElement {
  const template = document.createElement('template')
  template.innerHTML = markup.trim()
  return template.content.firstElementChild as SVGElement
}

export function ruleHeading(text: string, level: 'h2' | 'h3' = 'h3'): HTMLElement {
  return h(level, { class: 'rule-heading' }, h('span', {}, text))
}
