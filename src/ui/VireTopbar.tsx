import { useState } from 'react'
import { useVireStore } from '../store/useVireStore'

export function VireTopbar() {
  const projects = useVireStore((s) => s.projects)
  const activeId = useVireStore((s) => s.activeId)
  const setActive = useVireStore((s) => s.setActive)
  const addProject = useVireStore((s) => s.addProject)
  const renameProject = useVireStore((s) => s.renameProject)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const commitRename = () => {
    const name = draft.trim()
    if (editingId && name) renameProject(editingId, name)
    setEditingId(null)
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 38,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-6)',
        background: 'var(--glass-topbar-bg)',
        borderBottom: '0.5px solid var(--glass-hairline)',
        backdropFilter: 'var(--glass-blur-topbar)',
        WebkitBackdropFilter: 'var(--glass-blur-topbar)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'clamp(11px, 3cqw, 13px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 'clamp(13px, 3.5cqw, 15px)', color: 'var(--color-text-primary)', letterSpacing: '0.02em' }}>
          Vire
        </span>
        <span
          style={{
            fontSize: 'clamp(9px, 2.5cqw, 10px)',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-pill)',
            padding: '2px 10px',
          }}
        >
          β
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {projects.map((p) => {
          const isActive = p.id === activeId
          if (editingId === p.id) {
            return (
              <input
                key={p.id}
                aria-label="Nombre del proyecto"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') setEditingId(null)
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  borderRadius: 5,
                  color: 'var(--color-text-secondary)',
                  padding: '4px 14px',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  width: `${Math.max(6, draft.length)}ch`,
                }}
              />
            )
          }
          return (
            <button
              type="button"
              key={p.id}
              onClick={() => setActive(p.id)}
              onDoubleClick={() => {
                setEditingId(p.id)
                setDraft(p.name)
              }}
              className={`vire-tab${isActive ? ' active' : ''}`}
              style={{
                background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'none',
                border: 'none',
                borderRadius: 5,
                color: isActive ? 'var(--color-text-secondary)' : 'var(--color-text-muted)',
                padding: '4px 14px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'inherit',
              }}
            >
              {p.name}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={addProject}
        title="Nuevo proyecto"
        className="vire-tab"
        style={{
          background: 'none',
          border: 'none',
          borderRadius: 5,
          padding: '2px 8px',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          fontSize: 'clamp(14px, 3.8cqw, 16px)',
        }}
      >
        +
      </button>
    </div>
  )
}
