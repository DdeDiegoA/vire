import { invoke } from '@tauri-apps/api/core'
import type { PersistStorage, StorageValue } from 'zustand/middleware'
import { emptyBoard, type Board } from './boardTypes'

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

  await Promise.all([
    ...projects.map((p) => invoke('upsert_project', { id: p.id, name: p.name })),
    ...Object.entries(boardsByProject).map(([projectId, board]) => {
      const { camera, ...rest } = board
      return invoke('save_board', {
        projectId,
        blocksJson: JSON.stringify(rest),
        cameraJson: JSON.stringify(camera),
      })
    }),
    invoke('set_config', { key: 'activeId', valueJson: JSON.stringify(activeId) }),
    invoke('set_config', { key: 'selectedBlockId', valueJson: JSON.stringify(selectedBlockId) }),
  ])
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null

export function createTauriStorage<S>(): PersistStorage<S> {
  return {
    async getItem(_name) {
      const projects = await invoke<ProjectDto[]>('list_projects')
      if (projects.length === 0) return null

      const rows = await Promise.all(
        projects.map((p) => invoke<BoardDto | null>('load_board', { projectId: p.id }))
      )
      const boardsByProject: Record<string, Board> = {}
      projects.forEach((p, i) => {
        const row = rows[i]
        boardsByProject[p.id] = row
          ? { ...JSON.parse(row.blocks_json), camera: JSON.parse(row.camera_json) }
          : emptyBoard()
      })

      const [activeIdRaw, selectedRaw] = await Promise.all([
        invoke<string | null>('get_config', { key: 'activeId' }),
        invoke<string | null>('get_config', { key: 'selectedBlockId' }),
      ])

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

    async removeItem(_name) {},
  }
}
