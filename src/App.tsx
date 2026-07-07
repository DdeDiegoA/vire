import { useEffect } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import './design-tokens.css'
import { VireTopbar } from './ui/VireTopbar'
import { VireToolbar } from './ui/VireToolbar'
import { VireCanvas } from './canvas/VireCanvas'

function App() {
  useEffect(() => {
    check()
      .then((update) => {
        if (!update) return
        return update.downloadAndInstall().then(() => relaunch())
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
