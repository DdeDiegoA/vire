import { useEffect } from 'react'
import { useVireStore } from '../../store/useVireStore'

export interface PomodoroData {
  durationSec: number
  remainingSec: number
  running: boolean
}

export const defaultPomodoroData: PomodoroData = {
  durationSec: 1500,
  remainingSec: 1500,
  running: false,
}

/** Pure tick function — one second of countdown. Exported for the runnable check. */
export function nextTick(data: PomodoroData): PomodoroData {
  if (data.remainingSec <= 0) return { ...data, remainingSec: 0, running: false }
  const remainingSec = data.remainingSec - 1
  return { ...data, remainingSec, running: remainingSec > 0 }
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function PomodoroBlock({ id, data }: { id: string; data: PomodoroData }) {
  const updateBlockData = useVireStore((s) => s.updateBlockData)

  useEffect(() => {
    if (!data.running) return
    const interval = setInterval(() => {
      const board = useVireStore.getState().boardsByProject[useVireStore.getState().activeId]
      const current = board?.blocks.find((b) => b.id === id)?.data as PomodoroData | undefined
      if (current) updateBlockData(id, nextTick(current))
    }, 1000)
    return () => clearInterval(interval)
  }, [data.running, id, updateBlockData])

  const update = (partial: Partial<PomodoroData>) => updateBlockData(id, { ...data, ...partial })

  const btnStyle: React.CSSProperties = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-divider)',
    color: 'var(--color-text-primary)',
    borderRadius: 'var(--radius-control)',
    padding: '4px 10px',
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
    fontSize: 12,
  }

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 16 }}
    >
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 36, color: 'var(--color-text-primary)' }}>
        {formatTime(data.remainingSec)}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={btnStyle} onClick={() => update({ running: true })} disabled={data.running || data.remainingSec === 0}>
          Start
        </button>
        <button style={btnStyle} onClick={() => update({ running: false })} disabled={!data.running}>
          Pause
        </button>
        <button
          style={btnStyle}
          onClick={() => update({ remainingSec: data.durationSec, running: false })}
        >
          Reset
        </button>
      </div>
    </div>
  )
}
