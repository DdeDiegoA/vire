import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultDataByType, nameByType, type VireBlockType } from '../shapes/blockTypes'
import { createTauriStorage } from './tauriStorage'
import { emptyBoard, type Board, type Camera, type VireBlock, type Worktree } from './boardTypes'

export { emptyBoard, type Board, type Camera, type VireBlock, type Worktree }

export interface VireProject {
  id: string
  name: string
  repoPath?: string
}

interface VireStore {
  projects: VireProject[]
  activeId: string
  boardsByOwner: Record<string, Board>
  worktreesByProject: Record<string, Worktree[]>
  activeWorktreeId: Record<string, string | null>
  selectedBlockId: string | null

  addProject: () => void
  setActive: (id: string) => void
  renameProject: (id: string, name: string) => void
  removeProject: (id: string) => void
  setRepoPath: (id: string, repoPath: string) => void

  setActiveWorktree: (projectId: string, worktreeId: string | null) => void
  addWorktree: (worktree: Worktree) => void
  removeWorktreeLocal: (projectId: string, worktreeId: string) => void

  addBlock: (type: VireBlockType, worldX: number, worldY: number, initialData?: unknown) => string
  updateBlock: (id: string, partial: Partial<Pick<VireBlock, 'x' | 'y' | 'w' | 'h'>>) => void
  updateBlockData: (id: string, data: unknown) => void
  removeBlock: (id: string) => void
  selectBlock: (id: string | null) => void
  bringToFront: (id: string) => void
  setCamera: (camera: Camera) => void
}

let projectSeq = 1

function ownerId(state: Pick<VireStore, 'activeId' | 'activeWorktreeId'>): string {
  return state.activeWorktreeId[state.activeId] ?? state.activeId
}

function getBoard(state: Pick<VireStore, 'boardsByOwner' | 'activeId' | 'activeWorktreeId'>): Board {
  return state.boardsByOwner[ownerId(state)] ?? emptyBoard()
}

