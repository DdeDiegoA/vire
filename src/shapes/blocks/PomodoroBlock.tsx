import { useEffect, useState } from 'react'
import { useVireStore } from '../../store/useVireStore'
import { remainingMsAt, type PomodoroData } from '../blockTypes'

function formatMs(ms: number): string {
  const totalDeci = Math.floor(ms / 100)
  const m = Math.floor(totalDeci / 600)
  const s = Math.floor(totalDeci / 10) % 60
  const d = totalDeci % 10
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${d}`
}

const R = 46
const CIRC = 2 * Math.PI * R

const btnStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.04)',
  border: '0.5px solid var(--glass-block-border)',
  color: '#999',
  borderRadius: 6,
  padding: '4px 14px',
  cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
  fontSize: 'clamp(10px, 2.8cqw, 12px)',
  fontWeight: 500,
}

export function PomodoroBlock({ id, data }: { id: string; data: PomodoroData }) {
  const updateBlockData = useVireStore((s) => s.updateBlockData)
  const [nowMs, setNowMs] = useState(() => remainingMsAt(data, Date.now()))

  useEffect(() => {
    setNowMs(remainingMsAt(data, Date.now()))
    if (!data.running) return
    let raf: number
    const tick = () => {
      const now = Date.now()
      const remaining = remainingMsAt(data, now)
      setNowMs(remaining)
      if (remaining <= 0) {
        updateBlockData(id, { ...data, running: false, remainingSec: 0, endAt: null })
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // ponytail: only re-run when running/endAt changes — including remainingSec/id
    // would restart the animation loop on every tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.running, data.endAt])

  const start = () => {
    if (data.remainingSec <= 0) return
    updateBlockData(id, { ...data, running: true, endAt: Date.now() + data.remainingSec * 1000 })
  }

  const pause = () => {
    if (!data.running || data.endAt === null) return
    const remainingSec = Math.max(0, Math.round((data.endAt - Date.now()) / 1000))
    updateBlockData(id, { ...data, running: false, remainingSec, endAt: null })
  }

  const reset = () => updateBlockData(id, { ...data, running: false, remainingSec: data.durationSec, endAt: null })

  const progress = data.durationSec > 0 ? nowMs / (data.durationSec * 1000) : 0
  const offset = CIRC * (1 - Math.max(0, Math.min(1, progress)))

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 16 }}
    >
      <div style={{ position: 'relative', width: 'min(80cqw, 80cqh, 220px)', aspectRatio: '1', flexShrink: 0 }}>
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            style={{
              filter: data.running
                ? 'drop-shadow(0 0 6px rgba(231,197,154,.55))'
                : 'drop-shadow(0 0 3px rgba(231,197,154,.25))',
            }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 'clamp(16px, 11cqw, 32px)',
            color: 'var(--color-accent)',
            fontWeight: 500,
            letterSpacing: 1,
            textShadow: '0 0 16px rgba(231,197,154,.12)',
          }}
        >
          {formatMs(nowMs)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" className="v-focus-ring" style={btnStyle} onClick={start} disabled={data.running || data.remainingSec <= 0}>
          Start
        </button>
        <button type="button" className="v-focus-ring" style={btnStyle} onClick={pause} disabled={!data.running}>
          Pause
        </button>
        <button type="button" className="v-focus-ring" style={btnStyle} onClick={reset}>
          Reset
        </button>
      </div>
    </div>
  )
}
