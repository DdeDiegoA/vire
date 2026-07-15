import { useEffect, useRef, useState } from 'react'
import { Channel, invoke } from '@tauri-apps/api/core'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import { Plus, X } from 'reicon-react'
import { useVireStore } from '../../store/useVireStore'
import { useActivityStore } from '../../store/useActivityStore'
import type { TerminalData, TerminalTab } from '../blockTypes'

const IDLE_AFTER_MS = 1500
const GIT_POLL_MS = 5000

const THEME = {
  background: '#141414',
  foreground: '#e5e5e5',
  cursor: '#e5e5e5',
}

interface GitStatusDto {
  staged: unknown[]
  unstaged: unknown[]
  untracked: unknown[]
  branch: string | null
}

function TerminalSession({
  surfaceId,
  blockId,
  projectId,
  ownerId,
  cwd,
  markActivity,
}: {
  surfaceId: string
  blockId: string
  projectId: string
  ownerId: string
  cwd?: string
  markActivity: ReturnType<typeof useActivityStore.getState>['markActivity']
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

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
    const searchAddon = new SearchAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(searchAddon)
    searchAddonRef.current = searchAddon
    term.open(container)

    invoke<Uint8Array | number[] | null>('get_terminal_scrollback', { surfaceId })
      .then((bytes) => {
        if (bytes && bytes.length) term.write(new Uint8Array(bytes))
      })
      .catch(() => {})

    let idleTimer: ReturnType<typeof setTimeout> | null = null
    const channel = new Channel<number[]>()
    channel.onmessage = (bytes) => {
      term.write(new Uint8Array(bytes))
      markActivity(blockId, projectId, ownerId, 'terminal', 'Terminal', 'working', useVireStore.getState().activeId)
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        markActivity(blockId, projectId, ownerId, 'terminal', 'Terminal', 'idle', useVireStore.getState().activeId)
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
          surfaceId,
          projectId,
          cols: next.cols,
          rows: next.rows,
          onData: channel,
          cwdOverride: cwd ?? null,
        }).catch((err) => console.error('open_terminal failed', err))
        return
      }

      if (next.cols === size.cols && next.rows === size.rows) return
      size = next
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        invoke('resize_terminal', { surfaceId, cols: next.cols, rows: next.rows }).catch(() => {})
      }, 150)
    }

    const dataDisposable = term.onData((chunk) => {
      invoke('terminal_input', { surfaceId, data: Array.from(new TextEncoder().encode(chunk)) }).catch(() => {})
    })

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    container.addEventListener('keydown', onKeyDown)

    const observer = new ResizeObserver(openOrResize)
    observer.observe(container)

    return () => {
      observer.disconnect()
      container.removeEventListener('keydown', onKeyDown)
      dataDisposable.dispose()
      if (resizeTimer) clearTimeout(resizeTimer)
      if (idleTimer) clearTimeout(idleTimer)
      term.dispose()
    }
    // surfaceId identifies this session; the parent remounts this component
    // (via `key`) whenever the active tab changes, so a plain mount-once
    // effect is correct here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={containerRef}
        role="application"
        aria-label="Terminal"
        tabIndex={0}
        style={{ width: '100%', height: '100%', overflow: 'hidden', padding: 4, outline: 'none' }}
      />
      {searchOpen && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            display: 'flex',
            gap: 4,
            background: 'var(--glass-block-bg)',
            border: '0.5px solid var(--glass-block-border)',
            borderRadius: 6,
            padding: 4,
            backdropFilter: 'var(--glass-blur)',
          }}
        >
          <input
            autoFocus
            aria-label="Buscar en la terminal"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (e.shiftKey) searchAddonRef.current?.findPrevious(searchQuery)
                else searchAddonRef.current?.findNext(searchQuery)
              }
              if (e.key === 'Escape') setSearchOpen(false)
            }}
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              border: '0.5px solid var(--glass-block-border)',
              borderRadius: 4,
              color: '#ccc',
              fontSize: 11,
              padding: '2px 6px',
              width: 140,
            }}
          />
          <button
            type="button"
            aria-label="Cerrar búsqueda"
            onClick={() => setSearchOpen(false)}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'inline-flex' }}
          >
            <X size={11} weight="Outline" />
          </button>
        </div>
      )}
    </div>
  )
}

export function TerminalBlock({ id, data }: { id: string; zoom: number; data: TerminalData }) {
  const updateBlockData = useVireStore((s) => s.updateBlockData)
  const projectId = useVireStore((s) => s.activeId)
  const ownerId = useVireStore((s) => s.activeWorktreeId[s.activeId] ?? s.activeId)
  const markActivity = useActivityStore((s) => s.markActivity)
  const [gitStatus, setGitStatus] = useState<GitStatusDto | null>(null)

  const tabs = data.tabs
  const activeTab: TerminalTab = tabs.find((t) => t.id === data.activeTabId) ?? tabs[0]

  useEffect(() => {
    if (!activeTab.cwd) {
      setGitStatus(null)
      return
    }
    let cancelled = false
    const poll = () => {
      invoke<GitStatusDto>('git_status', { repoPath: activeTab.cwd })
        .then((s) => !cancelled && setGitStatus(s))
        .catch(() => !cancelled && setGitStatus(null))
    }
    poll()
    const interval = setInterval(poll, GIT_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [activeTab.cwd])

  const addTab = () => {
    const newTab: TerminalTab = { id: crypto.randomUUID(), cwd: activeTab.cwd }
    updateBlockData(id, { ...data, tabs: [...tabs, newTab], activeTabId: newTab.id })
  }

  const closeTab = (tabId: string) => {
    if (tabs.length <= 1) return
    invoke('close_terminal', { surfaceId: `${id}:${tabId}` }).catch(() => {})
    const remaining = tabs.filter((t) => t.id !== tabId)
    const activeTabId = data.activeTabId === tabId ? remaining[0].id : data.activeTabId
    updateBlockData(id, { ...data, tabs: remaining, activeTabId })
  }

  const dirty = gitStatus ? gitStatus.staged.length + gitStatus.unstaged.length + gitStatus.untracked.length > 0 : false

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 6px',
          borderBottom: '0.5px solid var(--glass-hairline)',
          fontSize: 10,
          color: 'var(--color-text-muted)',
        }}
      >
        {tabs.map((tab, i) => (
          <div
            key={tab.id}
            onClick={() => updateBlockData(id, { ...data, activeTabId: tab.id })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 6px',
              borderRadius: 4,
              cursor: 'pointer',
              background: tab.id === activeTab.id ? 'rgba(255, 255, 255, 0.08)' : 'none',
              color: tab.id === activeTab.id ? 'var(--color-text-secondary)' : 'var(--color-text-muted)',
            }}
          >
            <span>{i + 1}</span>
            {tabs.length > 1 && (
              <X
                size={9}
                weight="Outline"
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(tab.id)
                }}
              />
            )}
          </div>
        ))}
        <button
          type="button"
          aria-label="Nueva tab"
          onClick={addTab}
          style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'inline-flex' }}
        >
          <Plus size={11} weight="Outline" />
        </button>
        {gitStatus?.branch && (
          <span style={{ marginLeft: 'auto', color: dirty ? '#e5a94e' : 'var(--color-text-muted)' }}>
            {gitStatus.branch}
            {dirty ? ' •' : ''}
          </span>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <TerminalSession
          key={`${id}:${activeTab.id}`}
          surfaceId={`${id}:${activeTab.id}`}
          blockId={id}
          projectId={projectId}
          ownerId={ownerId}
          cwd={activeTab.cwd}
          markActivity={markActivity}
        />
      </div>
    </div>
  )
}
