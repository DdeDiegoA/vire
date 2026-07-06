import { useEffect, useRef } from 'react'
import { Channel, invoke } from '@tauri-apps/api/core'

const FONT = "11px 'JetBrains Mono', 'Cascadia Code', monospace"
const CELL_W = 6.6
const CELL_H = 15
const PAD = 8

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

function cols(w: number) {
  return Math.max(2, Math.floor((w - PAD * 2) / CELL_W))
}
function rows(h: number) {
  return Math.max(1, Math.floor((h - PAD * 2) / CELL_H))
}

function drawFrame(canvas: HTMLCanvasElement, frame: TermFrame) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  const w = frame.cols * CELL_W + PAD * 2
  const h = frame.rows * CELL_H + PAD * 2
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = '#0d0f12'
  ctx.fillRect(0, 0, w, h)
  ctx.font = FONT
  ctx.textBaseline = 'top'

  frame.grid.forEach((line, y) => {
    line.forEach((cell, x) => {
      const px = PAD + x * CELL_W
      const py = PAD + y * CELL_H
      const inverse = cell.inverse
      const fg = cell.fg ? `rgb(${cell.fg.join(',')})` : '#e5e5e5'
      const bg = cell.bg ? `rgb(${cell.bg.join(',')})` : null
      const paintBg = inverse ? fg : bg
      const paintFg = inverse ? (bg ?? '#0d0f12') : fg
      if (paintBg) {
        ctx.fillStyle = paintBg
        ctx.fillRect(px, py, CELL_W, CELL_H)
      }
      if (cell.ch && cell.ch !== ' ') {
        ctx.fillStyle = paintFg
        ctx.font = cell.bold ? `bold ${FONT}` : FONT
        ctx.fillText(cell.ch, px, py + 1)
      }
    })
  })

  if (frame.cursor.visible) {
    const cx = PAD + frame.cursor.x * CELL_W
    const cy = PAD + frame.cursor.y * CELL_H
    ctx.fillStyle = 'rgba(229,229,229,0.6)'
    ctx.fillRect(cx, cy, CELL_W, CELL_H)
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

export function TerminalBlock({ id }: { id: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const channel = new Channel<TermFrame>()
    channel.onmessage = (frame) => {
      if (canvasRef.current) drawFrame(canvasRef.current, frame)
    }

    const container = containerRef.current
    if (!container) return

    let created = false
    let size: { cols: number; rows: number } | null = null
    let resizeTimer: ReturnType<typeof setTimeout> | null = null

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      const next = { cols: cols(width), rows: rows(height) }

      if (!created) {
        created = true
        size = next
        invoke('create_terminal', {
          surfaceId: id,
          cols: next.cols,
          rows: next.rows,
          onFrame: channel,
        }).catch((err) => console.error('create_terminal failed', err))
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
      invoke('close_terminal', { surfaceId: id }).catch(() => {})
    }
  }, [id])

  const onKeyDown: React.KeyboardEventHandler = (e) => {
    const bytes = keyToBytes(e)
    if (!bytes) return
    e.preventDefault()
    invoke('terminal_input', { surfaceId: id, data: Array.from(bytes) }).catch(() => {})
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      style={{ width: '100%', height: '100%', overflow: 'hidden', outline: 'none' }}
    >
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  )
}
