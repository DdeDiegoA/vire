import { useState } from 'react'
import { useVireStore } from '../../store/useVireStore'

export interface BrowserData {
  history: string[]
  index: number
}

export const defaultBrowserData: BrowserData = { history: [''], index: 0 }

function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function BrowserBlock({ id, data }: { id: string; data: BrowserData }) {
  const updateBlockData = useVireStore((s) => s.updateBlockData)
  const url = data.history[data.index] ?? ''
  const [draft, setDraft] = useState(url)
  const [reloadKey, setReloadKey] = useState(0)

  const navigate = () => {
    const next = normalizeUrl(draft)
    setDraft(next)
    if (!next || next === url) return
    // push: drop any forward history past the current index
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

  const navBtnStyle = (enabled: boolean): React.CSSProperties => ({
    background: 'var(--color-surface)',
    border: '1px solid var(--color-divider)',
    borderRadius: 'var(--radius-control)',
    color: enabled ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
    padding: '4px 8px',
    cursor: enabled ? 'pointer' : 'default',
  })

  return (
    <div onPointerDown={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 6, padding: 8, borderBottom: '1px solid var(--color-divider)' }}>
        <button onClick={goBack} disabled={data.index === 0} style={navBtnStyle(data.index > 0)}>
          ←
        </button>
        <button
          onClick={goForward}
          disabled={data.index >= data.history.length - 1}
          style={navBtnStyle(data.index < data.history.length - 1)}
        >
          →
        </button>
        <button onClick={reload} style={navBtnStyle(true)}>
          ⟳
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && navigate()}
          placeholder="https://..."
          style={{
            flex: 1,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-divider)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text-primary)',
            padding: '4px 8px',
            fontFamily: 'var(--font-ui)',
            fontSize: 12,
          }}
        />
        <button onClick={navigate} style={navBtnStyle(true)}>
          Ir
        </button>
      </div>
      {url ? (
        // ponytail: iframe navigation, not a native webview — sites with X-Frame-Options/CSP
        // frame-ancestors will still refuse to load. Ceiling of this approach; upgrade to a
        // Tauri child webview if that becomes a blocker.
        <iframe key={reloadKey} src={url} title="browser-block" style={{ flex: 1, border: 'none', background: '#fff' }} />
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-muted)',
            fontSize: 12,
          }}
        >
          Escribe una URL para navegar
        </div>
      )}
    </div>
  )
}
