import { useVireStore } from '../store/useVireStore'

export function VireTopbar() {
  const projects = useVireStore((s) => s.projects)
  const activeId = useVireStore((s) => s.activeId)
  const setActive = useVireStore((s) => s.setActive)
  const addProject = useVireStore((s) => s.addProject)

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 44,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-6)',
        background: 'rgba(16, 16, 16, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        fontFamily: 'var(--font-ui)',
        fontSize: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 14, color: 'var(--color-text-primary)', letterSpacing: '0.02em' }}>
          Vire
        </span>
        <span
          style={{
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-pill)',
            padding: '2px 10px',
          }}
        >
          β
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {projects.map((p) => {
          const isActive = p.id === activeId
          return (
            <button
              key={p.id}
              onClick={() => setActive(p.id)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '1px solid var(--color-text-primary)' : '1px solid transparent',
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                padding: '4px 0',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'inherit',
              }}
            >
              {p.name}
              {isActive && (
                <span
                  style={{
                    display: 'inline-block',
                    width: 5,
                    height: 5,
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--color-accent)',
                    marginLeft: 4,
                    verticalAlign: 'middle',
                  }}
                />
              )}
            </button>
          )
        })}
      </div>

      <button
        onClick={addProject}
        title="Nuevo proyecto"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        +
      </button>
    </div>
  )
}
