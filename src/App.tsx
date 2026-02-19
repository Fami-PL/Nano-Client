import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import Mods from './pages/Mods'
import Settings from './pages/Settings'
import { useStore } from './store/useStore'

function App() {
  const { toast } = useStore()

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/mods" element={<Mods />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  )
}

export default App
