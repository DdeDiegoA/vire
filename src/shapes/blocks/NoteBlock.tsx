import { marked } from 'marked'
import { useVireStore } from '../../store/useVireStore'

export interface NoteData {
  text: string
  mode?: 'edit' | 'preview'
}

export const defaultNoteData: NoteData = { text: '', mode: 'edit' }

export function NoteBlock({ id, data }: { id: string; data: NoteData }) {
  const updateBlockData = useVireStore((s) => s.updateBlockData)
  const mode = data.mode ?? 'edit'
  const toggleMode = () => updateBlockData(id, { ...data, mode: mode === 'edit' ? 'preview' : 'edit' })

  return (
    <div onPointerDown={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 8px', borderBottom: '1px solid var(--color-divider)' }}>
        <button
          onClick={toggleMode}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-divider)',
            borderRadius: 'var(--radius-control)',
            color: 'var(--color-text-secondary)',
            padding: '2px 8px',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          {mode === 'edit' ? 'Preview' : 'Editar'}
        </button>
      </div>
      {mode === 'edit' ? (
        <textarea
          value={data.text}
          onChange={(e) => updateBlockData(id, { ...data, text: e.target.value })}
          placeholder="Escribe una nota..."
          style={{
            flex: 1,
            resize: 'none',
            border: 'none',
            outline: 'none',
            padding: 14,
            fontFamily: 'var(--font-ui)',
            fontSize: 13,
            lineHeight: 1.55,
            color: 'var(--color-text-primary)',
            background: 'var(--color-surface-elevated)',
          }}
        />
      ) : (
        <div
          style={{ flex: 1, overflow: 'auto', padding: 14, fontFamily: 'var(--font-ui)', fontSize: 13, lineHeight: 1.55, color: 'var(--color-text-primary)' }}
          // ponytail: notes are the user's own local content, not remote input — dangerouslySetInnerHTML
          // is acceptable here. Revisit with a sanitizer if notes ever get shared/imported.
          dangerouslySetInnerHTML={{ __html: marked.parse(data.text || '_Nada que mostrar_', { async: false }) as string }}
        />
      )}
    </div>
  )
}
