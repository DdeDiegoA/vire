import { useVireStore } from '../../store/useVireStore'

export interface NoteData {
  text: string
}

export const defaultNoteData: NoteData = { text: '' }

export function NoteBlock({ id, data }: { id: string; data: NoteData }) {
  const updateBlockData = useVireStore((s) => s.updateBlockData)

  return (
    <textarea
      value={data.text}
      onChange={(e) => updateBlockData(id, { ...data, text: e.target.value })}
      onPointerDown={(e) => e.stopPropagation()}
      placeholder="Escribe una nota..."
      style={{
        width: '100%',
        height: '100%',
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
  )
}
