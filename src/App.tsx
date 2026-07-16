import { useEffect, useState } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { confirm } from '@tauri-apps/plugin-dialog'
import './design-tokens.css'
import { VireTopbar } from './ui/VireTopbar'
import { VireToolbar } from './ui/VireToolbar'
import { QuickOpen } from './ui/QuickOpen'
import { VireCanvas } from './canvas/VireCanvas'
import { initWindowFocusTracking } from './store/windowFocus'

function App() {
  const [quickOpen, setQuickOpen] = useState(false)

  useEffect(() => {
    initWindowFocusTracking()
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setQuickOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    check()
      .then(async (update) => {
        if (!update) return
        const yes = await confirm(`¿Actualizar Vire a ${update.version}?`, { title: 'Vire' })
        if (!yes) return
        await update.downloadAndInstall()
        await relaunch()
      })
      .catch((err) => console.error('update check failed', err))
  }, [])

  return (
    <div className="vire-canvas">
      <VireTopbar />
      <VireCanvas />
      <VireToolbar />
      {quickOpen && <QuickOpen onClose={() => setQuickOpen(false)} />}
    </div>
  )
}

export default App
