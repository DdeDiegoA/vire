import { useRef, useState } from 'react'
import { useActiveBoard, useVireStore, type Camera, type VireBlock } from '../store/useVireStore'
import { VireWindow } from './VireWindow'
import { VireContextMenu } from './VireContextMenu'
import { SettingsPanel } from '../components/SettingsPanel'
import type { VireBlockType } from '../shapes/blockTypes'

const ZOOM_MIN = 0.2
const ZOOM_MAX = 3

const MINIMAP_W = 180
const MINIMAP_H = 120
const MINIMAP_PAD = 60

const pillButtonStyle: React.CSSProperties = {
  position: 'absolute',
  zIndex: 150,
  background: 'var(--glass-block-bg)',
  border: '0.5px solid var(--glass-block-border)',
  borderRadius: 'var(--radius-pill)',
  color: 'var(--color-text-secondary)',
  padding: '4px 10px',
  cursor: 'pointer',
}

function ZoomIndicator({ zoom, onReset }: { zoom: number; onReset: () => void }) {
  return (
    <button
      type="button"
      onClick={onReset}
      title="Restablecer zoom (100%)"
      style={{ ...pillButtonStyle, left: 16, bottom: 16, fontFamily: 'var(--font-mono)', fontSize: 'clamp(10px, 2.8cqw, 12px)' }}
    >
      {Math.round(zoom * 100)}%
    </button>
  )
}

function MiniMap({ camera, blocks }: { camera: Camera; blocks: VireBlock[] }) {
  const viewport = {
    x1: -camera.x / camera.z,
    y1: -camera.y / camera.z,
    x2: (window.innerWidth - camera.x) / camera.z,
    y2: (window.innerHeight - camera.y) / camera.z,
  }

  const xs = blocks.flatMap((b) => [b.x, b.x + b.w]).concat(viewport.x1, viewport.x2)
  const ys = blocks.flatMap((b) => [b.y, b.y + b.h]).concat(viewport.y1, viewport.y2)
  const minX = Math.min(...xs) - MINIMAP_PAD
  const maxX = Math.max(...xs) + MINIMAP_PAD
  const minY = Math.min(...ys) - MINIMAP_PAD
  const maxY = Math.max(...ys) + MINIMAP_PAD
  const scale = Math.min(MINIMAP_W / (maxX - minX), MINIMAP_H / (maxY - minY))

  const toMap = (x: number, y: number) => ({ x: (x - minX) * scale, y: (y - minY) * scale })
  const vp1 = toMap(viewport.x1, viewport.y1)
  const vp2 = toMap(viewport.x2, viewport.y2)

  return (
    <div
      style={{
        position: 'absolute',
        right: 16,
        bottom: 16,
        width: MINIMAP_W,
        height: MINIMAP_H,
        zIndex: 150,
        background: 'var(--color-surface-elevated)',
        border: '1px solid var(--color-divider)',
        borderRadius: 'var(--radius-control)',
        overflow: 'hidden',
      }}
    >
      {blocks.map((b) => {
        const p1 = toMap(b.x, b.y)
        const p2 = toMap(b.x + b.w, b.y + b.h)
        return (
          <div
            key={b.id}
            style={{
              position: 'absolute',
              left: p1.x,
              top: p1.y,
              width: Math.max(2, p2.x - p1.x),
              height: Math.max(2, p2.y - p1.y),
              background: 'var(--color-accent)',
              opacity: 0.6,
              borderRadius: 2,
            }}
          />
        )
      })}
      <div
        style={{
          position: 'absolute',
          left: vp1.x,
          top: vp1.y,
          width: Math.max(0, vp2.x - vp1.x),
          height: Math.max(0, vp2.y - vp1.y),
          border: '1px solid var(--color-text-primary)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const panRef = useRef<{ startX: number; startY: number; camX: number; camY: number } | null>(null)
  const zoomAnimRef = useRef<{ targetZ: number; anchorX: number; anchorY: number; raf: number | null }>({
    targetZ: camera.z,
    anchorX: 0,
    anchorY: 0,
    raf: null,
  })

  const toWorld = (screenX: number, screenY: number) => ({
    x: (screenX - camera.x) / camera.z,
    y: (screenY - camera.y) / camera.z,
  })

  const stepZoom = () => {
    const anim = zoomAnimRef.current
    const board = useVireStore.getState().boardsByProject[useVireStore.getState().activeId]
    const cam = board?.camera ?? { x: 0, y: 0, z: 1 }
    const diff = anim.targetZ - cam.z
    const newZ = Math.abs(diff) < 0.001 ? anim.targetZ : cam.z + diff * 0.25
    setCamera({
      x: anim.anchorX - (anim.anchorX - cam.x) * (newZ / cam.z),
      y: anim.anchorY - (anim.anchorY - cam.y) * (newZ / cam.z),
      z: newZ,
    })
    if (Math.abs(anim.targetZ - newZ) < 0.001) {
      anim.raf = null
      return
    }
    anim.raf = requestAnimationFrame(stepZoom)
  }

  const onWheel: React.WheelEventHandler = (e) => {
    e.preventDefault()
    if (e.ctrlKey) {
      const anim = zoomAnimRef.current
      if (anim.raf == null) anim.targetZ = camera.z
      const clampedDeltaY = Math.max(-50, Math.min(50, e.deltaY))
      const factor = Math.exp(-clampedDeltaY * 0.004)
      anim.targetZ = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, anim.targetZ * factor))
      const rect = e.currentTarget.getBoundingClientRect()
      anim.anchorX = e.clientX - rect.left
      anim.anchorY = e.clientY - rect.top
      if (anim.raf == null) anim.raf = requestAnimationFrame(stepZoom)
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
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.015) 1px, transparent 1px)',
          backgroundSize: `${24 * camera.z}px ${24 * camera.z}px`,
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
      <ZoomIndicator
        zoom={camera.z}
        onReset={() => {
          const anim = zoomAnimRef.current
          if (anim.raf != null) cancelAnimationFrame(anim.raf)
          anim.raf = null
          anim.targetZ = 1
          setCamera({ ...camera, z: 1 })
        }}
      />
      <MiniMap camera={camera} blocks={blocks} />
      <button
        type="button"
        onClick={() => setSettingsOpen((v) => !v)}
        onPointerDown={(e) => e.stopPropagation()}
        title="Config AI CLIs"
        style={{ ...pillButtonStyle, top: 16, right: 16, fontSize: 'clamp(12px, 3.2cqw, 14px)' }}
      >
        ⚙
      </button>
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
