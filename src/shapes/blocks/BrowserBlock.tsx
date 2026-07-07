import { useState } from 'react'
import { useVireStore } from '../../store/useVireStore'
import type { BrowserData } from '../blockTypes'

function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

const navBtnStyle = (enabled: boolean): React.CSSProperties => ({
  background: 'rgba(255, 255, 255, 0.04)',
  border: '0.5px solid var(--glass-block-border)',
  borderRadius: 6,
  color: enabled ? '#ddd' : 'var(--color-text-muted)',
  padding: '4px 8px',
  cursor: enabled ? 'pointer' : 'default',
})

export function BrowserBlock({ id, data }: { id: string; data: BrowserData }) {
  const updateBlockData = useVireStore((s) => s.updateBlockData)
  const url = data.history[data.index] ?? ''
  const [draft, setDraft] = useState(url)
  const [reloadKey, setReloadKey] = useState(0)

  const navigate = () => {
    const next = normalizeUrl(draft)
    setDraft(next)
    if (!next || next === url) return
    const history = [...data.history.slice(0, data.index + 1), next]
    updateBlockData(id, { history, index: history.length - 1 })
  }

  const goBack = () => {
    if (data.index === 0) return
    const index = data.index - 1
    setDraft(data.history[index])
    updateBlockData(id, { ...data, index })
  }

  const goForward = () => {
    if (data.index >= data.history.length - 1) return
    const index = data.index + 1
    setDraft(data.history[index])
    updateBlockData(id, { ...data, index })
  }

  const reload = () => setReloadKey((k) => k + 1)

  return (
    <div onPointerDown={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 6, padding: 8, borderBottom: '1px solid var(--color-divider)' }}>
        <button type="button" onClick={goBack} disabled={data.index === 0} style={navBtnStyle(data.index > 0)}>
          ←
        </button>
        <button
          type="button"
          onClick={goForward}
          disabled={data.index >= data.history.length - 1}
          style={navBtnStyle(data.index < data.history.length - 1)}
        >
          →
        </button>
        <button type="button" onClick={reload} style={navBtnStyle(true)}>
          ⟳
        </button>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2a2a2a' }} />
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2a2a2a' }} />
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2a2a2a' }} />
        <input
          className="v-focus-ring"
          aria-label="URL del navegador"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && navigate()}
          placeholder="https://..."
          style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '0.5px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 4,
            color: '#555',
            padding: '3px 8px',
            fontFamily: 'var(--font-ui)',
            fontSize: 'clamp(10px, 2.8cqw, 12px)',
          }}
        />
        <button type="button" onClick={navigate} style={navBtnStyle(true)}>
          Ir
        </button>
      </div>
      {url ? (
        <iframe key={reloadKey} src={url} title="browser-block" sandbox="allow-scripts allow-forms allow-popups" style={{ flex: 1, border: 'none', background: '#fff' }} />
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-muted)',
            fontSize: 'clamp(11px, 3cqw, 13px)',
          }}
        >
          Escribe una URL para navegar
        </div>
      )}
    </div>
  )
}
