import { useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useVireStore, useActiveBoard } from '../store/useVireStore'
import { VIRE_BLOCK_TYPES, nameByType } from '../shapes/blockTypes'

// Fuzzy scorer: substring match ranked by earliness, else subsequence match
// with a contiguity bonus. ponytail: hand-rolled instead of a fuzzy-search
// dependency — the candidate lists here are small (thousands, not millions)
// so a simple scorer is plenty; swap for a real lib if ranking quality
// becomes a complaint.
function fuzzyScore(query: string, target: string): number | null {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  if (!q) return 0
  const idx = t.indexOf(q)
  if (idx !== -1) return 1000 - idx
  let qi = 0
  let score = 0
  let lastMatch = -2
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += lastMatch === ti - 1 ? 2 : 1
      lastMatch = ti
      qi++
    }
  }
  return qi === q.length ? score : null
}

interface Item {
  key: string
  kind: 'archivo' | 'bloque' | 'proyecto' | 'comando' | 'terminal'
  label: string
  sub?: string
  action: () => void
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 500,
  display: 'flex',
  justifyContent: 'center',
  paddingTop: '12vh',
  background: 'rgba(0, 0, 0, 0.45)',
}

const paletteStyle: React.CSSProperties = {
  width: 560,
  maxHeight: '65vh',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--glass-block-bg)',
  border: '0.5px solid var(--glass-block-border)',
  borderRadius: 'var(--radius-block)',
  boxShadow: 'var(--shadow-block)',
  backdropFilter: 'var(--glass-blur)',
  WebkitBackdropFilter: 'var(--glass-blur)',
  overflow: 'hidden',
  fontFamily: 'var(--font-ui)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: 0,
  borderBottom: '1px solid var(--color-divider)',
  color: 'var(--color-text-primary)',
  padding: '12px 14px',
  fontSize: 14,
  outline: 'none',
}

const kindLabel: Record<Item['kind'], string> = {
  archivo: 'Archivo',
  bloque: 'Bloque',
  proyecto: 'Proyecto',
  comando: 'Comando',
  terminal: 'Terminal',
}

export function QuickOpen({ onClose }: { onClose: () => void }) {
  const store = useVireStore()
  const board = useActiveBoard()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [files, setFiles] = useState<string[]>([])
  const [scrollbackHits, setScrollbackHits] = useState<{ surface_id: string; line: string }[]>([])
  const lastRootRef = useRef<string | undefined>(undefined)

  const root = useMemo(() => {
    const worktrees = store.worktreesByProject[store.activeId] ?? []
    const activeWt = store.activeWorktreeId[store.activeId]
    const wt = activeWt ? worktrees.find((w) => w.id === activeWt) : undefined
    return wt?.path ?? store.projects.find((p) => p.id === store.activeId)?.repoPath
  }, [store.activeId, store.activeWorktreeId, store.worktreesByProject, store.projects])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!root || root === lastRootRef.current) return
    lastRootRef.current = root
    invoke<string[]>('walk_project_files', { root }).then(setFiles).catch(() => setFiles([]))
  }, [root])

  useEffect(() => {
    if (query.trim().length < 3) {
      setScrollbackHits([])
      return
    }
    const t = setTimeout(() => {
      invoke<{ surface_id: string; line: string }[]>('search_scrollback', { projectId: store.activeId, query })
        .then(setScrollbackHits)
        .catch(() => setScrollbackHits([]))
    }, 250)
    return () => clearTimeout(t)
  }, [query, store.activeId])

  const centerOnBlock = (blockId: string) => {
    const block = board.blocks.find((b) => b.id === blockId)
    if (!block) return
    store.selectBlock(blockId)
    store.bringToFront(blockId)
    const z = board.camera.z
    store.setCamera({
      x: window.innerWidth / 2 - (block.x + block.w / 2) * z,
      y: window.innerHeight / 2 - (block.y + block.h / 2) * z,
      z,
    })
  }

  const items = useMemo<Item[]>(() => {
    const list: Item[] = []
    for (const path of files) {
      list.push({ key: `file:${path}`, kind: 'archivo', label: path.split('/').pop() || path, sub: path, action: onClose })
    }
    for (const block of board.blocks) {
      list.push({
        key: `block:${block.id}`,
        kind: 'bloque',
        label: block.title,
        sub: block.type,
        action: () => {
          centerOnBlock(block.id)
          onClose()
        },
      })
    }
    for (const project of store.projects) {
      list.push({
        key: `project:${project.id}`,
        kind: 'proyecto',
        label: project.name,
        sub: project.repoPath,
        action: () => {
          store.setActive(project.id)
          onClose()
        },
      })
    }
    for (const type of VIRE_BLOCK_TYPES) {
      list.push({
        key: `command:${type}`,
        kind: 'comando',
        label: `Nuevo bloque: ${nameByType[type]}`,
        action: () => {
          const z = board.camera.z
          const worldX = (window.innerWidth / 2 - board.camera.x) / z - 160
          const worldY = (window.innerHeight / 2 - board.camera.y) / z - 120
          const id = store.addBlock(type, worldX, worldY)
          centerOnBlock(id)
          onClose()
        },
      })
    }
    for (const hit of scrollbackHits) {
      list.push({
        key: `scrollback:${hit.surface_id}:${hit.line}`,
        kind: 'terminal',
        label: hit.line.trim().slice(0, 120),
        sub: hit.surface_id,
        action: onClose,
      })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, board.blocks, store.projects, scrollbackHits])

  const filtered = useMemo(() => {
    if (!query.trim()) return items.slice(0, 40)
    return items
      .map((item) => ({ item, score: fuzzyScore(query, `${item.label} ${item.sub ?? ''}`) }))
      .filter((r): r is { item: Item; score: number } => r.score !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map((r) => r.item)
  }, [items, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const onKeyDown: React.KeyboardEventHandler = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      filtered[activeIndex]?.action()
    }
  }

  return (
    <div style={overlayStyle} onPointerDown={onClose}>
      <div style={paletteStyle} onPointerDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="v-focus-ring"
          aria-label="Búsqueda rápida"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Archivos, bloques, proyectos, comandos…"
          style={inputStyle}
        />
        <div style={{ overflowY: 'auto', padding: 6 }}>
          {filtered.length === 0 && (
            <div style={{ padding: 12, color: 'var(--color-text-muted)', fontSize: 12 }}>Sin resultados</div>
          )}
          {filtered.map((item, i) => (
            <div
              key={item.key}
              onClick={item.action}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                padding: '7px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                background: i === activeIndex ? 'rgba(255,255,255,0.08)' : 'transparent',
              }}
            >
              <span style={{ color: 'var(--color-text-primary)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.label}
              </span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 11, flexShrink: 0 }}>{kindLabel[item.kind]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
