import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface CliConfig {
  command: string
  args: string
  env: string
}

const CLIS = ['Claude', 'OpenCode', 'Codex', 'Hermes'] as const
const emptyConfig: CliConfig = { command: '', args: '', env: '' }
const configKey = (cli: string) => `cli:${cli.toLowerCase()}`

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(0, 0, 0, 0.25)',
  border: '0.5px solid var(--glass-block-border)',
  borderRadius: 6,
  color: '#ccc',
  padding: '4px 9px',
  fontSize: 'clamp(11px, 3cqw, 13px)',
  fontFamily: 'var(--font-mono)',
}

const buttonStyle: React.CSSProperties = {
  marginTop: 8,
  background: 'rgba(255, 255, 255, 0.06)',
  border: '0.5px solid var(--glass-block-border)',
  borderRadius: 6,
  color: '#aaa',
  padding: '4px 11px',
  fontSize: 'clamp(11px, 3cqw, 13px)',
  cursor: 'pointer',
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [configs, setConfigs] = useState<Record<string, CliConfig>>({})
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const entries: Record<string, CliConfig> = {}
      const results = await Promise.all(
        CLIS.map((cli) => invoke<string | null>('get_config', { key: configKey(cli) }))
      )
      CLIS.forEach((cli, i) => {
        entries[cli] = results[i] ? JSON.parse(results[i]!) : { ...emptyConfig }
      })
      if (!cancelled) setConfigs(entries)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const update = (cli: string, partial: Partial<CliConfig>) =>
    setConfigs((c) => ({ ...c, [cli]: { ...(c[cli] ?? emptyConfig), ...partial } }))

  const save = (cli: string) =>
    invoke('set_config', { key: configKey(cli), valueJson: JSON.stringify(configs[cli] ?? emptyConfig) })

  return (
    <dialog
      ref={dialogRef}
      aria-label="Configuración de CLIs"
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 48,
        right: 16,
        zIndex: 200,
        width: 340,
        maxHeight: '70vh',
        overflow: 'auto',
        background: 'var(--glass-block-bg)',
        border: '0.5px solid var(--glass-block-border)',
        borderRadius: 'var(--radius-block)',
        boxShadow: 'var(--shadow-block)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        padding: 16,
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ color: 'var(--color-text-primary)', fontSize: 'clamp(12px, 3.2cqw, 14px)', fontWeight: 600 }}>Config AI CLIs</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar configuración"
          style={{ color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 'clamp(12px, 3.2cqw, 14px)', background: 'none', border: 'none' }}
        >
          ✕
        </button>
      </div>
      {CLIS.map((cli) => {
        const cfg = configs[cli] ?? emptyConfig
        return (
          <div key={cli} style={{ marginBottom: 14 }}>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: 'clamp(11px, 3cqw, 13px)', marginBottom: 6 }}>{cli}</div>
            <input
              className="v-focus-ring"
              aria-label={`Comando para ${cli}`}
              value={cfg.command}
              onChange={(e) => update(cli, { command: e.target.value })}
              placeholder="command"
              style={inputStyle}
            />
            <input
              className="v-focus-ring"
              aria-label={`Argumentos para ${cli}`}
              value={cfg.args}
              onChange={(e) => update(cli, { args: e.target.value })}
              placeholder="args"
              style={{ ...inputStyle, marginTop: 6 }}
            />
            <input
              className="v-focus-ring"
              aria-label={`Variables de entorno para ${cli}`}
              value={cfg.env}
              onChange={(e) => update(cli, { env: e.target.value })}
              placeholder="env (KEY=value,...)"
              style={{ ...inputStyle, marginTop: 6 }}
            />
            <button type="button" className="v-focus-ring" onClick={() => save(cli)} style={buttonStyle}>
              Guardar
            </button>
          </div>
        )
      })}
    </dialog>
  )
}
