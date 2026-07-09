import { useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useVireStore, type VireBlock } from '../store/useVireStore'
import { PomodoroBlock } from '../shapes/blocks/PomodoroBlock'
import type { PomodoroData } from '../shapes/blockTypes'
import { TaskListBlock } from '../shapes/blocks/TaskListBlock'
import type { TaskListData } from '../shapes/blockTypes'
import { AgentBlock } from '../shapes/blocks/AgentBlock'
import type { AgentData } from '../shapes/blockTypes'
import { TerminalBlock } from '../shapes/blocks/TerminalBlock'
import { NoteBlock } from '../shapes/blocks/NoteBlock'
import type { NoteData } from '../shapes/blockTypes'
import { BrowserBlock } from '../shapes/blocks/BrowserBlock'
import type { BrowserData } from '../shapes/blockTypes'
import { EditorBlock } from '../shapes/blocks/EditorBlock'
import type { EditorData } from '../shapes/blockTypes'
import { SourceControlBlock } from '../shapes/blocks/SourceControlBlock'
import type { SourceControlData } from '../shapes/blockTypes'
import { BLOCK_ICON } from '../shapes/blockTypes'

const MIN_W = 160
const MIN_H = 120

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

  const closeBlock = () => {
    if (block.type === 'terminal') invoke('close_terminal', { surfaceId: block.id }).catch(() => {})
    removeBlock(block.id)
  }

  return (
    <div
      className="vire-block"
      onPointerDownCapture={select}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: block.x,
        top: block.y,
        width: block.w,
        height: block.h,
        zIndex: block.z,
        background: 'var(--glass-block-bg)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        borderRadius: 'var(--radius-block)',
        border: `0.5px solid ${isSelected ? 'var(--color-accent)' : 'var(--glass-block-border)'}`,
        boxShadow: 'var(--shadow-block)',
        transition: 'box-shadow .2s ease, transform .2s ease',
        overflow: 'hidden',
        transform: 'translateZ(0)',
        display: 'flex',
        flexDirection: 'column',
        containerType: 'size',
        containerName: 'vire-block',
      } as React.CSSProperties}
    >
      <div
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 'clamp(28px, 8cqh, 40px)',
          padding: '0 12px',
          fontFamily: 'var(--font-ui)',
          fontSize: 'clamp(10px, 3cqmin, 14px)',
          fontWeight: 500,
          color: '#b5b5b5',
          borderBottom: '0.5px solid var(--glass-hairline)',
          cursor: 'grab',
          gap: 8,
        } as React.CSSProperties}
      >
        <div
          style={{
            width: 'clamp(14px, 4.5cqmin, 20px)',
            height: 'clamp(14px, 4.5cqmin, 20px)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(255, 255, 255, 0.06)',
            color: 'var(--color-accent)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'clamp(8px, 2.5cqmin, 10px)',
            fontWeight: 600,
          } as React.CSSProperties}
        >
          {BLOCK_ICON[block.type] ?? block.type[0]?.toUpperCase()}
        </div>
        <span style={{ flex: 1 }}>{block.title}</span>
        <button
          type="button"
          className="block-close"
          aria-label={`Cerrar ${block.title}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={closeBlock}
          style={{
            width: 'clamp(16px, 5.5cqmin, 22px)',
            height: 'clamp(16px, 5.5cqmin, 22px)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-sm)',
            color: '#555',
            fontSize: 'clamp(10px, 3cqmin, 13px)',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
          } as React.CSSProperties}
        >
          ✕
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {block.type === 'pomodoro' && <PomodoroBlock id={block.id} data={block.data as PomodoroData} />}
        {block.type === 'tasklist' && <TaskListBlock id={block.id} data={block.data as TaskListData} />}
        {block.type === 'terminal' && <TerminalBlock id={block.id} zoom={zoom} />}
        {block.type === 'agent' && <AgentBlock id={block.id} data={block.data as AgentData} />}
        {block.type === 'editor' && <EditorBlock id={block.id} data={block.data as EditorData} w={block.w} h={block.h} />}
        {block.type === 'note' && <NoteBlock id={block.id} data={block.data as NoteData} />}
        {block.type === 'browser' && <BrowserBlock id={block.id} data={block.data as BrowserData} />}
        {block.type === 'sourcecontrol' && <SourceControlBlock id={block.id} data={block.data as SourceControlData} />}
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
