/**
 * Previsualizaciones estáticas portadas del mockup de Open Design.
 * Terminal/Agent quedan sin datos vivos hasta Fase 2 (libghostty, runtime de agentes);
 * el contenido aquí es el demo visual del diseño, no datos reales.
 */

export function TerminalPreview() {
  return (
    <div
      style={{
        padding: 12,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        lineHeight: 1.65,
        color: 'var(--color-text-primary)',
        background: 'var(--color-surface)',
      }}
    >
      <div>
        <span style={{ color: 'var(--color-accent)' }}>➜</span>{' '}
        <span style={{ color: 'var(--color-text-primary)' }}>cargo test</span>
      </div>
      <div style={{ color: 'var(--color-ok)' }}>✔ 42 passed</div>
      <div style={{ color: 'var(--color-err)' }}>✖ auth::argon2 — assertion failed</div>
      <div style={{ color: 'var(--color-text-muted)' }}>
        running 43 tests in <span style={{ color: 'var(--color-path)' }}>src/auth.rs</span>
      </div>
      <div style={{ marginTop: 6 }}>
        <span style={{ color: 'var(--color-accent)' }}>➜</span>{' '}
        <span
          style={{
            display: 'inline-block',
            width: 7,
            height: 13,
            background: 'var(--color-accent)',
            verticalAlign: 'text-bottom',
          }}
        />
      </div>
    </div>
  )
}

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

export function NotePreview() {
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
      <div>
        <strong style={{ color: 'var(--color-text-primary)' }}>Auth:</strong> migrate bcrypt →
        Argon2id
      </div>
      <div>
        <strong style={{ color: 'var(--color-text-primary)' }}>DB:</strong> SQLite local, pg para
        prod
      </div>
      <div>
        <strong style={{ color: 'var(--color-text-primary)' }}>API:</strong> GraphQL sobre REST
      </div>
    </div>
  )
}

export function BrowserPreview() {
  return (
    <div
      style={{
        padding: 16,
        fontFamily: 'var(--font-ui)',
        fontSize: 13,
        color: 'var(--color-text-muted)',
        background: 'var(--color-surface-elevated)',
      }}
    >
      Browser — próximamente (Fase 2)
    </div>
  )
}
