import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { X } from 'reicon-react'

interface CliConfig {
  command: string
  args: string
  env: string
}

const CLIS = ['Claude', 'OpenCode', 'Codex', 'Hermes'] as const
const TERMINAL_TYPES = ['auto', 'xterm-256color', 'xterm', 'screen-256color', 'vt100', 'ansi', 'linux'] as const
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
  const [termType, setTermType] = useState('auto')
  const [shellPath, setShellPath] = useState('auto')
  const [shells, setShells] = useState<string[]>([])
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
      const termCfg = await invoke<string | null>('get_config', { key: 'terminal:type' })
      if (!cancelled && termCfg) setTermType(termCfg)
      const shellCfg = await invoke<string | null>('get_config', { key: 'terminal:shell' })
      if (!cancelled && shellCfg) setShellPath(shellCfg)
      const shellList = await invoke<string[]>('list_shells')
      if (!cancelled) setShells(shellList)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const update = (cli: string, partial: Partial<CliConfig>) =>
    setConfigs((c) => ({ ...c, [cli]: { ...(c[cli] ?? emptyConfig), ...partial } }))

  const save = (cli: string) =>
    invoke('set_config', { key: configKey(cli), valueJson: JSON.stringify(configs[cli] ?? emptyConfig) })

  const saveTermType = (value: string) => {
    setTermType(value)
    invoke('set_config', { key: 'terminal:type', valueJson: value })
  }

  const saveShellPath = (value: string) => {
    setShellPath(value)
    invoke('set_config', { key: 'terminal:shell', valueJson: value })
  }

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
          style={{ color: 'var(--color-text-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', background: 'none', border: 'none' }}
        >
          <X size={14} weight="Outline" />
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
      <div style={{ marginTop: 8, paddingTop: 12, borderTop: '0.5px solid var(--glass-block-border)' }}>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 'clamp(11px, 3cqw, 13px)', marginBottom: 6 }}>Terminal type</div>
        <select
          className="v-focus-ring"
          aria-label="Tipo de terminal"
          value={termType}
          onChange={(e) => saveTermType(e.target.value)}
          style={{ ...inputStyle, width: 'auto', minWidth: 180 }}
        >
          {TERMINAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {t === 'auto' ? 'Auto-detect' : t}
            </option>
          ))}
        </select>
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 'clamp(11px, 3cqw, 13px)', marginBottom: 6 }}>Shell</div>
        <select
          className="v-focus-ring"
          aria-label="Shell del sistema"
          value={shellPath}
          onChange={(e) => saveShellPath(e.target.value)}
          style={{ ...inputStyle, width: 'auto', minWidth: 180 }}
        >
          <option value="auto">Auto (SHELL del sistema)</option>
          {shells.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </dialog>
  )
}
