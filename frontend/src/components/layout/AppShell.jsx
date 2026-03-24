import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

export default function AppShell() {
  const [liveScores, setLiveScores] = useState(null)

  useEffect(() => {
    fetch('/api/analytics/scores/1')
      .then(r => r.ok ? r.json() : null)
      .then(d => setLiveScores(d))
      .catch(() => {})
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-background dark">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden ml-56">
        <Header liveScores={liveScores} />
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
