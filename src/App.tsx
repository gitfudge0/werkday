import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { Dashboard, GitHub, JIRA, Notes, Settings, Summaries } from '@/pages'

function App() {
  const [serverStatus, setServerStatus] = useState<'starting' | 'running' | 'error'>('starting')

  useEffect(() => {
    const checkServer = async () => {
      // Helper to check if server is healthy
      const isServerHealthy = async (): Promise<boolean> => {
        try {
          const response = await fetch('http://localhost:3001/health')
          return response.ok
        } catch {
          return false
        }
      }

      // Check if server is already running
      if (await isServerHealthy()) {
        setServerStatus('running')
        return
      }

      // Try to start sidecar if in Tauri environment
      if (window.__TAURI__) {
        try {
          const { Command } = await import('@tauri-apps/plugin-shell')
          const command = Command.sidecar('binaries/werkday-server')
          await command.spawn()
          await new Promise(resolve => setTimeout(resolve, 1500))
        } catch (error) {
          console.error('Failed to start sidecar:', error)
        }
      }

      // Retry checking server health (works for both dev and Tauri)
      for (let i = 0; i < 10; i++) {
        if (await isServerHealthy()) {
          setServerStatus('running')
          return
        }
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      setServerStatus('error')
    }

    checkServer()
  }, [])

  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Routes>
            <Route path="/" element={<Dashboard serverStatus={serverStatus} />} />
            <Route path="/github" element={<GitHub />} />
            <Route path="/jira" element={<JIRA />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/reports" element={<Summaries />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App
