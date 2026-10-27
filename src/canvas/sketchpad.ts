import { BRUSH_SIZES, EXPORT_HEIGHT, EXPORT_WIDTH, PALETTE } from '../config'

export type Tool = 'pen' | 'eraser'

type Point = readonly [number, number]

interface Stroke {
  tool: Tool
  color: string
  size: number
  points: Point[]
}

const BASE_WIDTH = 800
const ERASER_SCALE = 2.4

function paint(ctx: CanvasRenderingContext2D, width: number, height: number, strokes: readonly Stroke[]): void {
  ctx.clearRect(0, 0, width, height)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const scale = width / BASE_WIDTH
  for (const stroke of strokes) {
    const lineWidth = stroke.size * scale * (stroke.tool === 'eraser' ? ERASER_SCALE : 1)
    const points = stroke.points.map(([x, y]) => [x * width, y * height] as const)
    ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
    ctx.strokeStyle = stroke.color
    ctx.fillStyle = stroke.color
    ctx.lineWidth = lineWidth
    if (points.length === 1) {
      ctx.beginPath()
      ctx.arc(points[0][0], points[0][1], lineWidth / 2, 0, Math.PI * 2)
      ctx.fill()
      continue
    }
    ctx.beginPath()
    ctx.moveTo(points[0][0], points[0][1])
    for (let i = 1; i < points.length - 1; i += 1) {
      const [x, y] = points[i]
      const [nx, ny] = points[i + 1]
      ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2)
    }
    const last = points[points.length - 1]
    ctx.lineTo(last[0], last[1])
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'source-over'
}

export class Sketchpad {
  color: string = PALETTE[0]
  size: number = BRUSH_SIZES[1]
  tool: Tool = 'pen'

  private readonly ctx: CanvasRenderingContext2D
  private readonly observer: ResizeObserver
  private readonly abort = new AbortController()
  private readonly changeListeners = new Set<() => void>()
  private strokes: Stroke[] = []
  private current: Stroke | null = null

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D is not supported in this browser')
    this.ctx = ctx
    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(canvas)
    const options = { signal: this.abort.signal }
    canvas.addEventListener('pointerdown', (event) => this.start(event), options)
    canvas.addEventListener('pointermove', (event) => this.extend(event), options)
    canvas.addEventListener('pointerup', () => this.end(), options)
    canvas.addEventListener('pointercancel', () => this.end(), options)
  }

  get isEmpty(): boolean {
    return !this.strokes.some((stroke) => stroke.tool === 'pen')
  }

  onChange(listener: () => void): void {
    this.changeListeners.add(listener)
  }

  undo(): void {
    this.strokes.pop()
    this.redraw()
    this.notify()
  }

  clear(): void {
    this.strokes = []
    this.current = null
    this.redraw()
    this.notify()
  }

  toBlob(): Promise<Blob | null> {
    const layer = document.createElement('canvas')
    layer.width = EXPORT_WIDTH
    layer.height = EXPORT_HEIGHT
    const layerCtx = layer.getContext('2d')
    const output = document.createElement('canvas')
    output.width = EXPORT_WIDTH
    output.height = EXPORT_HEIGHT
    const outputCtx = output.getContext('2d')
    if (!layerCtx || !outputCtx) return Promise.resolve(null)
    paint(layerCtx, EXPORT_WIDTH, EXPORT_HEIGHT, this.strokes)
    outputCtx.fillStyle = '#ffffff'
    outputCtx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT)
    outputCtx.drawImage(layer, 0, 0)
    return new Promise((resolve) => output.toBlob(resolve, 'image/png'))
  }

  destroy(): void {
    this.abort.abort()
    this.observer.disconnect()
  }

  private notify(): void {
    this.changeListeners.forEach((listener) => listener())
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect()
    const ratio = window.devicePixelRatio || 1
    this.canvas.width = Math.max(1, Math.round(rect.width * ratio))
    this.canvas.height = Math.max(1, Math.round(rect.height * ratio))
    this.redraw()
  }

  private point(event: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect()
    return [(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height]
  }

  private start(event: PointerEvent): void {
    if (event.button > 0) return
    event.preventDefault()
    this.canvas.setPointerCapture(event.pointerId)
    this.current = { tool: this.tool, color: this.color, size: this.size, points: [this.point(event)] }
    this.strokes.push(this.current)
    this.redraw()
    this.notify()
  }

  private extend(event: PointerEvent): void {
    if (!this.current) return
    const events = event.getCoalescedEvents?.() ?? [event]
    for (const item of events.length ? events : [event]) this.current.points.push(this.point(item))
    this.redraw()
  }

  private end(): void {
    if (!this.current) return
    this.current = null
    this.notify()
  }

  private redraw(): void {
    paint(this.ctx, this.canvas.width, this.canvas.height, this.strokes)
  }
}
