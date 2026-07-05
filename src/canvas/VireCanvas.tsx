import { useRef, useState } from 'react'
import { useActiveBoard, useVireStore } from '../store/useVireStore'
import { VireWindow } from './VireWindow'
import { VireContextMenu } from './VireContextMenu'
import type { VireBlockType } from '../shapes/blockTypes'

const ZOOM_MIN = 0.2
const ZOOM_MAX = 3

interface MenuState {
  screenX: number
  screenY: number
  worldX: number
  worldY: number
}

export function VireCanvas() {
  const board = useActiveBoard()
  const setCamera = useVireStore((s) => s.setCamera)
  const addBlock = useVireStore((s) => s.addBlock)
  const selectBlock = useVireStore((s) => s.selectBlock)
  const { camera, blocks } = board

  const [menu, setMenu] = useState<MenuState | null>(null)
  const panRef = useRef<{ startX: number; startY: number; camX: number; camY: number } | null>(null)

  const toWorld = (screenX: number, screenY: number) => ({
    x: (screenX - camera.x) / camera.z,
    y: (screenY - camera.y) / camera.z,
  })

  const onWheel: React.WheelEventHandler = (e) => {
    e.preventDefault()
    // Trackpad pinch-zoom and ctrl+wheel both report ctrlKey=true (browser convention);
    // plain wheel/trackpad two-finger scroll pans instead.
    if (e.ctrlKey) {
      const factor = Math.exp(-e.deltaY * 0.01)
      const newZ = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, camera.z * factor))
      const rect = e.currentTarget.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      setCamera({
        x: cx - (cx - camera.x) * (newZ / camera.z),
        y: cy - (cy - camera.y) * (newZ / camera.z),
        z: newZ,
      })
    } else {
      setCamera({ x: camera.x - e.deltaX, y: camera.y - e.deltaY, z: camera.z })
    }
  }

  const onPointerDown: React.PointerEventHandler = (e) => {
    if (e.button !== 0) return
    selectBlock(null)
    setMenu(null)
    panRef.current = { startX: e.clientX, startY: e.clientY, camX: camera.x, camY: camera.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove: React.PointerEventHandler = (e) => {
    const pan = panRef.current
    if (!pan) return
    setCamera({
      x: pan.camX + (e.clientX - pan.startX),
      y: pan.camY + (e.clientY - pan.startY),
      z: camera.z,
    })
  }

  const onPointerUp: React.PointerEventHandler = () => {
    panRef.current = null
  }

  const onContextMenu: React.MouseEventHandler = (e) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    const world = toWorld(screenX, screenY)
    setMenu({ screenX, screenY, worldX: world.x, worldY: world.y })
  }

  const handleCreate = (type: VireBlockType) => {
    if (!menu) return
    const id = addBlock(type, menu.worldX, menu.worldY)
    selectBlock(id)
    setMenu(null)
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--color-canvas)',
        overflow: 'hidden',
        cursor: panRef.current ? 'grabbing' : 'default',
      }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={onContextMenu}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 'var(--grid-opacity)',
          backgroundImage:
            'linear-gradient(var(--color-text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-text-primary) 1px, transparent 1px)',
          backgroundSize: `${40 * camera.z}px ${40 * camera.z}px`,
          backgroundPosition: `${camera.x}px ${camera.y}px`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.z})`,
          transformOrigin: '0 0',
        }}
      >
        {blocks.map((block) => (
          <VireWindow key={block.id} block={block} zoom={camera.z} />
        ))}
      </div>
      {menu && (
        <VireContextMenu x={menu.screenX} y={menu.screenY} onSelect={handleCreate} onClose={() => setMenu(null)} />
      )}
    </div>
  )
}
