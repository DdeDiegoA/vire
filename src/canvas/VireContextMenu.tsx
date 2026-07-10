import { useEffect, useRef } from 'react'
import { VIRE_BLOCK_TYPES, BLOCK_ICON, nameByType, type VireBlockType } from '../shapes/blockTypes'

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
      role="menu"
      tabIndex={-1}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        zIndex: 300,
        background: 'var(--glass-menu-bg)',
        border: '0.5px solid var(--glass-block-border)',
        borderRadius: 10,
        boxShadow: 'var(--shadow-menu)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        padding: '6px 4px',
        minWidth: 170,
        fontFamily: 'var(--font-ui)',
        fontSize: 'clamp(11px, 3cqw, 13px)',
      }}
    >
      {VIRE_BLOCK_TYPES.map((type) => {
        const Icon = BLOCK_ICON[type]
        return (
          <button
            key={type}
            type="button"
            className="ctx-item"
            role="menuitem"
            onClick={() => onSelect(type)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              background: 'none',
              border: 'none',
              color: 'var(--color-text-primary)',
              borderRadius: 5,
              padding: '4px 8px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              textAlign: 'left',
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255, 255, 255, 0.06)',
                color: 'var(--color-accent)',
              }}
            >
              <Icon size={13} weight="Outline" />
            </span>
            {nameByType[type]}
          </button>
        )
      })}
    </div>
  )
}
