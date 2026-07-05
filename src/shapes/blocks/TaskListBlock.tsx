import { useState } from 'react'
import { useVireStore } from '../../store/useVireStore'

export interface TaskItem {
  id: number
  text: string
  done: boolean
}

export interface TaskListData {
  items: TaskItem[]
  seq: number
}

export const defaultTaskListData: TaskListData = {
  items: [],
  seq: 0,
}

export function TaskListBlock({ id, data }: { id: string; data: TaskListData }) {
  const updateBlockData = useVireStore((s) => s.updateBlockData)
  const [draft, setDraft] = useState('')

  const update = (partial: Partial<TaskListData>) => updateBlockData(id, { ...data, ...partial })

  const addItem = () => {
    const text = draft.trim()
    if (!text) return
    update({
      items: [...data.items, { id: data.seq, text, done: false }],
      seq: data.seq + 1,
    })
    setDraft('')
  }

  const toggleItem = (itemId: number) =>
    update({ items: data.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) })

  const removeItem = (itemId: number) => update({ items: data.items.filter((i) => i.id !== itemId) })

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12, fontFamily: 'var(--font-ui)', fontSize: 13 }}
    >
      {data.items.map((item) => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={item.done} onChange={() => toggleItem(item.id)} />
          <span
            style={{
              flex: 1,
              color: item.done ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
              textDecoration: item.done ? 'line-through' : 'none',
            }}
          >
            {item.text}
          </span>
          <button
            onClick={() => removeItem(item.id)}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          placeholder="Nueva tarea..."
          style={{
            flex: 1,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-divider)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text-primary)',
            padding: '4px 8px',
            fontFamily: 'inherit',
            fontSize: 'inherit',
          }}
        />
        <button
          onClick={addItem}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-divider)',
            borderRadius: 'var(--radius-control)',
            color: 'var(--color-text-primary)',
            padding: '4px 10px',
            cursor: 'pointer',
          }}
        >
          +
        </button>
      </div>
    </div>
  )
}
