import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { confirm } from '@tauri-apps/plugin-dialog'
import { useVireStore } from '../store/useVireStore'

export function VireTopbar() {
  const projects = useVireStore((s) => s.projects)
  const activeId = useVireStore((s) => s.activeId)
  const boardsByProject = useVireStore((s) => s.boardsByProject)
  const setActive = useVireStore((s) => s.setActive)
  const addProject = useVireStore((s) => s.addProject)
  const renameProject = useVireStore((s) => s.renameProject)
  const removeProject = useVireStore((s) => s.removeProject)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const closeProject = async (id: string, name: string) => {
    const ok = await confirm(`¿Eliminar el proyecto "${name}"? Se borrará todo su contenido de forma permanente.`, {
      title: 'Eliminar proyecto',
      kind: 'warning',
    })
    if (!ok) return
    const board = boardsByProject[id]
    const terminalIds = (board?.blocks ?? []).filter((b) => b.type === 'terminal').map((b) => b.id)
    await Promise.all(terminalIds.map((surfaceId) => invoke('close_terminal', { surfaceId }).catch(() => {})))
    await invoke('delete_project', { id }).catch(() => {})
    removeProject(id)
  }

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
            <div
              key={p.id}
              onClick={() => setActive(p.id)}
              onDoubleClick={() => {
                setEditingId(p.id)
                setDraft(p.name)
              }}
              className={`vire-tab${isActive ? ' active' : ''}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'none',
                borderRadius: 5,
                color: isActive ? 'var(--color-text-secondary)' : 'var(--color-text-muted)',
                padding: '4px 8px 4px 14px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'inherit',
              }}
            >
              <span>{p.name}</span>
              {isActive && (
                <button
                  type="button"
                  aria-label={`Eliminar proyecto ${p.name}`}
                  title="Eliminar proyecto (borra todo su contenido)"
                  onClick={(e) => {
                    e.stopPropagation()
                    void closeProject(p.id, p.name)
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: 'none',
                    borderRadius: 4,
                    color: 'inherit',
                    padding: '2px 6px',
                    cursor: 'pointer',
                    fontSize: 'clamp(9px, 2.4cqw, 11px)',
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
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
