import { useEffect, useRef } from 'react'
import { Channel, invoke } from '@tauri-apps/api/core'
import { useVireStore } from '../../store/useVireStore'

const PAD = 8
const BASE_CELL_W = 6.6
const BASE_CELL_H = 15

function cellSizeFor(w: number) {
  const scale = Math.min(1.7, Math.max(0.8, w / 480))
  return { cellW: BASE_CELL_W * scale, cellH: BASE_CELL_H * scale, fontPx: 11 * scale }
}

interface TermCell {
  ch: string
  fg: [number, number, number] | null
  bg: [number, number, number] | null
  bold: boolean
  italic: boolean
  inverse: boolean
}

interface TermFrame {
  cols: number
  rows: number
  cursor: { x: number; y: number; visible: boolean }
  grid: TermCell[][]
}

function cols(w: number, cellW: number) {
  return Math.max(2, Math.floor((w - PAD * 2) / cellW))
}
function rows(h: number, cellH: number) {
  return Math.max(1, Math.floor((h - PAD * 2) / cellH))
}

function drawFrame(canvas: HTMLCanvasElement, frame: TermFrame, zoom: number, containerW: number) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { cellW, cellH, fontPx } = cellSizeFor(containerW)
  const font = `${fontPx}px 'JetBrains Mono', 'Cascadia Code', monospace`
  const scale = (window.devicePixelRatio || 1) * Math.max(1, zoom)
  const w = frame.cols * cellW + PAD * 2
  const h = frame.rows * cellH + PAD * 2
  if (canvas.width !== w * scale || canvas.height !== h * scale) {
    canvas.width = w * scale
    canvas.height = h * scale
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
  }
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.fillStyle = '#141414'
  ctx.fillRect(0, 0, w, h)
  ctx.font = font
  ctx.textBaseline = 'top'

  frame.grid.forEach((line, y) => {
    line.forEach((cell, x) => {
      const px = PAD + x * cellW
      const py = PAD + y * cellH
      const inverse = cell.inverse
      const fg = cell.fg ? `rgb(${cell.fg.join(',')})` : '#e5e5e5'
      const bg = cell.bg ? `rgb(${cell.bg.join(',')})` : null
      const paintBg = inverse ? fg : bg
      const paintFg = inverse ? (bg ?? '#141414') : fg
      if (paintBg) {
        ctx.fillStyle = paintBg
        ctx.fillRect(px, py, cellW, cellH)
      }
      if (cell.ch && cell.ch !== ' ') {
        ctx.fillStyle = paintFg
        ctx.font = cell.bold ? `bold ${font}` : font
        ctx.fillText(cell.ch, px, py + 1)
      }
    })
  })

  if (frame.cursor.visible) {
    const cx = PAD + frame.cursor.x * cellW
    const cy = PAD + frame.cursor.y * cellH
    ctx.fillStyle = 'rgba(229,229,229,0.6)'
    ctx.fillRect(cx, cy, cellW, cellH)
  }
}

function keyToBytes(e: React.KeyboardEvent): Uint8Array | null {
  if (e.ctrlKey && e.key.length === 1) {
    const code = e.key.toUpperCase().charCodeAt(0) - 64
    if (code >= 0 && code < 32) return new Uint8Array([code])
  }
  switch (e.key) {
    case 'Enter':
      return new Uint8Array([13])
    case 'Backspace':
      return new Uint8Array([127])
    case 'Tab':
      return new Uint8Array([9])
    case 'Escape':
      return new Uint8Array([27])
    case 'ArrowUp':
      return new TextEncoder().encode('\x1b[A')
    case 'ArrowDown':
      return new TextEncoder().encode('\x1b[B')
    case 'ArrowRight':
      return new TextEncoder().encode('\x1b[C')
    case 'ArrowLeft':
      return new TextEncoder().encode('\x1b[D')
  }
  if (e.key.length === 1) return new TextEncoder().encode(e.key)
  return null
}

export function TerminalBlock({ id, zoom }: { id: string; zoom: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastFrameRef = useRef<TermFrame | null>(null)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const containerWRef = useRef(480)
  const projectId = useVireStore((s) => s.activeId)

  useEffect(() => {
    if (canvasRef.current && lastFrameRef.current) drawFrame(canvasRef.current, lastFrameRef.current, zoom, containerWRef.current)
  }, [zoom])

  useEffect(() => {
    const channel = new Channel<TermFrame>()
    channel.onmessage = (frame) => {
      lastFrameRef.current = frame
      if (canvasRef.current) drawFrame(canvasRef.current, frame, zoomRef.current, containerWRef.current)
    }

    const container = containerRef.current
    if (!container) return

    let created = false
    let size: { cols: number; rows: number } | null = null
    let resizeTimer: ReturnType<typeof setTimeout> | null = null

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      containerWRef.current = width
      const { cellW, cellH } = cellSizeFor(width)
      const next = { cols: cols(width, cellW), rows: rows(height, cellH) }

      if (canvasRef.current && lastFrameRef.current) drawFrame(canvasRef.current, lastFrameRef.current, zoomRef.current, width)

      if (!created) {
        created = true
        size = next
        invoke('open_terminal', {
          surfaceId: id,
          projectId,
          cols: next.cols,
          rows: next.rows,
          onFrame: channel,
        }).catch((err) => console.error('open_terminal failed', err))
        return
      }

      if (size && next.cols === size.cols && next.rows === size.rows) return
      size = next
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        invoke('resize_terminal', { surfaceId: id, cols: next.cols, rows: next.rows }).catch(() => {})
      }, 150)
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      if (resizeTimer) clearTimeout(resizeTimer)
    }
  }, [id, projectId])

  const onKeyDown: React.KeyboardEventHandler = (e) => {
    const bytes = keyToBytes(e)
    if (!bytes) return
    e.preventDefault()
    invoke('terminal_input', { surfaceId: id, data: Array.from(bytes) }).catch(() => {})
  }

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Terminal"
      tabIndex={0}
      onKeyDown={onKeyDown}
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
    >
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  )
}
