import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Sidebar from './Sidebar'
import Header from './Header'
import { apiClient } from '../../lib/apiClient'
import { useCompanyId } from '../../context/CompanyContext'

export default function AppShell() {
  const companyId = useCompanyId()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const {
    data: liveScores = null,
    isPending: scoresPending,
    isError: scoresError,
    error: scoresQueryError,
    isFetching: scoresFetching,
  } = useQuery({
    queryKey: ['analytics-scores', companyId],
    queryFn: () => apiClient.get(`/api/analytics/scores/${companyId}`),
    enabled: companyId != null && Number.isFinite(companyId) && companyId > 0,
  })

  const scoresErrorMessage = scoresError && scoresQueryError ? scoresQueryError.message : null

  return (
    <div className="flex h-screen overflow-hidden bg-background dark">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground focus:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[60] bg-black/50 md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <Sidebar mobileOpen={mobileNavOpen} onNavigate={() => setMobileNavOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden md:ml-56">
        <Header
          liveScores={liveScores}
          scoresLoading={scoresPending || scoresFetching}
          scoresError={scoresErrorMessage}
          companyId={companyId}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main id="main-content" className="flex-1 p-4 md:p-6 overflow-y-auto" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
