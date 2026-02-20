import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import Mods from './pages/Mods'
import Settings from './pages/Settings'
import Logs from './pages/Logs'
import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { useStore, ActiveInstance } from './store/useStore'

function App() {
  const { toast, downloadProgress, launchStatus, setActiveInstances } = useStore()

  useEffect(() => {
    const fetchInstances = async () => {
      try {
        const instances = await invoke<ActiveInstance[]>('get_active_instances')
        setActiveInstances(instances)
      } catch (e) {
        console.error('Failed to fetch instances:', e)
      }
    }

    fetchInstances()

    const unlisten = listen('instances-changed', () => {
      fetchInstances()
    })

    return () => {
      unlisten.then(u => u())
    }
  }, [])

  const showProgress = downloadProgress !== null || (launchStatus !== 'idle' && launchStatus !== 'error' && launchStatus !== 'running')

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/mods" element={<Mods />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/logs" element={<Logs />} />
        </Routes>
      </main>

      {/* Mini Bottom Progress Bar */}
      <div className={`bottom-progress-container${showProgress ? ' visible' : ''}`}>
        <div
          className={`bottom-progress-fill${(launchStatus !== 'downloading' && showProgress) ? ' animated' : ''}`}
          style={{
            width: downloadProgress ? `${downloadProgress.percentage}%` : (showProgress ? '50%' : '0%')
          }}
        />
      </div>

      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  )
}

export default App