export const useVireStore = create<VireStore>()(
  persist(
    (set, get) => ({
      projects: [{ id: 'default', name: 'Proyecto 1' }],
      activeId: 'default',
      boardsByOwner: { default: emptyBoard() },
      worktreesByProject: {},
      activeWorktreeId: {},
      selectedBlockId: null,

      addProject: () =>
        set((s) => {
          projectSeq += 1
          const id = `project-${projectSeq}`
          return {
            projects: [...s.projects, { id, name: `Proyecto ${projectSeq}` }],
            activeId: id,
            boardsByOwner: { ...s.boardsByOwner, [id]: emptyBoard() },
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
          const worktreeIds = (s.worktreesByProject[id] ?? []).map((w) => w.id)
          const boardsByOwner = { ...s.boardsByOwner }
          delete boardsByOwner[id]
          for (const wtId of worktreeIds) delete boardsByOwner[wtId]
          const worktreesByProject = { ...s.worktreesByProject }
          delete worktreesByProject[id]
          const activeWorktreeId = { ...s.activeWorktreeId }
          delete activeWorktreeId[id]

          if (remaining.length === 0) {
            projectSeq += 1
            const freshId = `project-${projectSeq}`
            return {
              projects: [{ id: freshId, name: `Proyecto ${projectSeq}` }],
              activeId: freshId,
              boardsByOwner: { [freshId]: emptyBoard() },
              worktreesByProject: {},
              activeWorktreeId: {},
              selectedBlockId: null,
            }
          }
          return {
            projects: remaining,
            activeId: s.activeId === id ? remaining[0].id : s.activeId,
            boardsByOwner,
            worktreesByProject,
            activeWorktreeId,
            selectedBlockId: s.activeId === id ? null : s.selectedBlockId,
          }
        }),

      setActiveWorktree: (projectId, worktreeId) =>
        set((s) => ({
          activeWorktreeId: { ...s.activeWorktreeId, [projectId]: worktreeId },
          selectedBlockId: null,
        })),

      addWorktree: (worktree) =>
        set((s) => ({
          worktreesByProject: {
            ...s.worktreesByProject,
            [worktree.projectId]: [...(s.worktreesByProject[worktree.projectId] ?? []), worktree],
          },
          boardsByOwner: { ...s.boardsByOwner, [worktree.id]: emptyBoard() },
        })),

      removeWorktreeLocal: (projectId, worktreeId) =>
        set((s) => {
          const boardsByOwner = { ...s.boardsByOwner }
          delete boardsByOwner[worktreeId]
          const wasActive = s.activeWorktreeId[projectId] === worktreeId
          return {
            worktreesByProject: {
              ...s.worktreesByProject,
              [projectId]: (s.worktreesByProject[projectId] ?? []).filter((w) => w.id !== worktreeId),
            },
            boardsByOwner,
            activeWorktreeId: wasActive ? { ...s.activeWorktreeId, [projectId]: null } : s.activeWorktreeId,
            selectedBlockId: wasActive ? null : s.selectedBlockId,
          }
        }),

      addBlock: (type, worldX, worldY, initialData) => {
        const state = get()
        const owner = ownerId(state)
        const board = getBoard(state)
        const id = `block-${owner}-${board.seq}`
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
          data: initialData ?? defaultDataByType[type],
        }
        set((s) => ({
          boardsByOwner: {
            ...s.boardsByOwner,
            [owner]: {
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
          const owner = ownerId(s)
          const board = getBoard(s)
          return {
            boardsByOwner: {
              ...s.boardsByOwner,
              [owner]: {
                ...board,
                blocks: board.blocks.map((b) => (b.id === id ? { ...b, ...partial } : b)),
              },
            },
          }
        }),

      updateBlockData: (id, data) =>
        set((s) => {
          const owner = ownerId(s)
          const board = getBoard(s)
          return {
            boardsByOwner: {
              ...s.boardsByOwner,
              [owner]: {
                ...board,
                blocks: board.blocks.map((b) => (b.id === id ? { ...b, data } : b)),
              },
            },
          }
        }),

      removeBlock: (id) =>
        set((s) => {
          const owner = ownerId(s)
          const board = getBoard(s)
          return {
            boardsByOwner: {
              ...s.boardsByOwner,
              [owner]: { ...board, blocks: board.blocks.filter((b) => b.id !== id) },
            },
            selectedBlockId: s.selectedBlockId === id ? null : s.selectedBlockId,
          }
        }),

      selectBlock: (id) => set({ selectedBlockId: id }),

      bringToFront: (id) =>
        set((s) => {
          const owner = ownerId(s)
          const board = getBoard(s)
          const block = board.blocks.find((b) => b.id === id)
          if (!block || block.z === board.topZ) return {}
          const z = board.topZ + 1
          return {
            boardsByOwner: {
              ...s.boardsByOwner,
              [owner]: {
                ...board,
                blocks: board.blocks.map((b) => (b.id === id ? { ...b, z } : b)),
                topZ: z,
              },
            },
          }
        }),

      setCamera: (camera) =>
        set((s) => {
          const owner = ownerId(s)
          const board = getBoard(s)
          return {
            boardsByOwner: { ...s.boardsByOwner, [owner]: { ...board, camera } },
          }
        }),
    }),
    {
      name: 'vire-boards',
      version: 4,
      storage: createTauriStorage(),
      migrate: (persisted, version) => {
        const state = persisted as VireStore & { boardsByProject?: Record<string, Board> }
        if (version < 1) {
          for (const board of Object.values(state.boardsByOwner ?? state.boardsByProject ?? {})) {
            board.topZ = Math.max(0, ...board.blocks.map((b) => b.z ?? 0))
            for (const b of board.blocks) b.z = b.z ?? 0
          }
        }
        if (version < 2) {
          for (const project of state.projects ?? []) {
            project.repoPath = project.repoPath ?? undefined
          }
        }
        if (version < 3) {
          if (state.boardsByProject && !state.boardsByOwner) {
            state.boardsByOwner = state.boardsByProject
          }
          delete state.boardsByProject
          state.worktreesByProject = state.worktreesByProject ?? {}
          state.activeWorktreeId = state.activeWorktreeId ?? {}
        }
        if (version < 4) {
          for (const board of Object.values(state.boardsByOwner ?? {})) {
            for (const block of board.blocks) {
              if (block.type !== 'terminal') continue
              const old = block.data as { cwd?: string; tabs?: unknown }
              if (old.tabs) continue
              block.data = { tabs: [{ id: 'main', cwd: old.cwd }], activeTabId: 'main' }
            }
          }
        }
        return state
      },
    },
  ),
)

export function useActiveBoard(): Board {
  return useVireStore((s) => s.boardsByOwner[ownerId(s)] ?? emptyBoard())
}
