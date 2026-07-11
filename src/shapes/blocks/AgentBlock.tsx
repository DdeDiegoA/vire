import { useState } from 'react'
import { Channel, invoke } from '@tauri-apps/api/core'
import { useVireStore } from '../../store/useVireStore'
import type { AgentData } from '../blockTypes'

type Entry =
  | { kind: 'prompt'; text: string }
  | { kind: 'event'; raw: unknown }
  | { kind: 'error'; text: string }

function EventCard({ raw }: { raw: unknown }) {
  const obj = raw as Record<string, unknown>
  const label = typeof obj?.type === 'string' ? obj.type : 'event'
  return (
    <div
      style={{
        border: '0.5px solid rgba(255, 255, 255, 0.03)',
        borderRadius: 4,
        padding: '4px 7px',
        marginBottom: 3,
        background: 'rgba(0, 0, 0, 0.15)',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          background: 'rgba(255, 255, 255, 0.05)',
          color: 'var(--color-accent)',
          padding: '2px 6px',
          borderRadius: 4,
          fontFamily: 'var(--font-mono)',
          fontSize: 'clamp(9px, 2.5cqw, 10px)',
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <pre
        style={{
          margin: '4px 0 0',
          fontFamily: 'var(--font-mono)',
          fontSize: 'clamp(10px, 2.8cqw, 11px)',
          color: '#888',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {JSON.stringify(raw, null, 2)}
      </pre>
    </div>
  )
}

export function AgentBlock({ id, data }: { id: string; data: AgentData }) {
  const updateBlockData = useVireStore((s) => s.updateBlockData)
  const repoPath = useVireStore((s) => s.projects.find((p) => p.id === s.activeId)?.repoPath)
  const [prompt, setPrompt] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [running, setRunning] = useState(false)

  const send = async () => {
    if (!prompt.trim() || running) return
    const text = prompt
    setPrompt('')
    setEntries((e) => [...e, { kind: 'prompt', text }])
    setRunning(true)

    const channel = new Channel<{ kind: 'Line'; raw: unknown } | { kind: 'Done'; error: string | null }>()
    channel.onmessage = (msg) => {
      if (msg.kind === 'Line') {
        setEntries((e) => [...e, { kind: 'event', raw: msg.raw }])
        const sid = extractSessionId(msg.raw)
        if (sid && sid !== data.sessionId) updateBlockData(id, { ...data, sessionId: sid })
      } else {
        setRunning(false)
        if (msg.error) setEntries((e) => [...e, { kind: 'error', text: msg.error! }])
      }
    }

    try {
      await invoke('run_agent', {
        cli: data.cli,
        prompt: text,
        cwd: data.cwd ?? repoPath ?? '.',
        sessionId: data.sessionId ?? null,
        onEvent: channel,
      })
    } catch (err) {
      setRunning(false)
      setEntries((e) => [...e, { kind: 'error', text: String(err) }])
    }
  }

  let entryKey = 0

  return (
    <div onPointerDown={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          padding: '6px 8px',
          borderBottom: '1px solid var(--color-divider)',
        }}
      >
        <select
          className="v-focus-ring"
          aria-label="CLI a usar"
          value={data.cli}
          onChange={(e) => updateBlockData(id, { ...data, cli: e.target.value as AgentData['cli'], sessionId: undefined })}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '0.5px solid var(--glass-block-border)',
            borderRadius: 6,
            color: '#ccc',
            fontFamily: 'var(--font-mono)',
            fontSize: 'clamp(10px, 2.8cqw, 11px)',
            padding: '3px 6px',
          }}
        >
          <option value="claude">claude</option>
          <option value="opencode">opencode</option>
        </select>
        {running && <span style={{ fontSize: 'clamp(10px, 2.8cqw, 11px)', color: 'var(--color-text-muted)' }}>ejecutando…</span>}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
        {entries.map((entry) => {
          const key = `${entry.kind}-${entryKey++}`
          if (entry.kind === 'prompt') {
            return <div key={key} style={{ color: 'var(--color-text-primary)', fontSize: 'clamp(11px, 3cqw, 12px)', marginBottom: 8, fontWeight: 500 }}>{entry.text}</div>
          }
          if (entry.kind === 'error') {
            return <div key={key} style={{ color: 'var(--color-err)', fontSize: 'clamp(10px, 2.8cqw, 11px)', marginBottom: 8 }}>{entry.text}</div>
          }
          return <EventCard key={key} raw={entry.raw} />
        })}
      </div>

      <div style={{ display: 'flex', gap: 6, padding: 8, borderTop: '1px solid var(--color-divider)' }}>
        <input
          className="v-focus-ring"
          aria-label="Mensaje para el agente"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Escribe un mensaje..."
          style={{
            flex: 1,
            background: 'rgba(0, 0, 0, 0.25)',
            border: '0.5px solid var(--glass-block-border)',
            borderRadius: 6,
            color: '#ccc',
            fontSize: 'clamp(11px, 3cqw, 12px)',
            padding: '4px 9px',
          }}
        />
        <button
          type="button"
          className="v-focus-ring"
          onClick={send}
          disabled={running}
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '0.5px solid var(--glass-block-border)',
            borderRadius: 6,
            color: '#aaa',
            padding: '4px 11px',
            fontSize: 'clamp(10px, 2.8cqw, 11px)',
            cursor: running ? 'default' : 'pointer',
          }}
        >
          Enviar
        </button>
      </div>
    </div>
  )
}

function extractSessionId(raw: unknown): string | undefined {
  const obj = raw as Record<string, unknown>
  const id = obj?.session_id ?? obj?.sessionId ?? (obj?.session as Record<string, unknown> | undefined)?.id
  return typeof id === 'string' ? id : undefined
}
