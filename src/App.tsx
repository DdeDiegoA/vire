import { useEffect } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { confirm } from '@tauri-apps/plugin-dialog'
import './design-tokens.css'
import { VireTopbar } from './ui/VireTopbar'
import { VireToolbar } from './ui/VireToolbar'
import { VireCanvas } from './canvas/VireCanvas'

function App() {
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
    </div>
  )
}

export default App
