import './design-tokens.css'
import { VireTopbar } from './ui/VireTopbar'
import { VireToolbar } from './ui/VireToolbar'
import { VireCanvas } from './canvas/VireCanvas'

function App() {
  return (
    <div className="vire-canvas">
      <VireTopbar />
      <VireCanvas />
      <VireToolbar />
    </div>
  )
}

export default App
