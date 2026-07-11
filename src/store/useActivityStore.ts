import { create } from 'zustand'
import type { VireBlockType } from '../shapes/blockTypes'

export type ActivityStatus = 'working' | 'done' | 'idle'

export interface ActivityEntry {
  blockId: string
  ownerId: string
  projectId: string
  blockType: VireBlockType
  title: string
  status: ActivityStatus
  updatedAt: number
}

const EVENTS_CAP = 50

interface ActivityStore {
  byBlock: Record<string, ActivityEntry>
  events: ActivityEntry[]
  unreadByProject: Record<string, number>

  markActivity: (
    blockId: string,
    projectId: string,
    ownerId: string,
    blockType: VireBlockType,
    title: string,
    status: ActivityStatus,
    activeProjectId: string,
  ) => void
  clearUnread: (projectId: string) => void
}

// ponytail: session-only, no persist — status is derived from live PTY/agent
// streams and stale on reload anyway; not worth surviving a restart.
export const useActivityStore = create<ActivityStore>()((set) => ({
  byBlock: {},
  events: [],
  unreadByProject: {},

  markActivity: (blockId, projectId, ownerId, blockType, title, status, activeProjectId) =>
    set((s) => {
      const entry: ActivityEntry = { blockId, ownerId, projectId, blockType, title, status, updatedAt: Date.now() }
      const isNoteworthy = status === 'done'
      const unreadByProject =
        isNoteworthy && projectId !== activeProjectId
          ? { ...s.unreadByProject, [projectId]: (s.unreadByProject[projectId] ?? 0) + 1 }
          : s.unreadByProject
      const events = isNoteworthy ? [entry, ...s.events].slice(0, EVENTS_CAP) : s.events
      return {
        byBlock: { ...s.byBlock, [blockId]: entry },
        events,
        unreadByProject,
      }
    }),

  clearUnread: (projectId) =>
    set((s) => {
      if (!s.unreadByProject[projectId]) return {}
      const unreadByProject = { ...s.unreadByProject }
      delete unreadByProject[projectId]
      return { unreadByProject }
    }),
}))
