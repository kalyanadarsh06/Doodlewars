import type { Sketchpad, Tool } from '../canvas/sketchpad'
import { BRUSH_SIZES, PALETTE } from '../config'
import { h, svg } from '../ui/dom'
import { icons } from '../ui/icons'

function tool(label: string, content: Node, onClick: () => void, className = 'tool'): HTMLButtonElement {
  return h('button', { type: 'button', class: className, 'aria-label': label, title: label, onclick: onClick }, content)
}

function select<K>(group: Map<K, HTMLButtonElement>, active: K): void {
  group.forEach((button, key) => {
    button.classList.toggle('is-active', key === active)
    button.setAttribute('aria-pressed', String(key === active))
  })
}

export function toolbar(pad: Sketchpad): HTMLElement {
  const tools = new Map<Tool, HTMLButtonElement>()
  const sizes = new Map<number, HTMLButtonElement>()
  const colors = new Map<string, HTMLButtonElement>()

  const setTool = (next: Tool): void => {
    pad.tool = next
    select(tools, next)
  }

  const setSize = (size: number): void => {
    pad.size = size
    select(sizes, size)
  }

  const setColor = (color: string): void => {
    pad.color = color
    select(colors, color)
    setTool('pen')
  }

  tools.set('pen', tool('Pen (B)', svg(icons.pen), () => setTool('pen')))
  tools.set('eraser', tool('Eraser (E)', svg(icons.eraser), () => setTool('eraser')))
  BRUSH_SIZES.forEach((size, index) =>
    sizes.set(size, tool(`Brush size ${index + 1} (${index + 1})`, h('span', { class: 'size-dot', style: `--dot: ${size + 4}px` }), () => setSize(size))),
  )
  PALETTE.forEach((color) =>
    colors.set(
      color.value,
      h('button', { type: 'button', class: 'swatch', style: `--swatch: ${color.value}`, 'aria-label': color.name, title: color.name, onclick: () => setColor(color.value) }),
    ),
  )

  const undo = tool('Undo', svg(icons.undo), () => pad.undo())
  const redo = tool('Redo', svg(icons.redo), () => pad.redo())
  const clear = tool('Clear', svg(icons.trash), () => pad.clear(), 'tool tool-danger')
  const sync = (): void => {
    undo.disabled = !pad.canUndo
    redo.disabled = !pad.canRedo
    clear.disabled = !pad.canUndo
  }

  const dock = h(
    'div',
    { class: 'dock', role: 'toolbar', 'aria-label': 'Drawing tools' },
    h('div', { class: 'dock-group' }, ...tools.values()),
    h('div', { class: 'dock-group dock-sizes' }, ...sizes.values()),
    h('div', { class: 'dock-group' }, undo, redo, clear),
    h('div', { class: 'dock-colors', role: 'group', 'aria-label': 'Colors' }, ...colors.values()),
  )

  window.addEventListener('keydown', (event) => {
    if (!dock.isConnected || !pad.enabled || event.target instanceof HTMLInputElement) return
    const key = event.key.toLowerCase()
    if ((event.metaKey || event.ctrlKey) && key === 'z') {
      event.preventDefault()
      if (event.shiftKey) pad.redo()
      else pad.undo()
      return
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (key === 'b') setTool('pen')
    else if (key === 'e') setTool('eraser')
    else if (BRUSH_SIZES[Number(key) - 1]) setSize(BRUSH_SIZES[Number(key) - 1])
  })

  pad.onChange(sync)
  setTool(pad.tool)
  setSize(pad.size)
  setColor(pad.color)
  sync()
  return dock
}
