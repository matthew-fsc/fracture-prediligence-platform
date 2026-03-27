import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { apiClient } from '../../lib/apiClient'

export default function AppShell() {
  const [liveScores, setLiveScores] = useState(null)

  useEffect(() => {
    apiClient.get('/api/analytics/scores/1')
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
