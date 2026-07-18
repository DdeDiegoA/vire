import { useEffect, useState } from 'react'
import { Channel, invoke } from '@tauri-apps/api/core'
import { useVireStore } from '../../store/useVireStore'
import { useActivityStore } from '../../store/useActivityStore'
import { notifyAgentDone } from '../../store/notify'
import type { AgentData } from '../blockTypes'
import type { Worktree } from '../../store/boardTypes'

interface WorktreeDto {
  id: string
  project_id: string
  path: string
  branch: string
}

type Entry =
  | { kind: 'prompt'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'event'; raw: unknown }
  | { kind: 'error'; text: string }

// CLI stream events carry a lot of scaffolding (step boundaries, tool-call
// bookkeeping) alongside the actual reply text. step_start/step_finish are
// pure noise for a chat reading experience — drop them. Text content shows
// up in different shapes per CLI (opencode's {type:'text', part:{text}} vs
// claude's {type:'assistant', message:{content:[{type:'text', text}]}}) —
// normalize both into a plain chat bubble; anything else still falls back
// to the raw event card so nothing is silently lost.
function normalizeEvent(raw: unknown): Entry | null {
  const obj = raw as Record<string, unknown>
  const type = obj?.type

  if (type === 'step_start' || type === 'step_finish') return null

  if (type === 'text') {
    const part = obj.part as Record<string, unknown> | undefined
    const text = typeof part?.text === 'string' ? part.text : undefined
    if (text) return { kind: 'text', text }
  }

  if (type === 'assistant') {
    const content = (obj.message as Record<string, unknown> | undefined)?.content
    if (Array.isArray(content)) {
      const text = content
        .filter((c): c is { type: string; text: string } => (c as { type?: string })?.type === 'text')
        .map((c) => c.text)
        .join('')
      if (text) return { kind: 'text', text }
    }
  }

  return { kind: 'event', raw }
}

