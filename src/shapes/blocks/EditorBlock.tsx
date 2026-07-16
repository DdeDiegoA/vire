import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open as openFileDialog } from '@tauri-apps/plugin-dialog'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import { useVireStore } from '../../store/useVireStore'
import type { EditorData } from '../blockTypes'

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === 'json') return new jsonWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
    if (label === 'html') return new htmlWorker()
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    return new editorWorker()
  },
}

monaco.editor.defineTheme('vire-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: 'fc618d' },
    { token: 'string', foreground: 'e5c07b' },
    { token: 'comment', foreground: '4a4a4a', fontStyle: 'italic' },
    { token: 'type', foreground: '7ee787' },
  ],
  colors: {
    'editor.background': '#1a1a1a',
    'editor.foreground': '#f3f3f3',
  },
})

function fontSizeForBlock(w: number) {
  return Math.min(18, Math.max(11, w / 30))
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

function languageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    rs: 'rust', py: 'python', go: 'go', json: 'json', md: 'markdown',
    css: 'css', html: 'html', toml: 'ini', yaml: 'yaml', yml: 'yaml', sh: 'shell',
  }
  return (ext && map[ext]) || 'plaintext'
}

function basename(path: string): string {
  return path.split('/').pop() || path
}

interface FsEntry {
  name: string
  path: string
  is_dir: boolean
}

const AUTOSAVE_DEBOUNCE_MS = 600
const EXTERNAL_POLL_MS = 2000

