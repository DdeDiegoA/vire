import type { VireBlockType } from '../shapes/blockTypes'

export interface VireBlock {
  id: string
  type: VireBlockType
  title: string
  x: number
  y: number
  w: number
  h: number
  z: number
  data: unknown
}

export interface Camera {
  x: number
  y: number
  z: number
}

export interface Board {
  blocks: VireBlock[]
  camera: Camera
  seq: number
  topZ: number
}

export interface Worktree {
  id: string
  projectId: string
  path: string
  branch: string
}

const defaultCamera: Camera = { x: 0, y: 0, z: 1 }

export function emptyBoard(): Board {
  return { blocks: [], camera: { ...defaultCamera }, seq: 0, topZ: 0 }
}
