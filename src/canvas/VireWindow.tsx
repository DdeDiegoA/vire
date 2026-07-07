import { useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useVireStore, type VireBlock } from '../store/useVireStore'
import { PomodoroBlock, type PomodoroData } from '../shapes/blocks/PomodoroBlock'
import { TaskListBlock, type TaskListData } from '../shapes/blocks/TaskListBlock'
import { AgentBlock, type AgentData } from '../shapes/blocks/AgentBlock'
import { TerminalBlock } from '../shapes/blocks/TerminalBlock'
import { NoteBlock, type NoteData } from '../shapes/blocks/NoteBlock'
import { BrowserBlock, type BrowserData } from '../shapes/blocks/BrowserBlock'
import { EditorBlock, type EditorData } from '../shapes/blocks/EditorBlock'

const MIN_W = 160
const MIN_H = 120

// preventDefault on pointerdown stops WebKit from anchoring a native text
// selection before this runs; the body toggle is belt-and-suspenders for any
// selection that starts elsewhere mid-drag. -webkit- prefix kept for older WKWebView.
function disableTextSelection() {
  document.body.style.userSelect = 'none'
  ;(document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = 'none'
}
function enableTextSelection() {
  document.body.style.userSelect = ''
  ;(document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = ''
}

export function VireWindow({ block, zoom }: { block: VireBlock; zoom: number }) {
  const selectedBlockId = useVireStore((s) => s.selectedBlockId)
  const selectBlock = useVireStore((s) => s.selectBlock)
  const bringToFront = useVireStore((s) => s.bringToFront)
  const updateBlock = useVireStore((s) => s.updateBlock)
  const removeBlock = useVireStore((s) => s.removeBlock)
  const isSelected = selectedBlockId === block.id

  const select = () => {
    selectBlock(block.id)
    bringToFront(block.id)
  }

  const dragRef = useRef<{ startX: number; startY: number; blockX: number; blockY: number } | null>(null)
  const resizeRef = useRef<{ startX: number; startY: number; w: number; h: number } | null>(null)

  const onHeaderPointerDown: React.PointerEventHandler = (e) => {
    e.stopPropagation()
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, blockX: block.x, blockY: block.y }
    disableTextSelection()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onHeaderPointerMove: React.PointerEventHandler = (e) => {
    const drag = dragRef.current
    if (!drag) return
    updateBlock(block.id, {
      x: drag.blockX + (e.clientX - drag.startX) / zoom,
      y: drag.blockY + (e.clientY - drag.startY) / zoom,
    })
  }

  const onHeaderPointerUp: React.PointerEventHandler = () => {
    dragRef.current = null
    enableTextSelection()
  }

  const onResizePointerDown: React.PointerEventHandler = (e) => {
    e.stopPropagation()
    e.preventDefault()
    resizeRef.current = { startX: e.clientX, startY: e.clientY, w: block.w, h: block.h }
    disableTextSelection()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onResizePointerMove: React.PointerEventHandler = (e) => {
    const resize = resizeRef.current
    if (!resize) return
    updateBlock(block.id, {
      w: Math.max(MIN_W, resize.w + (e.clientX - resize.startX) / zoom),
      h: Math.max(MIN_H, resize.h + (e.clientY - resize.startY) / zoom),
    })
  }

  const onResizePointerUp: React.PointerEventHandler = () => {
    resizeRef.current = null
    enableTextSelection()
  }

  return (
    <div
      onPointerDownCapture={select}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: block.x,
        top: block.y,
        width: block.w,
        height: block.h,
        zIndex: block.z,
        background: 'var(--color-surface-elevated)',
        borderRadius: 'var(--radius-block)',
        border: `1px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-divider)'}`,
        overflow: 'hidden',
        // ponytail: forces its own GPU compositing layer. WKWebView (Tauri on
        // macOS) has a known repaint-invalidation bug where a bordered/rounded
        // box permanently loses its border/children paint once a sibling with
        // its own layer (Terminal's <canvas>) passes over or near it — stays
        // broken until something forces a repaint. Not reproducible in
        // Chromium; this is the standard WebKit-side fix for that bug class.
        transform: 'translateZ(0)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 500,
          color: 'var(--color-text-muted)',
          background: 'var(--color-surface-elevated)',
          borderBottom: '1px solid var(--color-divider)',
          cursor: 'grab',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: 'var(--radius-pill)',
              background: 'var(--color-text-secondary)',
            }}
          />
          <span>{block.title}</span>
        </div>
        <span
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            // Only the explicit ✕ kills a live terminal session — unmounting
            // (project switch) leaves it running for reattach.
            if (block.type === 'terminal') invoke('close_terminal', { surfaceId: block.id }).catch(() => {})
            removeBlock(block.id)
          }}
          style={{ color: 'var(--color-text-muted)', fontSize: 12, cursor: 'pointer' }}
        >
          ✕
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {block.type === 'pomodoro' && <PomodoroBlock id={block.id} data={block.data as PomodoroData} />}
        {block.type === 'tasklist' && <TaskListBlock id={block.id} data={block.data as TaskListData} />}
        {block.type === 'terminal' && <TerminalBlock id={block.id} />}
        {block.type === 'agent' && <AgentBlock id={block.id} data={block.data as AgentData} />}
        {block.type === 'editor' && <EditorBlock id={block.id} data={block.data as EditorData} />}
        {block.type === 'note' && <NoteBlock id={block.id} data={block.data as NoteData} />}
        {block.type === 'browser' && <BrowserBlock id={block.id} data={block.data as BrowserData} />}
      </div>

      <div
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 14,
          height: 14,
          cursor: 'nwse-resize',
        }}
      />
    </div>
  )
}
