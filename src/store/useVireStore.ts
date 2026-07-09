import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultDataByType, nameByType, type VireBlockType } from '../shapes/blockTypes'
import { createTauriStorage } from './tauriStorage'
import { emptyBoard, type Board, type Camera, type VireBlock } from './boardTypes'

export { emptyBoard, type Board, type Camera, type VireBlock }

export interface VireProject {
  id: string
  name: string
  repoPath?: string
}

interface VireStore {
  projects: VireProject[]
  activeId: string
  boardsByProject: Record<string, Board>
  selectedBlockId: string | null

  addProject: () => void
  setActive: (id: string) => void
  renameProject: (id: string, name: string) => void
  removeProject: (id: string) => void
  setRepoPath: (id: string, repoPath: string) => void

  addBlock: (type: VireBlockType, worldX: number, worldY: number) => string
  updateBlock: (id: string, partial: Partial<Pick<VireBlock, 'x' | 'y' | 'w' | 'h'>>) => void
  updateBlockData: (id: string, data: unknown) => void
  removeBlock: (id: string) => void
  selectBlock: (id: string | null) => void
  bringToFront: (id: string) => void
  setCamera: (camera: Camera) => void
}

let projectSeq = 1

function getBoard(state: Pick<VireStore, 'boardsByProject' | 'activeId'>): Board {
  return state.boardsByProject[state.activeId] ?? emptyBoard()
}

export const useVireStore = create<VireStore>()(
  persist(
    (set, get) => ({
      projects: [{ id: 'default', name: 'Proyecto 1' }],
      activeId: 'default',
      boardsByProject: { default: emptyBoard() },
      selectedBlockId: null,

      addProject: () =>
        set((s) => {
          projectSeq += 1
          const id = `project-${projectSeq}`
          return {
            projects: [...s.projects, { id, name: `Proyecto ${projectSeq}` }],
            activeId: id,
            boardsByProject: { ...s.boardsByProject, [id]: emptyBoard() },
            selectedBlockId: null,
          }
        }),

      setActive: (id) => set({ activeId: id, selectedBlockId: null }),

      renameProject: (id, name) =>
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, name } : p)),
        })),

      setRepoPath: (id, repoPath) =>
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, repoPath } : p)),
        })),

      removeProject: (id) =>
        set((s) => {
          const remaining = s.projects.filter((p) => p.id !== id)
          const { [id]: _removed, ...boardsByProject } = s.boardsByProject
          if (remaining.length === 0) {
            projectSeq += 1
            const freshId = `project-${projectSeq}`
            return {
              projects: [{ id: freshId, name: `Proyecto ${projectSeq}` }],
              activeId: freshId,
              boardsByProject: { [freshId]: emptyBoard() },
              selectedBlockId: null,
            }
          }
          return {
            projects: remaining,
            activeId: s.activeId === id ? remaining[0].id : s.activeId,
            boardsByProject,
            selectedBlockId: s.activeId === id ? null : s.selectedBlockId,
          }
        }),

      addBlock: (type, worldX, worldY) => {
        const state = get()
        const board = getBoard(state)
        const id = `block-${state.activeId}-${board.seq}`
        const z = board.topZ + 1
        const newBlock: VireBlock = {
          id,
          type,
          title: nameByType[type],
          x: worldX,
          y: worldY,
          w: 320,
          h: 240,
          z,
          data: defaultDataByType[type],
        }
        set((s) => ({
          boardsByProject: {
            ...s.boardsByProject,
            [s.activeId]: {
              ...board,
              blocks: [...board.blocks, newBlock],
              seq: board.seq + 1,
              topZ: z,
            },
          },
        }))
        return id
      },

      updateBlock: (id, partial) =>
        set((s) => {
          const board = getBoard(s)
          return {
            boardsByProject: {
              ...s.boardsByProject,
              [s.activeId]: {
                ...board,
                blocks: board.blocks.map((b) => (b.id === id ? { ...b, ...partial } : b)),
              },
            },
          }
        }),

      updateBlockData: (id, data) =>
        set((s) => {
          const board = getBoard(s)
          return {
            boardsByProject: {
              ...s.boardsByProject,
              [s.activeId]: {
                ...board,
                blocks: board.blocks.map((b) => (b.id === id ? { ...b, data } : b)),
              },
            },
          }
        }),

      removeBlock: (id) =>
        set((s) => {
          const board = getBoard(s)
          return {
            boardsByProject: {
              ...s.boardsByProject,
              [s.activeId]: { ...board, blocks: board.blocks.filter((b) => b.id !== id) },
            },
            selectedBlockId: s.selectedBlockId === id ? null : s.selectedBlockId,
          }
        }),

      selectBlock: (id) => set({ selectedBlockId: id }),

      bringToFront: (id) =>
        set((s) => {
          const board = getBoard(s)
          const block = board.blocks.find((b) => b.id === id)
          if (!block || block.z === board.topZ) return {}
          const z = board.topZ + 1
          return {
            boardsByProject: {
              ...s.boardsByProject,
              [s.activeId]: {
                ...board,
                blocks: board.blocks.map((b) => (b.id === id ? { ...b, z } : b)),
                topZ: z,
              },
            },
          }
        }),

      setCamera: (camera) =>
        set((s) => {
          const board = getBoard(s)
          return {
            boardsByProject: { ...s.boardsByProject, [s.activeId]: { ...board, camera } },
          }
        }),
    }),
    {
      name: 'vire-boards',
      version: 1,
      storage: createTauriStorage(),
      migrate: (persisted, version) => {
        const state = persisted as VireStore
        if (version < 1) {
          for (const board of Object.values(state.boardsByProject ?? {})) {
            board.topZ = Math.max(0, ...board.blocks.map((b) => b.z ?? 0))
            for (const b of board.blocks) b.z = b.z ?? 0
          }
        }
        return state
      },
    },
  ),
)

export function useActiveBoard(): Board {
  return useVireStore((s) => s.boardsByProject[s.activeId] ?? emptyBoard())
}
