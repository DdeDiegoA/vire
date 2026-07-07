import { marked } from 'marked'
import { useVireStore } from '../../store/useVireStore'
import type { NoteData } from '../blockTypes'

export function NoteBlock({ id, data }: { id: string; data: NoteData }) {
  const updateBlockData = useVireStore((s) => s.updateBlockData)
  const mode = data.mode ?? 'edit'
  const toggleMode = () => updateBlockData(id, { ...data, mode: mode === 'edit' ? 'preview' : 'edit' })

  return (
    <div onPointerDown={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 8px', borderBottom: '1px solid var(--color-divider)' }}>
        <button
          type="button"
          onClick={toggleMode}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-divider)',
            borderRadius: 'var(--radius-control)',
            color: 'var(--color-text-secondary)',
            padding: '2px 8px',
            fontSize: 'clamp(9px, 2.5cqw, 12px)',
            cursor: 'pointer',
          }}
        >
          {mode === 'edit' ? 'Preview' : 'Editar'}
        </button>
      </div>
      {mode === 'edit' ? (
        <textarea
          aria-label="Contenido de la nota"
          value={data.text}
          onChange={(e) => updateBlockData(id, { ...data, text: e.target.value })}
          placeholder="Escribe una nota..."
          style={{
            flex: 1,
            resize: 'none',
            border: 'none',
            padding: 14,
            fontFamily: 'var(--font-ui)',
            fontSize: 'clamp(11px, 3.2cqw, 15px)',
            lineHeight: 1.55,
            color: '#bbb',
            background: 'transparent',
          }}
        />
      ) : (
        <div
          className="note-content"
          style={{ flex: 1, overflow: 'auto', padding: 14, fontFamily: 'var(--font-ui)', fontSize: 'clamp(11px, 3.2cqw, 15px)', lineHeight: 1.55, color: '#bbb' }}
          dangerouslySetInnerHTML={{ __html: marked.parse(data.text || '_Nada que mostrar_', { async: false }) as string }}
        />
      )}
    </div>
  )
}
