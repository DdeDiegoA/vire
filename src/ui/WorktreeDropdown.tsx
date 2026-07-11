import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { confirm } from '@tauri-apps/plugin-dialog'
import { BranchUp, Plus, X } from 'reicon-react'
import { useVireStore } from '../store/useVireStore'
import type { Worktree } from '../store/boardTypes'

interface WorktreeDto {
  id: string
  project_id: string
  path: string
  branch: string
}

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 10px',
  cursor: 'pointer',
  fontSize: 'clamp(10px, 2.8cqw, 12px)',
  color: 'var(--color-text-secondary)',
  whiteSpace: 'nowrap',
}

export function WorktreeDropdown({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const worktrees = useVireStore((s) => s.worktreesByProject[projectId] ?? [])
  const activeWorktreeId = useVireStore((s) => s.activeWorktreeId[projectId] ?? null)
  const setActiveWorktree = useVireStore((s) => s.setActiveWorktree)
  const addWorktree = useVireStore((s) => s.addWorktree)
  const removeWorktreeLocal = useVireStore((s) => s.removeWorktreeLocal)
  const addBlock = useVireStore((s) => s.addBlock)
  const [creating, setCreating] = useState(false)
  const [branch, setBranch] = useState('')
  const [withAgent, setWithAgent] = useState(true)
  const [error, setError] = useState('')

  const pick = (id: string | null) => {
    setActiveWorktree(projectId, id)
    onClose()
  }

  const create = async () => {
    const name = branch.trim()
    if (!name) return
    try {
      const wt = await invoke<WorktreeDto>('create_worktree', { projectId, branch: name, base: null })
      const worktree: Worktree = { id: wt.id, projectId: wt.project_id, path: wt.path, branch: wt.branch }
      addWorktree(worktree)
      setActiveWorktree(projectId, worktree.id)
      if (withAgent) {
        addBlock('terminal', 40, 40, { cwd: worktree.path })
        addBlock('agent', 400, 40, { cli: 'claude', cwd: worktree.path })
      }
      setCreating(false)
      setBranch('')
      onClose()
    } catch (err) {
      setError(String(err))
    }
  }

  const remove = async (wt: Worktree) => {
    const ok = await confirm(`¿Eliminar el worktree "${wt.branch}"? Se borrará el directorio en disco.`, {
      title: 'Eliminar worktree',
      kind: 'warning',
    })
    if (!ok) return
    try {
      await invoke('remove_worktree', { id: wt.id, projectId, path: wt.path, force: false })
      removeWorktreeLocal(projectId, wt.id)
    } catch {
      const forceOk = await confirm(
        `"${wt.branch}" tiene cambios sin commitear. ¿Forzar eliminación de todas formas?`,
        { title: 'Cambios sin commitear', kind: 'warning' },
      )
      if (!forceOk) return
      try {
        await invoke('remove_worktree', { id: wt.id, projectId, path: wt.path, force: true })
        removeWorktreeLocal(projectId, wt.id)
      } catch (err) {
        setError(String(err))
      }
    }
  }

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: 4,
        minWidth: 200,
        background: 'var(--glass-topbar-bg)',
        border: '0.5px solid var(--glass-hairline)',
        borderRadius: 8,
        backdropFilter: 'var(--glass-blur-topbar)',
        WebkitBackdropFilter: 'var(--glass-blur-topbar)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
        padding: 4,
        zIndex: 300,
      }}
    >
      <div style={itemStyle} onClick={() => pick(null)}>
        <BranchUp size={12} weight="Outline" />
        <span style={{ flex: 1, color: activeWorktreeId === null ? 'var(--color-text-primary)' : undefined }}>main</span>
      </div>
      {worktrees.map((wt) => (
        <div key={wt.id} style={itemStyle} onClick={() => pick(wt.id)}>
          <BranchUp size={12} weight="Outline" />
          <span style={{ flex: 1, color: activeWorktreeId === wt.id ? 'var(--color-text-primary)' : undefined }}>{wt.branch}</span>
          <button
            type="button"
            aria-label={`Eliminar worktree ${wt.branch}`}
            onClick={(e) => {
              e.stopPropagation()
              void remove(wt)
            }}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'inline-flex' }}
          >
            <X size={10} weight="Outline" />
          </button>
        </div>
      ))}
      <div style={{ borderTop: '1px solid var(--color-divider)', marginTop: 4, paddingTop: 4 }}>
        {creating ? (
          <div style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              autoFocus
              aria-label="Nombre de la rama"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              placeholder="feature/mi-rama"
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                border: '0.5px solid var(--glass-block-border)',
                borderRadius: 6,
                color: '#ccc',
                fontSize: 'clamp(10px, 2.8cqw, 12px)',
                padding: '4px 8px',
              }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'clamp(9px, 2.5cqw, 11px)', color: 'var(--color-text-muted)' }}>
              <input type="checkbox" checked={withAgent} onChange={(e) => setWithAgent(e.target.checked)} />
              Abrir con agente
            </label>
            {error && <span style={{ color: 'var(--color-err)', fontSize: 'clamp(9px, 2.5cqw, 11px)' }}>{error}</span>}
            <button type="button" onClick={create} style={{ ...itemStyle, justifyContent: 'center', border: '0.5px solid var(--glass-block-border)', borderRadius: 6 }}>
              Crear
            </button>
          </div>
        ) : (
          <div style={itemStyle} onClick={() => setCreating(true)}>
            <Plus size={12} weight="Outline" />
            <span>Nuevo worktree</span>
          </div>
        )}
      </div>
    </div>
  )
}
