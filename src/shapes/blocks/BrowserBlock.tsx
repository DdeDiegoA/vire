import { useState } from 'react'
import { useVireStore } from '../../store/useVireStore'

export interface BrowserData {
  url: string
}

export const defaultBrowserData: BrowserData = { url: '' }

function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function BrowserBlock({ id, data }: { id: string; data: BrowserData }) {
  const updateBlockData = useVireStore((s) => s.updateBlockData)
  const [draft, setDraft] = useState(data.url)

  const navigate = () => {
    const url = normalizeUrl(draft)
    setDraft(url)
    updateBlockData(id, { ...data, url })
  }

  return (
    <div onPointerDown={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 6, padding: 8, borderBottom: '1px solid var(--color-divider)' }}>
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
        <button
          onClick={navigate}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-divider)',
            borderRadius: 'var(--radius-control)',
            color: 'var(--color-text-primary)',
            padding: '4px 10px',
            cursor: 'pointer',
          }}
        >
          Ir
        </button>
      </div>
      {data.url ? (
        <iframe src={data.url} title="browser-block" style={{ flex: 1, border: 'none', background: '#fff' }} />
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
