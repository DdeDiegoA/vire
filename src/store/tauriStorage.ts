import { invoke } from '@tauri-apps/api/core'
import type { PersistStorage, StorageValue } from 'zustand/middleware'
import { emptyBoard, type Board } from './useVireStore'

interface ProjectDto {
  id: string
  name: string
}

interface BoardDto {
  blocks_json: string
  camera_json: string
}

const DEBOUNCE_MS = 500

async function writeState(value: StorageValue<unknown>) {
  const { projects, activeId, boardsByProject, selectedBlockId } = value.state as {
    projects: ProjectDto[]
    activeId: string
    boardsByProject: Record<string, Board>
    selectedBlockId: string | null
  }

  for (const p of projects) {
    await invoke('upsert_project', { id: p.id, name: p.name })
  }
  for (const [projectId, board] of Object.entries(boardsByProject)) {
    const { camera, ...rest } = board
    await invoke('save_board', {
      projectId,
      blocksJson: JSON.stringify(rest),
      cameraJson: JSON.stringify(camera),
    })
  }
  await invoke('set_config', { key: 'activeId', valueJson: JSON.stringify(activeId) })
  await invoke('set_config', { key: 'selectedBlockId', valueJson: JSON.stringify(selectedBlockId) })
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null

// zustand persists { projects, activeId, boardsByProject, selectedBlockId } as one blob;
// this adapter fans that out across the projects/boards/configs SQLite tables instead of localStorage.
export function createTauriStorage<S>(): PersistStorage<S> {
  return {
    async getItem(_name) {
      const projects = await invoke<ProjectDto[]>('list_projects')
      if (projects.length === 0) return null

      const boardsByProject: Record<string, Board> = {}
      for (const p of projects) {
        const row = await invoke<BoardDto | null>('load_board', { projectId: p.id })
        boardsByProject[p.id] = row
          ? { ...JSON.parse(row.blocks_json), camera: JSON.parse(row.camera_json) }
          : emptyBoard()
      }

      const activeIdRaw = await invoke<string | null>('get_config', { key: 'activeId' })
      const selectedRaw = await invoke<string | null>('get_config', { key: 'selectedBlockId' })

      const state = {
        projects,
        activeId: activeIdRaw ? JSON.parse(activeIdRaw) : projects[0].id,
        boardsByProject,
        selectedBlockId: selectedRaw ? JSON.parse(selectedRaw) : null,
      }
      return { state, version: 1 } as StorageValue<S>
    },

    setItem(_name, value) {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => void writeState(value), DEBOUNCE_MS)
    },

    // ponytail: no project-deletion UI yet, so nothing calls removeItem — add when projects become deletable.
    async removeItem(_name) {},
  }
}
