import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface CliConfig {
  command: string
  args: string
  env: string
}

const CLIS = ['Claude', 'OpenCode', 'Codex', 'Hermes'] as const
const emptyConfig: CliConfig = { command: '', args: '', env: '' }
const configKey = (cli: string) => `cli:${cli.toLowerCase()}`

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [configs, setConfigs] = useState<Record<string, CliConfig>>({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const entries: Record<string, CliConfig> = {}
      for (const cli of CLIS) {
        const raw = await invoke<string | null>('get_config', { key: configKey(cli) })
        entries[cli] = raw ? JSON.parse(raw) : { ...emptyConfig }
      }
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
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 200,
        width: 340,
        maxHeight: '70vh',
        overflow: 'auto',
        background: 'var(--color-surface-elevated)',
        border: '1px solid var(--color-divider)',
        borderRadius: 'var(--radius-md)',
        padding: 16,
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 600 }}>Config AI CLIs</span>
        <span onClick={onClose} style={{ color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 13 }}>
          ✕
        </span>
      </div>
      {CLIS.map((cli) => {
        const cfg = configs[cli] ?? emptyConfig
        return (
          <div key={cli} style={{ marginBottom: 14 }}>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: 12, marginBottom: 6 }}>{cli}</div>
            <input
              value={cfg.command}
              onChange={(e) => update(cli, { command: e.target.value })}
              placeholder="command"
              style={inputStyle}
            />
            <input
              value={cfg.args}
              onChange={(e) => update(cli, { args: e.target.value })}
              placeholder="args"
              style={{ ...inputStyle, marginTop: 6 }}
            />
            <input
              value={cfg.env}
              onChange={(e) => update(cli, { env: e.target.value })}
              placeholder="env (KEY=value,...)"
              style={{ ...inputStyle, marginTop: 6 }}
            />
            <button onClick={() => save(cli)} style={buttonStyle}>
              Guardar
            </button>
          </div>
        )
      })}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-divider)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-text-primary)',
  padding: '4px 8px',
  fontSize: 12,
  fontFamily: 'var(--font-mono)',
}

const buttonStyle: React.CSSProperties = {
  marginTop: 8,
  background: 'var(--color-surface)',
  border: '1px solid var(--color-divider)',
  borderRadius: 'var(--radius-control)',
  color: 'var(--color-text-primary)',
  padding: '4px 10px',
  fontSize: 12,
  cursor: 'pointer',
}
