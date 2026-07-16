import type { IconComponent } from 'reicon-react'
import { TerminalSquare, Cpu, Code2, Stickynote2, Globe, Timer2, ListCheck, BranchUp } from 'reicon-react'

export const VIRE_BLOCK_TYPES = ['terminal', 'agent', 'editor', 'pomodoro', 'tasklist', 'browser', 'note', 'sourcecontrol'] as const
export type VireBlockType = (typeof VIRE_BLOCK_TYPES)[number]

export interface AgentData {
  cli: 'claude' | 'opencode'
  sessionId?: string
  cwd?: string
  initialPrompt?: string
}

export interface TerminalTab {
  id: string
  cwd?: string
}

export interface TerminalData {
  tabs: TerminalTab[]
  activeTabId: string
}

export interface PomodoroData {
  durationSec: number
  remainingSec: number
  running: boolean
  endAt: number | null
}

export interface TaskItem {
  id: number
  text: string
  done: boolean
  children?: TaskItem[]
}

export interface TaskListData {
  items: TaskItem[]
  seq: number
}

export interface NoteData {
  text: string
  mode?: 'edit' | 'preview'
}

export interface BrowserData {
  history: string[]
  index: number
}

export interface EditorData {
  root?: string
  openPaths: string[]
  activePath: string
}

export type SourceControlData = Record<string, never>

export const defaultPomodoroData: PomodoroData = {
  durationSec: 1500,
  remainingSec: 1500,
  running: false,
  endAt: null,
}

export const defaultTaskListData: TaskListData = {
  items: [],
  seq: 0,
}

export const defaultNoteData: NoteData = { text: '', mode: 'edit' }

export const defaultBrowserData: BrowserData = { history: [''], index: 0 }

export const defaultEditorData: EditorData = { openPaths: [], activePath: '' }

export const defaultAgentData: AgentData = { cli: 'claude' }

export const defaultSourceControlData: SourceControlData = {}

export const defaultTerminalData: TerminalData = { tabs: [{ id: 'main' }], activeTabId: 'main' }

export const defaultDataByType: Record<VireBlockType, unknown> = {
  pomodoro: defaultPomodoroData,
  tasklist: defaultTaskListData,
  terminal: defaultTerminalData,
  agent: defaultAgentData,
  editor: defaultEditorData,
  browser: defaultBrowserData,
  note: defaultNoteData,
  sourcecontrol: defaultSourceControlData,
}

export const nameByType: Record<VireBlockType, string> = {
  terminal: 'Terminal',
  agent: 'Agente',
  editor: 'Editor',
  pomodoro: 'Pomodoro',
  tasklist: 'Tareas',
  browser: 'Browser',
  note: 'Nota',
  sourcecontrol: 'Git',
}

export const BLOCK_ICON: Record<VireBlockType, IconComponent> = {
  terminal: TerminalSquare,
  agent: Cpu,
  editor: Code2,
  note: Stickynote2,
  browser: Globe,
  pomodoro: Timer2,
  tasklist: ListCheck,
  sourcecontrol: BranchUp,
}

export function remainingMsAt(data: PomodoroData, now: number): number {
  if (data.running && data.endAt !== null) return Math.max(0, data.endAt - now)
  return Math.max(0, data.remainingSec * 1000)
}

export function updateTree(items: TaskItem[], itemId: number, updater: (item: TaskItem) => TaskItem): TaskItem[] {
  return items.map((item) => {
    if (item.id === itemId) return updater(item)
    if (item.children?.length) return { ...item, children: updateTree(item.children, itemId, updater) }
    return item
  })
}

export function removeFromTree(items: TaskItem[], itemId: number): TaskItem[] {
  const result: TaskItem[] = []
  for (const item of items) {
    if (item.id === itemId) continue
    result.push(item.children ? { ...item, children: removeFromTree(item.children, itemId) } : item)
  }
  return result
}

export function addChild(items: TaskItem[], parentId: number, child: TaskItem): TaskItem[] {
  return items.map((item) => {
    if (item.id === parentId) return { ...item, children: [...(item.children ?? []), child] }
    if (item.children?.length) return { ...item, children: addChild(item.children, parentId, child) }
    return item
  })
}
