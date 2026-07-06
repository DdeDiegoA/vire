import { useState } from 'react'
import { useVireStore } from '../../store/useVireStore'

export interface TaskItem {
  id: number
  text: string
  done: boolean
  children?: TaskItem[]
}

export interface TaskListData {
  items: TaskItem[]
  seq: number
}

export const defaultTaskListData: TaskListData = {
  items: [],
  seq: 0,
}

function updateTree(items: TaskItem[], itemId: number, updater: (item: TaskItem) => TaskItem): TaskItem[] {
  return items.map((item) => {
    if (item.id === itemId) return updater(item)
    if (item.children?.length) return { ...item, children: updateTree(item.children, itemId, updater) }
    return item
  })
}

function removeFromTree(items: TaskItem[], itemId: number): TaskItem[] {
  return items
    .filter((item) => item.id !== itemId)
    .map((item) => (item.children ? { ...item, children: removeFromTree(item.children, itemId) } : item))
}

function addChild(items: TaskItem[], parentId: number, child: TaskItem): TaskItem[] {
  return items.map((item) => {
    if (item.id === parentId) return { ...item, children: [...(item.children ?? []), child] }
    if (item.children?.length) return { ...item, children: addChild(item.children, parentId, child) }
    return item
  })
}

const rowStyle = {
  flex: 1,
  background: 'var(--color-surface)',
  border: '1px solid var(--color-divider)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-text-primary)',
  padding: '4px 8px',
  fontFamily: 'inherit',
  fontSize: 'inherit',
} as const

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
    update({ items: updateTree(data.items, itemId, (item) => ({ ...item, done: !item.done })) })

  const removeItem = (itemId: number) => update({ items: removeFromTree(data.items, itemId) })

  const addSubtask = (parentId: number, text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    update({
      items: addChild(data.items, parentId, { id: data.seq, text: trimmed, done: false }),
      seq: data.seq + 1,
    })
  }

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12, fontFamily: 'var(--font-ui)', fontSize: 13 }}
    >
      {data.items.map((item) => (
        <TaskRow key={item.id} item={item} depth={0} onToggle={toggleItem} onRemove={removeItem} onAddSubtask={addSubtask} />
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          placeholder="Nueva tarea..."
          style={rowStyle}
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

function TaskRow({
  item,
  depth,
  onToggle,
  onRemove,
  onAddSubtask,
}: {
  item: TaskItem
  depth: number
  onToggle: (itemId: number) => void
  onRemove: (itemId: number) => void
  onAddSubtask: (parentId: number, text: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [subDraft, setSubDraft] = useState('')

  const commitSubtask = () => {
    onAddSubtask(item.id, subDraft)
    setSubDraft('')
    setAdding(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: depth * 16 }}>
        <input type="checkbox" checked={item.done} onChange={() => onToggle(item.id)} />
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
          onClick={() => setAdding((v) => !v)}
          title="Agregar subtarea"
          style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
        >
          ↳
        </button>
        <button
          onClick={() => onRemove(item.id)}
          style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
        >
          ×
        </button>
      </div>

      {adding && (
        <div style={{ display: 'flex', gap: 6, paddingLeft: (depth + 1) * 16 }}>
          <input
            autoFocus
            value={subDraft}
            onChange={(e) => setSubDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commitSubtask()}
            placeholder="Subtarea..."
            style={{ ...rowStyle, padding: '3px 6px', fontSize: 12 }}
          />
        </div>
      )}

      {item.children?.map((child) => (
        <TaskRow key={child.id} item={child} depth={depth + 1} onToggle={onToggle} onRemove={onRemove} onAddSubtask={onAddSubtask} />
      ))}
    </div>
  )
}
