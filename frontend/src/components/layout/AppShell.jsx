import { Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Sidebar from './Sidebar'
import Header from './Header'
import { apiClient } from '../../lib/apiClient'
import { useCompanyId } from '../../context/CompanyContext'

export default function AppShell() {
  const companyId = useCompanyId()

  const { data: liveScores = null } = useQuery({
    queryKey: ['analytics-scores', companyId],
    queryFn: () => apiClient.get(`/api/analytics/scores/${companyId}`),
  })

  return (
    <div className="flex h-screen overflow-hidden bg-background dark">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden ml-56">
        <Header liveScores={liveScores} companyId={companyId} />
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
