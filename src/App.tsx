import { Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'
import './design-tokens.css'

function App() {
  return (
    <div className="vire-canvas">
      <Tldraw
        persistenceKey="vire"
      />
    </div>
  )
}

export default App
