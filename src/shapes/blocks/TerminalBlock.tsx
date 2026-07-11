import { useEffect, useRef } from 'react'
import { Channel, invoke } from '@tauri-apps/api/core'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useVireStore } from '../../store/useVireStore'
import { useActivityStore } from '../../store/useActivityStore'
import type { TerminalData } from '../blockTypes'

const IDLE_AFTER_MS = 1500

const THEME = {
  background: '#141414',
  foreground: '#e5e5e5',
  cursor: '#e5e5e5',
}

export function TerminalBlock({ id, data }: { id: string; zoom: number; data: TerminalData }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const projectId = useVireStore((s) => s.activeId)
  const ownerId = useVireStore((s) => s.activeWorktreeId[s.activeId] ?? s.activeId)
  const markActivity = useActivityStore((s) => s.markActivity)
  const cwdOverride = data.cwd

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new Terminal({
      fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
      fontSize: 12,
      theme: THEME,
      cursorBlink: true,
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(container)

    let idleTimer: ReturnType<typeof setTimeout> | null = null
    const channel = new Channel<number[]>()
    channel.onmessage = (bytes) => {
      term.write(new Uint8Array(bytes))
      markActivity(id, projectId, ownerId, 'terminal', 'Terminal', 'working', useVireStore.getState().activeId)
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        markActivity(id, projectId, ownerId, 'terminal', 'Terminal', 'idle', useVireStore.getState().activeId)
      }, IDLE_AFTER_MS)
    }

    let created = false
    let size = { cols: term.cols, rows: term.rows }
    let resizeTimer: ReturnType<typeof setTimeout> | null = null

    const openOrResize = () => {
      fitAddon.fit()
      const next = { cols: term.cols, rows: term.rows }

      if (!created) {
        created = true
        size = next
        invoke('open_terminal', {
          surfaceId: id,
          projectId,
          cols: next.cols,
          rows: next.rows,
          onData: channel,
          cwdOverride: cwdOverride ?? null,
        }).catch((err) => console.error('open_terminal failed', err))
        return
      }

      if (next.cols === size.cols && next.rows === size.rows) return
      size = next
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        invoke('resize_terminal', { surfaceId: id, cols: next.cols, rows: next.rows }).catch(() => {})
      }, 150)
    }

    const dataDisposable = term.onData((data) => {
      invoke('terminal_input', { surfaceId: id, data: Array.from(new TextEncoder().encode(data)) }).catch(() => {})
    })

    const observer = new ResizeObserver(openOrResize)
    observer.observe(container)

    return () => {
      observer.disconnect()
      dataDisposable.dispose()
      if (resizeTimer) clearTimeout(resizeTimer)
      if (idleTimer) clearTimeout(idleTimer)
      term.dispose()
    }
  }, [id, projectId, ownerId, cwdOverride, markActivity])

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Terminal"
      style={{ width: '100%', height: '100%', overflow: 'hidden', padding: 4 }}
    />
  )
}
