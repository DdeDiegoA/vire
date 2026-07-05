import { useEffect, useRef } from 'react'
import { VIRE_BLOCK_TYPES, iconByType, nameByType, type VireBlockType } from '../shapes/blockTypes'

export function VireContextMenu({
  x,
  y,
  onSelect,
  onClose,
}: {
  x: number
  y: number
  onSelect: (type: VireBlockType) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', handlePointerDown, { capture: true })
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, { capture: true })
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        zIndex: 300,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-control)',
        padding: 4,
        minWidth: 160,
        fontFamily: 'var(--font-ui)',
        fontSize: 12,
      }}
    >
      {VIRE_BLOCK_TYPES.map((type) => (
        <button
          key={type}
          onClick={() => onSelect(type)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-primary)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 10px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            textAlign: 'left',
          }}
        >
          <span style={{ color: 'var(--color-text-secondary)' }}>{iconByType[type]}</span>
          {nameByType[type]}
        </button>
      ))}
    </div>
  )
}
