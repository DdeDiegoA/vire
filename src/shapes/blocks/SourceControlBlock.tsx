import { useEffect, useState } from 'react'
import { Channel, invoke } from '@tauri-apps/api/core'
import { open as openDirDialog } from '@tauri-apps/plugin-dialog'
import { BranchUp, Plus, Minus } from 'reicon-react'
import { useVireStore } from '../../store/useVireStore'
import type { SourceControlData } from '../blockTypes'

interface GitFileEntry {
  path: string
  status: string
}

interface GitStatusDto {
  staged: GitFileEntry[]
  unstaged: GitFileEntry[]
  untracked: GitFileEntry[]
  branch: string | null
}

interface SelectedFile {
  path: string
  staged: boolean
  untracked: boolean
}

const buttonStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.06)',
  border: '0.5px solid var(--glass-block-border)',
  borderRadius: 6,
  color: '#aaa',
  padding: '3px 9px',
  fontSize: 'clamp(9px, 2.2cqw, 12px)',
  cursor: 'pointer',
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 'clamp(9px, 2.2cqw, 11px)',
  color: 'var(--color-text-secondary)',
  marginBottom: 4,
}

export function SourceControlBlock({ id: _id, data: _data }: { id: string; data: SourceControlData }) {
  const activeId = useVireStore((s) => s.activeId)
  const repoPath = useVireStore((s) => s.projects.find((p) => p.id === s.activeId)?.repoPath)
  const setRepoPath = useVireStore((s) => s.setRepoPath)
  const [status, setStatus] = useState<GitStatusDto | null>(null)
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null)
  const [diff, setDiff] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [commentLine, setCommentLine] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [drafting, setDrafting] = useState(false)
  const addBlock = useVireStore((s) => s.addBlock)

  const refresh = async () => {
    if (!repoPath) return
    try {
      const s = await invoke<GitStatusDto>('git_status', { repoPath })
      setStatus(s)
      setError('')
    } catch (err) {
      setError(String(err))
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath])

  useEffect(() => {
    setCommentLine(null)
    setComment('')
    if (!selectedFile || !repoPath) {
      setDiff('')
      return
    }
    invoke<string>('git_diff', {
      repoPath,
      file: selectedFile.path,
      staged: selectedFile.staged,
      untracked: selectedFile.untracked,
    })
      .then(setDiff)
      .catch((err) => setDiff(String(err)))
  }, [selectedFile, repoPath])

  const chooseRepo = async () => {
    const dir = await openDirDialog({ directory: true })
    if (!dir || Array.isArray(dir)) return
    setRepoPath(activeId, dir)
  }

  const stage = async (path: string) => {
    if (!repoPath) return
    try {
      await invoke('git_stage', { repoPath, files: [path] })
    } catch (err) {
      setError(String(err))
    }
    refresh()
  }

  const unstage = async (path: string) => {
    if (!repoPath) return
    try {
      await invoke('git_unstage', { repoPath, files: [path] })
    } catch (err) {
      setError(String(err))
    }
    refresh()
  }

  const commit = async () => {
    if (!repoPath || !message.trim()) return
    try {
      await invoke('git_commit', { repoPath, message: message.trim() })
      setMessage('')
      setDiff('')
      setSelectedFile(null)
      refresh()
    } catch (err) {
      setError(String(err))
    }
  }

  const sendCommentToAgent = (lineText: string) => {
    if (!selectedFile || !repoPath || !comment.trim()) return
    const prompt = `Archivo: ${selectedFile.path}\n\nDiff:\n${diff}\n\nComentario sobre la línea "${lineText.trim()}":\n${comment.trim()}`
    addBlock('agent', 40, 40, { cli: 'claude', cwd: repoPath, initialPrompt: prompt })
    setCommentLine(null)
    setComment('')
  }

  const draftCommitMessage = async () => {
    if (!repoPath || !status || drafting) return
    const files = status.staged.length > 0 ? status.staged : status.unstaged
    if (files.length === 0) return
    setDrafting(true)
    setError('')
    try {
      const diffs = await Promise.all(
        files.map((f) =>
          invoke<string>('git_diff', { repoPath, file: f.path, staged: status.staged.length > 0, untracked: false }).catch(() => ''),
        ),
      )
      const prompt = `Escribe SOLO un mensaje de commit conciso (estilo conventional commits, una línea, sin comillas ni explicación) para este diff:\n\n${diffs.join('\n\n')}`
      let text = ''
      const channel = new Channel<{ kind: 'Line'; raw: unknown } | { kind: 'Done'; error: string | null }>()
      const done = new Promise<void>((resolve) => {
        channel.onmessage = (msg) => {
          if (msg.kind === 'Line') {
            const obj = msg.raw as Record<string, unknown>
            const content = (obj?.message as Record<string, unknown> | undefined)?.content
            if (Array.isArray(content)) {
              text += content
                .filter((c): c is { type: string; text: string } => (c as { type?: string })?.type === 'text')
                .map((c) => c.text)
                .join('')
            }
          } else {
            resolve()
          }
        }
      })
      // ponytail: backend Done event is expected but not guaranteed (dropped channel, crashed CLI) — cap the wait so drafting never hangs
      const timedOut = Symbol('timeout')
      let timer: ReturnType<typeof setTimeout>
      const timeout = new Promise<typeof timedOut>((resolve) => {
        timer = setTimeout(() => resolve(timedOut), 30000)
      })
      await invoke('run_agent', { cli: 'claude', prompt, cwd: repoPath, sessionId: null, onEvent: channel })
      const result = await Promise.race([done, timeout])
      clearTimeout(timer!)
      if (result === timedOut) {
        setError('El agente no respondió a tiempo generando el mensaje de commit.')
      } else if (text.trim()) {
        setMessage(text.trim().replace(/^["'`]|["'`]$/g, '').split('\n')[0])
      } else {
        setError('El agente no devolvió texto para el mensaje de commit.')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setDrafting(false)
    }
  }

  const onKeyDown: React.KeyboardEventHandler = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      commit()
    }
  }

  if (!repoPath) {
    return (
      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 10,
          padding: 16,
        }}
      >
        <span style={{ color: 'var(--color-text-muted)', fontSize: 'clamp(10px, 2.5cqw, 12px)', textAlign: 'center' }}>
          Este proyecto no tiene un repositorio git asociado.
        </span>
        <button type="button" className="v-focus-ring" onClick={chooseRepo} style={buttonStyle}>
          Elegir carpeta
        </button>
      </div>
    )
  }

  const renderFileRow = (f: GitFileEntry, opts: { staged: boolean; untracked?: boolean }) => (
    <div
      key={`${opts.staged ? 's' : 'u'}-${f.path}`}
      onClick={() => setSelectedFile({ path: f.path, staged: opts.staged, untracked: !!opts.untracked })}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 6px',
        borderRadius: 4,
        cursor: 'pointer',
        background: selectedFile?.path === f.path ? 'rgba(255, 255, 255, 0.06)' : 'none',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'clamp(8px, 2cqw, 10px)',
          color: 'var(--color-text-muted)',
          width: 20,
        }}
      >
        {f.status.trim()}
      </span>
      <span
        style={{
          flex: 1,
          fontSize: 'clamp(9px, 2.2cqw, 12px)',
          color: '#ccc',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {f.path}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (opts.staged) unstage(f.path)
          else stage(f.path)
        }}
        style={{ ...buttonStyle, padding: '1px 6px', display: 'inline-flex', alignItems: 'center' }}
      >
        {opts.staged ? <Minus size={11} weight="Outline" /> : <Plus size={11} weight="Outline" />}
      </button>
    </div>
  )

  const noChanges = status && status.staged.length === 0 && status.unstaged.length === 0 && status.untracked.length === 0

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={onKeyDown}
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          borderBottom: '1px solid var(--color-divider)',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: 'var(--font-mono)',
            fontSize: 'clamp(9px, 2.2cqw, 11px)',
            color: 'var(--color-accent)',
          }}
        >
          <BranchUp size={12} weight="Outline" /> {status?.branch ?? '...'}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" className="v-focus-ring" onClick={refresh} style={buttonStyle}>
          Refrescar
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {error && <span style={{ color: 'var(--color-err)', fontSize: 'clamp(9px, 2.2cqw, 11px)' }}>{error}</span>}
        {status && status.staged.length > 0 && (
          <div>
            <div style={sectionLabelStyle}>Staged</div>
            {status.staged.map((f) => renderFileRow(f, { staged: true }))}
          </div>
        )}
        {status && status.unstaged.length > 0 && (
          <div>
            <div style={sectionLabelStyle}>Sin stage</div>
            {status.unstaged.map((f) => renderFileRow(f, { staged: false }))}
          </div>
        )}
        {status && status.untracked.length > 0 && (
          <div>
            <div style={sectionLabelStyle}>Sin seguimiento</div>
            {status.untracked.map((f) => renderFileRow(f, { staged: false, untracked: true }))}
          </div>
        )}
        {noChanges && <span style={{ color: 'var(--color-text-muted)', fontSize: 'clamp(9px, 2.2cqw, 11px)' }}>Sin cambios</span>}
        {diff && (
          <pre
            style={{
              margin: 0,
              padding: 8,
              background: 'rgba(0, 0, 0, 0.25)',
              borderRadius: 6,
              overflow: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: 'clamp(8px, 2cqw, 10px)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {diff.split('\n').map((line, i) => (
              <div key={i}>
                <div
                  onClick={() => setCommentLine(commentLine === i ? null : i)}
                  style={{
                    color: line.startsWith('+') ? 'var(--color-ok)' : line.startsWith('-') ? 'var(--color-err)' : '#999',
                    cursor: 'pointer',
                    background: commentLine === i ? 'rgba(255, 255, 255, 0.06)' : 'none',
                  }}
                >
                  {line}
                </div>
                {commentLine === i && (
                  <div style={{ display: 'flex', gap: 4, padding: '3px 0 6px', whiteSpace: 'normal' }} onClick={(e) => e.stopPropagation()}>
                    <input
                      autoFocus
                      className="v-focus-ring"
                      aria-label="Comentario sobre esta línea"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendCommentToAgent(line)}
                      placeholder="Comentario para el agente..."
                      style={{
                        flex: 1,
                        background: 'rgba(0, 0, 0, 0.35)',
                        border: '0.5px solid var(--glass-block-border)',
                        borderRadius: 6,
                        color: '#ccc',
                        fontFamily: 'var(--font-ui)',
                        fontSize: 'clamp(9px, 2.2cqw, 11px)',
                        padding: '3px 6px',
                      }}
                    />
                    <button type="button" className="v-focus-ring" onClick={() => sendCommentToAgent(line)} style={{ ...buttonStyle, padding: '3px 8px' }}>
                      Enviar a agente
                    </button>
                  </div>
                )}
              </div>
            ))}
          </pre>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '6px 8px', borderTop: '1px solid var(--color-divider)' }}>
        <input
          className="v-focus-ring"
          aria-label="Mensaje de commit"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Mensaje de commit"
          style={{
            flex: 1,
            background: 'rgba(0, 0, 0, 0.25)',
            border: '0.5px solid var(--glass-block-border)',
            borderRadius: 6,
            color: '#ccc',
            fontFamily: 'var(--font-ui)',
            fontSize: 'clamp(9px, 2.2cqw, 12px)',
            padding: '3px 6px',
          }}
        />
        <button type="button" className="v-focus-ring" onClick={draftCommitMessage} disabled={drafting} title="Generar mensaje con IA" style={buttonStyle}>
          {drafting ? '...' : 'IA'}
        </button>
        <button type="button" className="v-focus-ring" onClick={commit} style={buttonStyle}>
          Commit
        </button>
      </div>
    </div>
  )
}