function EventCard({ raw }: { raw: unknown }) {
  const obj = raw as Record<string, unknown>
  const label = typeof obj?.type === 'string' ? obj.type : 'event'
  return (
    <div
      style={{
        alignSelf: 'flex-start',
        maxWidth: '85%',
        border: '0.5px solid var(--glass-hairline)',
        borderRadius: 'var(--radius-control)',
        padding: '6px 9px',
        background: 'var(--surface-inset)',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          background: 'rgba(255, 255, 255, 0.05)',
          color: 'var(--color-accent)',
          padding: '2px 6px',
          borderRadius: 'var(--radius-sm)',
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
          color: 'var(--color-text-muted)',
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
  const projectId = useVireStore((s) => s.activeId)
  const ownerId = useVireStore((s) => s.activeWorktreeId[s.activeId] ?? s.activeId)
  const addWorktree = useVireStore((s) => s.addWorktree)
  const setActiveWorktree = useVireStore((s) => s.setActiveWorktree)
  const addBlock = useVireStore((s) => s.addBlock)
  const markActivity = useActivityStore((s) => s.markActivity)
  const [prompt, setPrompt] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [running, setRunning] = useState(false)
  const [fanningOut, setFanningOut] = useState(false)

  const send = async (override?: string) => {
    const text = (override ?? prompt).trim()
    if (!text || running) return
    if (!override) setPrompt('')
    setEntries((e) => [...e, { kind: 'prompt', text }])
    setRunning(true)
    const agentTitle = `Agente (${data.cli})`
    markActivity(id, projectId, ownerId, 'agent', agentTitle, 'working', useVireStore.getState().activeId)

    const channel = new Channel<{ kind: 'Line'; raw: unknown } | { kind: 'Done'; error: string | null }>()
    channel.onmessage = (msg) => {
      if (msg.kind === 'Line') {
        const entry = normalizeEvent(msg.raw)
        if (entry) setEntries((e) => [...e, entry])
        const sid = extractSessionId(msg.raw)
        if (sid && sid !== data.sessionId) updateBlockData(id, { ...data, sessionId: sid })
      } else {
        setRunning(false)
        if (msg.error) setEntries((e) => [...e, { kind: 'error', text: msg.error! }])
        markActivity(id, projectId, ownerId, 'agent', agentTitle, 'done', useVireStore.getState().activeId)
        if (!msg.error) void notifyAgentDone('Agente terminado', agentTitle)
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

  useEffect(() => {
    if (!data.initialPrompt) return
    const p = data.initialPrompt
    updateBlockData(id, { ...data, initialPrompt: undefined })
    void send(p)
    // ponytail: initialPrompt is a one-shot handoff (diff-comment/fan-out), not a live dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.initialPrompt])

  const fanOut = async () => {
    const text = prompt.trim()
    if (!text || fanningOut) return
    if (!projectId) {
      setEntries((e) => [...e, { kind: 'error', text: 'No hay proyecto activo.' }])
      return
    }
    const raw = window.prompt('¿A cuántos agentes en paralelo (worktrees) enviar este prompt?', '3')
    const n = Math.min(8, Math.max(2, Number(raw) || 0))
    if (!n) return
    setFanningOut(true)
    let created = 0
    try {
      for (let i = 1; i <= n; i++) {
        const branch = `fanout/${id}-${Date.now()}-${i}`
        const wt = await invoke<WorktreeDto>('create_worktree', { projectId, branch, base: null })
        const worktree: Worktree = { id: wt.id, projectId: wt.project_id, path: wt.path, branch: wt.branch }
        addWorktree(worktree)
        setActiveWorktree(projectId, worktree.id)
        addBlock('agent', 40 + i * 30, 40 + i * 30, { cli: data.cli, cwd: worktree.path, initialPrompt: text })
        created++
      }
      setPrompt('')
    } catch (err) {
      // partial fan-out: keep the prompt so the user can see what was sent and retry the rest manually
      setEntries((e) => [...e, { kind: 'error', text: `Fan-out: ${created}/${n} worktrees creados. ${String(err)}` }])
    } finally {
      setFanningOut(false)
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
            borderRadius: 'var(--radius-pill)',
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'clamp(10px, 2.8cqw, 11px)',
            padding: '3px 8px',
          }}
        >
          <option value="claude">claude</option>
          <option value="opencode">opencode</option>
        </select>
        {running && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'clamp(10px, 2.8cqw, 11px)', color: 'var(--color-text-muted)' }}>
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: 'var(--color-accent)',
                animation: 'vire-pulse 1.4s ease-in-out infinite',
              }}
            />
            ejecutando…
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {entries.map((entry) => {
          const key = `${entry.kind}-${entryKey++}`
          if (entry.kind === 'prompt') {
            return (
              <div
                key={key}
                style={{
                  alignSelf: 'flex-end',
                  maxWidth: '85%',
                  background: 'var(--color-accent)',
                  color: 'var(--color-text-inverse)',
                  borderRadius: 'var(--radius-control)',
                  borderBottomRightRadius: 'var(--radius-sm)',
                  padding: '6px 10px',
                  fontSize: 'clamp(11px, 3cqw, 12px)',
                  fontWeight: 500,
                  lineHeight: 1.4,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {entry.text}
              </div>
            )
          }
          if (entry.kind === 'error') {
            return (
              <div
                key={key}
                style={{
                  alignSelf: 'flex-start',
                  maxWidth: '85%',
                  background: 'var(--surface-inset)',
                  border: '0.5px solid var(--color-err)',
                  color: 'var(--color-err)',
                  borderRadius: 'var(--radius-control)',
                  borderBottomLeftRadius: 'var(--radius-sm)',
                  padding: '6px 10px',
                  fontSize: 'clamp(10px, 2.8cqw, 11px)',
                }}
              >
                {entry.text}
              </div>
            )
          }
          if (entry.kind === 'text') {
            return (
              <div
                key={key}
                style={{
                  alignSelf: 'flex-start',
                  maxWidth: '85%',
                  background: 'var(--glass-block-bg)',
                  border: '0.5px solid var(--glass-hairline)',
                  color: 'var(--color-text-primary)',
                  borderRadius: 'var(--radius-control)',
                  borderBottomLeftRadius: 'var(--radius-sm)',
                  padding: '6px 10px',
                  fontSize: 'clamp(11px, 3cqw, 12px)',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {entry.text}
              </div>
            )
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
            background: 'var(--surface-inset)',
            border: '0.5px solid var(--glass-block-border)',
            borderRadius: 'var(--radius-pill)',
            color: 'var(--color-text-primary)',
            fontSize: 'clamp(11px, 3cqw, 12px)',
            padding: '6px 12px',
          }}
        />
        <button
          type="button"
          className="v-focus-ring"
          onClick={fanOut}
          disabled={running || fanningOut || !prompt.trim()}
          title="Enviar este prompt a N agentes en paralelo, cada uno en su propio worktree"
          style={{
            background: 'transparent',
            border: '0.5px solid var(--glass-block-border)',
            borderRadius: 'var(--radius-pill)',
            color: 'var(--color-text-secondary)',
            padding: '6px 12px',
            fontSize: 'clamp(10px, 2.8cqw, 11px)',
            cursor: fanningOut ? 'default' : 'pointer',
          }}
        >
          {fanningOut ? '...' : 'Fan-out'}
        </button>
        <button
          type="button"
          className="v-focus-ring"
          onClick={() => send()}
          disabled={running || !prompt.trim()}
          style={{
            background: prompt.trim() && !running ? 'var(--color-accent)' : 'var(--surface-inset)',
            border: '0.5px solid var(--glass-block-border)',
            borderRadius: 'var(--radius-pill)',
            color: prompt.trim() && !running ? 'var(--color-text-inverse)' : 'var(--color-text-muted)',
            padding: '6px 14px',
            fontSize: 'clamp(10px, 2.8cqw, 11px)',
            fontWeight: 600,
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
