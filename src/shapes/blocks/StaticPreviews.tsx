/**
 * Previsualizaciones estáticas portadas del mockup de Open Design.
 * Agent queda sin datos vivos hasta el runtime de agentes;
 * el contenido aquí es el demo visual del diseño, no datos reales.
 */

export function AgentPreview() {
  return (
    <div
      style={{
        padding: 14,
        fontSize: 12,
        lineHeight: 1.55,
        color: 'var(--color-text-secondary)',
        background: 'var(--color-surface-elevated)',
      }}
    >
      <div style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
        refactor auth to Argon2
      </div>
      <div style={{ height: 8 }} />
      <div style={{ color: 'var(--color-text-primary)' }}>Running analysis…</div>
      <div style={{ height: 8 }} />
      <div
        style={{
          color: 'var(--color-text-muted)',
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
        }}
      >
        ▶ read_file(auth.rs)
        <br />▶ search("password_hash")
        <br />▶ patch(auth.rs, L42)
      </div>
      <div style={{ height: 8 }} />
      <div style={{ color: 'var(--color-text-primary)' }}>Done. 3 files changed.</div>
    </div>
  )
}