function FileTreeNode({
  entry,
  depth,
  expanded,
  childrenByDir,
  onToggleDir,
  onOpenFile,
  activePath,
}: {
  entry: FsEntry
  depth: number
  expanded: Set<string>
  childrenByDir: Map<string, FsEntry[]>
  onToggleDir: (path: string) => void
  onOpenFile: (path: string) => void
  activePath: string
}) {
  const isOpen = expanded.has(entry.path)
  const kids = childrenByDir.get(entry.path)
  return (
    <div>
      <div
        onClick={() => (entry.is_dir ? onToggleDir(entry.path) : onOpenFile(entry.path))}
        style={{
          paddingLeft: 8 + depth * 12,
          paddingTop: 2,
          paddingBottom: 2,
          fontSize: 'clamp(9px, 2.2cqw, 12px)',
          color: entry.path === activePath ? '#fff' : '#aaa',
          background: entry.path === activePath ? 'rgba(255,255,255,0.08)' : 'transparent',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {entry.is_dir ? (isOpen ? '▾ ' : '▸ ') : '  '}
        {entry.name}
      </div>
      {entry.is_dir && isOpen && kids && (
        <div>
          {kids.map((k) => (
            <FileTreeNode
              key={k.path}
              entry={k}
              depth={depth + 1}
              expanded={expanded}
              childrenByDir={childrenByDir}
              onToggleDir={onToggleDir}
              onOpenFile={onOpenFile}
              activePath={activePath}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function EditorBlock({ id, data, w, h }: { id: string; data: EditorData; w: number; h: number }) {
  const updateBlockData = useVireStore((s) => s.updateBlockData)
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const modelsRef = useRef<Map<string, monaco.editor.ITextModel>>(new Map())
  const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const mtimeBaselineRef = useRef<Map<string, number>>(new Map())
  const dataRef = useRef(data)
  dataRef.current = data

  const [status, setStatus] = useState('')
  const [rootEntries, setRootEntries] = useState<FsEntry[]>([])
  const [childrenByDir, setChildrenByDir] = useState<Map<string, FsEntry[]>>(new Map())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [externalChange, setExternalChange] = useState(false)

  // --- editor instance (created once) ---
  useEffect(() => {
    if (!containerRef.current) return
    const editor = monaco.editor.create(containerRef.current, {
      value: '',
      language: 'plaintext',
      theme: 'vire-dark',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: fontSizeForBlock(w),
      minimap: { enabled: false },
      automaticLayout: true,
    })
    editorRef.current = editor
    return () => {
      editor.dispose()
      for (const model of modelsRef.current.values()) model.dispose()
      modelsRef.current.clear()
      for (const t of saveTimersRef.current.values()) clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps — w intentional, handled below
  }, [])

  useEffect(() => {
    editorRef.current?.updateOptions({ fontSize: fontSizeForBlock(w) })
  }, [w, h])

  // --- file tree loading ---
  const loadDir = async (path: string): Promise<FsEntry[]> => {
    try {
      return await invoke<FsEntry[]>('list_dir', { path })
    } catch {
      return []
    }
  }

  useEffect(() => {
    if (!data.root) {
      setRootEntries([])
      return
    }
    loadDir(data.root).then(setRootEntries)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.root])

  const toggleDir = async (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
    if (!expanded.has(path) && !childrenByDir.has(path)) {
      const kids = await loadDir(path)
      setChildrenByDir((prev) => new Map(prev).set(path, kids))
    }
  }

  // --- model management ---
  const getOrCreateModel = async (path: string): Promise<monaco.editor.ITextModel | null> => {
    const existing = modelsRef.current.get(path)
    if (existing) return existing
    try {
      const contents = await invoke<string>('read_text_file', { path })
      const model = monaco.editor.createModel(contents, languageFromPath(path))
      model.onDidChangeContent(() => scheduleSave(path, model))
      modelsRef.current.set(path, model)
      recordBaseline(path)
      return model
    } catch (err) {
      setStatus(`Error al abrir: ${err}`)
      return null
    }
  }

  const recordBaseline = async (path: string) => {
    try {
      const ms = await invoke<number>('file_mtime', { path })
      mtimeBaselineRef.current.set(path, ms)
    } catch {
      // file may not exist yet (new file) — no baseline to track
    }
  }

  const saveNow = async (path: string, model: monaco.editor.ITextModel) => {
    try {
      await invoke('write_text_file', { path, contents: model.getValue() })
      await recordBaseline(path)
      setStatus('Guardado')
      setTimeout(() => setStatus(''), 1200)
    } catch (err) {
      setStatus(`Error al guardar: ${err}`)
    }
  }

  const scheduleSave = (path: string, model: monaco.editor.ITextModel) => {
    const timers = saveTimersRef.current
    const existing = timers.get(path)
    if (existing) clearTimeout(existing)
    setStatus('Editando…')
    timers.set(
      path,
      setTimeout(() => {
        timers.delete(path)
        saveNow(path, model)
      }, AUTOSAVE_DEBOUNCE_MS),
    )
  }

  const flushSave = (path: string) => {
    const timers = saveTimersRef.current
    const t = timers.get(path)
    const model = modelsRef.current.get(path)
    if (t) clearTimeout(t)
    timers.delete(path)
    if (model) saveNow(path, model)
  }

  // --- open / close / switch tabs ---
  const openFile = async (path: string) => {
    const model = await getOrCreateModel(path)
    if (!model) return
    const cur = dataRef.current
    const openPaths = cur.openPaths.includes(path) ? cur.openPaths : [...cur.openPaths, path]
    updateBlockData(id, { ...cur, openPaths, activePath: path, root: cur.root ?? (path.slice(0, path.lastIndexOf('/')) || undefined) })
    editorRef.current?.setModel(model)
    setExternalChange(false)
  }

  const closeTab = (path: string) => {
    const cur = dataRef.current
    flushSave(path)
    const openPaths = cur.openPaths.filter((p) => p !== path)
    const model = modelsRef.current.get(path)
    if (model) {
      model.dispose()
      modelsRef.current.delete(path)
    }
    mtimeBaselineRef.current.delete(path)
    let activePath = cur.activePath
    if (activePath === path) {
      activePath = openPaths[openPaths.length - 1] ?? ''
      if (activePath) {
        getOrCreateModel(activePath).then((m) => m && editorRef.current?.setModel(m))
      } else {
        editorRef.current?.setModel(null)
      }
    }
    updateBlockData(id, { ...cur, openPaths, activePath })
    setExternalChange(false)
  }

  // switch model when activePath changes externally (e.g. persisted state restore)
  useEffect(() => {
    if (!data.activePath) return
    getOrCreateModel(data.activePath).then((m) => m && editorRef.current?.setModel(m))
    setExternalChange(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.activePath])

  // --- external-change polling for the active file ---
  useEffect(() => {
    if (!data.activePath) return
    const path = data.activePath
    const interval = setInterval(async () => {
      try {
        const ms = await invoke<number>('file_mtime', { path })
        const baseline = mtimeBaselineRef.current.get(path)
        if (baseline != null && ms > baseline) setExternalChange(true)
      } catch {
        // file removed externally — ignore, keep editing in memory
      }
    }, EXTERNAL_POLL_MS)
    return () => clearInterval(interval)
  }, [data.activePath])

  const reloadFromDisk = async () => {
    const path = data.activePath
    const model = modelsRef.current.get(path)
    if (!model) return
    const contents = await invoke<string>('read_text_file', { path })
    model.setValue(contents)
    await recordBaseline(path)
    setExternalChange(false)
  }

  const keepMine = async () => {
    await recordBaseline(data.activePath)
    setExternalChange(false)
  }

  const pickRoot = async () => {
    const selected = await openFileDialog({ multiple: false, directory: true })
    if (!selected || Array.isArray(selected)) return
    updateBlockData(id, { ...data, root: selected })
  }

  const browseForFile = async () => {
    const selected = await openFileDialog({ multiple: false, directory: false })
    if (!selected || Array.isArray(selected)) return
    openFile(selected)
  }

  const onKeyDown: React.KeyboardEventHandler = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      if (data.activePath) flushSave(data.activePath)
    }
  }

  return (
    <div
      role="application"
      aria-label="Editor de código"
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={onKeyDown}
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <div
        style={{
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          padding: '6px 8px',
          borderBottom: '1px solid var(--color-divider)',
        }}
      >
        <button type="button" className="v-focus-ring" onClick={pickRoot} style={buttonStyle}>Carpeta</button>
        <button type="button" className="v-focus-ring" onClick={browseForFile} style={buttonStyle}>Abrir archivo</button>
        {status && <span style={{ fontSize: 'clamp(8px, 2cqw, 11px)', color: 'var(--color-text-muted)' }}>{status}</span>}
      </div>
      {data.openPaths.length > 0 && (
        <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--color-divider)' }}>
          {data.openPaths.map((p) => (
            <div
              key={p}
              onClick={() => openFile(p)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                fontSize: 'clamp(9px, 2.2cqw, 12px)',
                color: p === data.activePath ? '#fff' : '#888',
                background: p === data.activePath ? 'rgba(255,255,255,0.08)' : 'transparent',
                borderRight: '1px solid var(--color-divider)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {basename(p)}
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(p)
                }}
                style={{ color: '#666', padding: '0 2px' }}
              >
                ×
              </span>
            </div>
          ))}
        </div>
      )}
      {externalChange && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            padding: '4px 8px',
            fontSize: 'clamp(9px, 2.2cqw, 12px)',
            background: 'rgba(252, 97, 141, 0.15)',
            color: '#fc618d',
          }}
        >
          <span>Archivo modificado fuera del editor</span>
          <button type="button" className="v-focus-ring" onClick={reloadFromDisk} style={buttonStyle}>Recargar</button>
          <button type="button" className="v-focus-ring" onClick={keepMine} style={buttonStyle}>Mantener mío</button>
        </div>
      )}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {data.root && (
          <div style={{ width: 140, overflowY: 'auto', borderRight: '1px solid var(--color-divider)', padding: '4px 0' }}>
            {rootEntries.map((entry) => (
              <FileTreeNode
                key={entry.path}
                entry={entry}
                depth={0}
                expanded={expanded}
                childrenByDir={childrenByDir}
                onToggleDir={toggleDir}
                onOpenFile={openFile}
                activePath={data.activePath}
              />
            ))}
          </div>
        )}
        <div ref={containerRef} style={{ flex: 1 }} />
      </div>
    </div>
  )
}
