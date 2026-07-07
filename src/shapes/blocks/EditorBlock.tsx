import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
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

export function EditorBlock({ id, data, w, h }: { id: string; data: EditorData; w: number; h: number }) {
  const updateBlockData = useVireStore((s) => s.updateBlockData)
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const [pathInput, setPathInput] = useState(() => data.path)
  const [status, setStatus] = useState('')

  useEffect(() => {
    setPathInput(data.path)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.path])

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
    return () => editor.dispose()
  }, [])

  useEffect(() => {
    editorRef.current?.updateOptions({ fontSize: fontSizeForBlock(w) })
  }, [w, h])

  const load = async (path: string) => {
    if (!path) return
    try {
      const contents = await invoke<string>('read_text_file', { path })
      editorRef.current?.setValue(contents)
      monaco.editor.setModelLanguage(editorRef.current!.getModel()!, languageFromPath(path))
      setStatus('')
    } catch (err) {
      setStatus(`Error al abrir: ${err}`)
    }
  }

  useEffect(() => {
    load(data.path)
  }, [data.path])

  const openPath = () => {
    updateBlockData(id, { ...data, path: pathInput })
  }

  const save = async () => {
    if (!data.path || !editorRef.current) return
    try {
      await invoke('write_text_file', { path: data.path, contents: editorRef.current.getValue() })
      setStatus('Guardado')
      setTimeout(() => setStatus(''), 1500)
    } catch (err) {
      setStatus(`Error al guardar: ${err}`)
    }
  }

  const onKeyDown: React.KeyboardEventHandler = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      save()
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
        <input
          className="v-focus-ring"
          aria-label="Ruta del archivo"
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && openPath()}
          placeholder="/ruta/al/archivo"
          style={{
            flex: 1,
            background: 'rgba(0, 0, 0, 0.25)',
            border: '0.5px solid var(--glass-block-border)',
            borderRadius: 6,
            color: '#ccc',
            fontFamily: 'var(--font-mono)',
            fontSize: 'clamp(9px, 2.2cqw, 12px)',
            padding: '3px 6px',
          }}
        />
        <button type="button" className="v-focus-ring" onClick={openPath} style={buttonStyle}>Abrir</button>
        <button type="button" className="v-focus-ring" onClick={save} style={buttonStyle}>Guardar</button>
        {status && <span style={{ fontSize: 'clamp(8px, 2cqw, 11px)', color: 'var(--color-text-muted)' }}>{status}</span>}
      </div>
      <div ref={containerRef} style={{ flex: 1 }} />
    </div>
  )
}
