import { useState } from 'react'
import { Channel, invoke } from '@tauri-apps/api/core'
import { useVireStore } from '../../store/useVireStore'

export interface AgentData {
  cli: 'claude' | 'opencode'
  sessionId?: string
}

export const defaultAgentData: AgentData = { cli: 'claude' }

type Entry =
  | { kind: 'prompt'; text: string }
  | { kind: 'event'; raw: unknown }
  | { kind: 'error'; text: string }

// ponytail: raw JSON events from the CLI are rendered generically (name +
// pretty JSON) instead of a per-CLI parsed UI — claude (stream-json) and
// opencode (--format json) don't share a schema yet. Upgrade to structured
// tool-call cards once real usage shows what's common across both.
function EventCard({ raw }: { raw: unknown }) {
  const obj = raw as Record<string, unknown>
  const label = typeof obj?.type === 'string' ? obj.type : 'event'
  return (
    <div
      style={{
        border: '1px solid var(--color-divider)',
        borderRadius: 'var(--radius-control)',
        padding: '6px 8px',
        marginBottom: 6,
        background: 'var(--color-surface)',
      }}
    >
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-path)' }}>{label}</div>
      <pre
        style={{
          margin: '4px 0 0',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--color-text-secondary)',
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
        cwd: '.',
        sessionId: data.sessionId ?? null,
        onEvent: channel,
      })
    } catch (err) {
      setRunning(false)
      setEntries((e) => [...e, { kind: 'error', text: String(err) }])
    }
  }

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
          value={data.cli}
          onChange={(e) => updateBlockData(id, { ...data, cli: e.target.value as AgentData['cli'], sessionId: undefined })}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-divider)',
            borderRadius: 'var(--radius-control)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            padding: '3px 6px',
          }}
        >
          <option value="claude">claude</option>
          <option value="opencode">opencode</option>
        </select>
        {running && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>ejecutando…</span>}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
        {entries.map((entry, i) =>
          entry.kind === 'prompt' ? (
            <div key={i} style={{ color: 'var(--color-text-primary)', fontSize: 12, marginBottom: 8, fontWeight: 500 }}>
              {entry.text}
            </div>
          ) : entry.kind === 'error' ? (
            <div key={i} style={{ color: 'var(--color-err)', fontSize: 11, marginBottom: 8 }}>
              {entry.text}
            </div>
          ) : (
            <EventCard key={i} raw={entry.raw} />
          ),
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, padding: 8, borderTop: '1px solid var(--color-divider)' }}>
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Escribe un mensaje..."
          style={{
            flex: 1,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-divider)',
            borderRadius: 'var(--radius-control)',
            color: 'var(--color-text-primary)',
            fontSize: 12,
            padding: '4px 8px',
          }}
        />
        <button
          onClick={send}
          disabled={running}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-divider)',
            borderRadius: 'var(--radius-control)',
            color: 'var(--color-text-secondary)',
            padding: '4px 10px',
            fontSize: 11,
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
