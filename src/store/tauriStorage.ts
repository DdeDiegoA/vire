import { invoke } from '@tauri-apps/api/core'
import type { PersistStorage, StorageValue } from 'zustand/middleware'
import { emptyBoard, type Board, type Worktree } from './boardTypes'

interface StoredProject {
  id: string
  name: string
  repoPath?: string
}

interface ProjectDto {
  id: string
  name: string
  repo_path: string | null
}

interface WorktreeDto {
  id: string
  project_id: string
  path: string
  branch: string
}

interface BoardDto {
  blocks_json: string
  camera_json: string
}

const DEBOUNCE_MS = 500

async function writeState(value: StorageValue<unknown>) {
  const { projects, activeId, boardsByOwner, activeWorktreeId, selectedBlockId } = value.state as {
    projects: StoredProject[]
    activeId: string
    boardsByOwner: Record<string, Board>
    activeWorktreeId: Record<string, string | null>
    selectedBlockId: string | null
  }

  await Promise.all([
    ...projects.map((p) => invoke('upsert_project', { id: p.id, name: p.name, repoPath: p.repoPath ?? null })),
    ...Object.entries(boardsByOwner).map(([ownerId, board]) => {
      const { camera, ...rest } = board
      return invoke('save_board', {
        projectId: ownerId,
        blocksJson: JSON.stringify(rest),
        cameraJson: JSON.stringify(camera),
      })
    }),
    invoke('set_config', { key: 'activeId', valueJson: JSON.stringify(activeId) }),
    invoke('set_config', { key: 'activeWorktreeId', valueJson: JSON.stringify(activeWorktreeId ?? {}) }),
    invoke('set_config', { key: 'selectedBlockId', valueJson: JSON.stringify(selectedBlockId) }),
  ])
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null

export function createTauriStorage<S>(): PersistStorage<S> {
  return {
    async getItem(_name) {
      const projects = await invoke<ProjectDto[]>('list_projects')
      if (projects.length === 0) return null

      const worktreeLists = await Promise.all(
        projects.map((p) => invoke<WorktreeDto[]>('list_worktrees', { projectId: p.id }))
      )
      const worktreesByProject: Record<string, Worktree[]> = {}
      projects.forEach((p, i) => {
        worktreesByProject[p.id] = worktreeLists[i].map((w) => ({
          id: w.id,
          projectId: w.project_id,
          path: w.path,
          branch: w.branch,
        }))
      })

      const ownerIds = [...projects.map((p) => p.id), ...worktreeLists.flat().map((w) => w.id)]
      const rows = await Promise.all(ownerIds.map((id) => invoke<BoardDto | null>('load_board', { projectId: id })))
      const boardsByOwner: Record<string, Board> = {}
      ownerIds.forEach((id, i) => {
        const row = rows[i]
        boardsByOwner[id] = row
          ? { ...JSON.parse(row.blocks_json), camera: JSON.parse(row.camera_json) }
          : emptyBoard()
      })

      const [activeIdRaw, activeWorktreeIdRaw, selectedRaw] = await Promise.all([
        invoke<string | null>('get_config', { key: 'activeId' }),
        invoke<string | null>('get_config', { key: 'activeWorktreeId' }),
        invoke<string | null>('get_config', { key: 'selectedBlockId' }),
      ])

      const state = {
        projects: projects.map((p) => ({ id: p.id, name: p.name, repoPath: p.repo_path ?? undefined })),
        activeId: activeIdRaw ? JSON.parse(activeIdRaw) : projects[0].id,
        boardsByOwner,
        worktreesByProject,
        activeWorktreeId: activeWorktreeIdRaw ? JSON.parse(activeWorktreeIdRaw) : {},
        selectedBlockId: selectedRaw ? JSON.parse(selectedRaw) : null,
      }
      return { state, version: 3 } as StorageValue<S>
    },

    setItem(_name, value) {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => void writeState(value), DEBOUNCE_MS)
    },

    async removeItem(_name) {},
  }
}
