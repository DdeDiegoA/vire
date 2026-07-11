import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { confirm } from '@tauri-apps/plugin-dialog'
import { Flask, X, Plus, ChevronDown, Bell } from 'reicon-react'
import { useVireStore } from '../store/useVireStore'
import { useActivityStore } from '../store/useActivityStore'
import { WorktreeDropdown } from './WorktreeDropdown'

export function VireTopbar() {
  const projects = useVireStore((s) => s.projects)
  const activeId = useVireStore((s) => s.activeId)
  const boardsByOwner = useVireStore((s) => s.boardsByOwner)
  const worktreesByProject = useVireStore((s) => s.worktreesByProject)
  const setActive = useVireStore((s) => s.setActive)
  const addProject = useVireStore((s) => s.addProject)
  const renameProject = useVireStore((s) => s.renameProject)
  const removeProject = useVireStore((s) => s.removeProject)
  const unreadByProject = useActivityStore((s) => s.unreadByProject)
  const events = useActivityStore((s) => s.events)
  const clearUnread = useActivityStore((s) => s.clearUnread)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [worktreeMenuFor, setWorktreeMenuFor] = useState<string | null>(null)
  const [inboxOpen, setInboxOpen] = useState(false)

  const goToActivity = (targetProjectId: string) => {
    setActive(targetProjectId)
    clearUnread(targetProjectId)
    setInboxOpen(false)
  }

  const closeProject = async (id: string, name: string) => {
    const ok = await confirm(`¿Eliminar el proyecto "${name}"? Se borrará todo su contenido de forma permanente.`, {
      title: 'Eliminar proyecto',
      kind: 'warning',
    })
    if (!ok) return
    const ownerIds = [id, ...(worktreesByProject[id] ?? []).map((w) => w.id)]
    const terminalIds = ownerIds.flatMap((ownerId) =>
      (boardsByOwner[ownerId]?.blocks ?? []).filter((b) => b.type === 'terminal').map((b) => b.id),
    )
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
            display: 'inline-flex',
            alignItems: 'center',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-pill)',
            padding: '4px 8px',
          }}
        >
          <Flask size={12} weight="Outline" />
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
              onClick={() => {
                setActive(p.id)
                clearUnread(p.id)
              }}
              onDoubleClick={() => {
                setEditingId(p.id)
                setDraft(p.name)
              }}
              className={`vire-tab${isActive ? ' active' : ''}`}
              style={{
                position: 'relative',
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
              {!isActive && (unreadByProject[p.id] ?? 0) > 0 && (
                <span
                  title={`${unreadByProject[p.id]} sin leer`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 15,
                    height: 15,
                    padding: '0 4px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--color-accent)',
                    color: '#111',
                    fontSize: 9,
                    fontWeight: 700,
                  }}
                >
                  {unreadByProject[p.id]}
                </span>
              )}
              {isActive && p.repoPath && (
                <button
                  type="button"
                  aria-label="Worktrees"
                  title="Worktrees"
                  onClick={(e) => {
                    e.stopPropagation()
                    setWorktreeMenuFor(worktreeMenuFor === p.id ? null : p.id)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  <ChevronDown size={11} weight="Outline" />
                </button>
              )}
              {isActive && worktreeMenuFor === p.id && (
                <WorktreeDropdown projectId={p.id} onClose={() => setWorktreeMenuFor(null)} />
              )}
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
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={11} weight="Outline" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}>
        <button
          type="button"
          onClick={() => setInboxOpen((v) => !v)}
          title="Notificaciones"
          className="vire-tab"
          style={{
            background: 'none',
            border: 'none',
            borderRadius: 5,
            padding: '2px 8px',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          <Bell size={15} weight="Outline" />
        </button>
        {inboxOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 6,
              width: 280,
              maxHeight: 320,
              overflow: 'auto',
              background: 'var(--glass-block-bg)',
              border: '0.5px solid var(--glass-block-border)',
              borderRadius: 'var(--radius-block)',
              boxShadow: 'var(--shadow-block)',
              backdropFilter: 'var(--glass-blur)',
              WebkitBackdropFilter: 'var(--glass-blur)',
              padding: 8,
              zIndex: 210,
            }}
          >
            {events.length === 0 && (
              <div style={{ color: 'var(--color-text-muted)', fontSize: 11, padding: 8 }}>Sin actividad reciente</div>
            )}
            {events.map((ev) => {
              const project = projects.find((p) => p.id === ev.projectId)
              return (
                <div
                  key={`${ev.blockId}-${ev.updatedAt}`}
                  onClick={() => goToActivity(ev.projectId)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 5,
                    cursor: 'pointer',
                    fontSize: 11,
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{ev.title}</div>
                  <div style={{ color: 'var(--color-text-muted)' }}>{project?.name ?? ev.projectId}</div>
                </div>
              )
            })}
          </div>
        )}
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
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          <Plus size={15} weight="Outline" />
        </button>
      </div>
    </div>
  )
}
