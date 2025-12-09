import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Command } from '@tauri-apps/plugin-shell'
import { Sidebar } from '@/components/layout/Sidebar'
import { Dashboard, GitHub, JIRA, Notes, Settings, Summaries, Reports } from '@/pages'

function App() {
  const [serverStatus, setServerStatus] = useState<'starting' | 'running' | 'error'>('starting')

  useEffect(() => {
    let sidecarProcess: Awaited<ReturnType<typeof Command.prototype.spawn>> | null = null

    const startServer = async () => {
      try {
        // Start the sidecar server
        const command = Command.sidecar('binaries/werkday-server')
        sidecarProcess = await command.spawn()
        
        console.log('Sidecar started with PID:', sidecarProcess.pid)
        
        // Give it a moment to start
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Check health
        const response = await fetch('http://localhost:3001/health')
        await response.json()
        setServerStatus('running')
      } catch (error) {
        console.error('Failed to start server:', error)
        setServerStatus('error')
      }
    }

    startServer()

    return () => {
      // Cleanup: kill the sidecar when component unmounts
      if (sidecarProcess) {
        sidecarProcess.kill()
      }
    }
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
            <Route path="/summaries" element={<Summaries />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App
