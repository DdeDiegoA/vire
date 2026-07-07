import { defaultPomodoroData } from './blocks/PomodoroBlock'
import { defaultTaskListData } from './blocks/TaskListBlock'
import { defaultNoteData } from './blocks/NoteBlock'
import { defaultBrowserData } from './blocks/BrowserBlock'
import { defaultEditorData } from './blocks/EditorBlock'
import { defaultAgentData } from './blocks/AgentBlock'

export const VIRE_BLOCK_TYPES = ['terminal', 'agent', 'editor', 'pomodoro', 'tasklist', 'browser', 'note'] as const
export type VireBlockType = (typeof VIRE_BLOCK_TYPES)[number]

export const defaultDataByType: Record<VireBlockType, unknown> = {
  pomodoro: defaultPomodoroData,
  tasklist: defaultTaskListData,
  terminal: {},
  agent: defaultAgentData,
  editor: defaultEditorData,
  browser: defaultBrowserData,
  note: defaultNoteData,
}

export const nameByType: Record<VireBlockType, string> = {
  terminal: 'Terminal',
  agent: 'Agente',
  editor: 'Editor',
  pomodoro: 'Pomodoro',
  tasklist: 'Tareas',
  browser: 'Browser',
  note: 'Nota',
}

export const iconByType: Record<VireBlockType, string> = {
  terminal: '↕',
  pomodoro: '▸',
  tasklist: '◈',
  note: '¶',
  browser: '◐',
  agent: '✦',
  editor: '⌘',
}
