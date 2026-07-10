import { useVireStore } from '../store/useVireStore'
import { VIRE_BLOCK_TYPES, BLOCK_ICON, nameByType, type VireBlockType } from '../shapes/blockTypes'

export function VireToolbar() {
  const addBlock = useVireStore((s) => s.addBlock)
  const selectBlock = useVireStore((s) => s.selectBlock)
  const selectedBlockId = useVireStore((s) => s.selectedBlockId)
  const board = useVireStore((s) => s.boardsByProject[s.activeId])
  const activeType = board?.blocks.find((b) => b.id === selectedBlockId)?.type ?? null

  const handleAdd = (blockType: VireBlockType) => {
    const camera = board?.camera ?? { x: 0, y: 0, z: 1 }
    const worldX = (window.innerWidth / 2 - camera.x) / camera.z - 160
    const worldY = (window.innerHeight / 2 - camera.y) / camera.z - 120
    const id = addBlock(blockType, worldX, worldY)
    selectBlock(id)
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 28,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
        display: 'flex',
        gap: 0,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-pill)',
        padding: 3,
      }}
    >
      {VIRE_BLOCK_TYPES.map((blockType) => {
        const isActive = activeType === blockType
        const Icon = BLOCK_ICON[blockType]
        return (
          <button
            type="button"
            key={blockType}
            onClick={() => handleAdd(blockType)}
            title={nameByType[blockType]}
            style={{
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isActive ? 'rgba(255, 255, 255, 0.15)' : 'none',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            <Icon size={17} weight="Outline" />
          </button>
        )
      })}
    </div>
  )
}
