import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, Plus } from 'lucide-react'
import Sidebar from './Sidebar'
import Header from './Header'
import NewClientDialog from './NewClientDialog'
import { apiClient } from '../../lib/apiClient'
import { useCompanyId } from '../../context/CompanyContext'

export default function AppShell() {
  const companyId = useCompanyId()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [newClientOpen, setNewClientOpen] = useState(false)

  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => apiClient.get('/api/companies'),
    retry: 1,
    meta: { suppressErrorToast: true },
  })

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

  const hasNoCompanies = !companiesLoading && companies.length === 0
  const noCompanySelected = !companiesLoading && companies.length > 0 && companyId == null

  let mainContent = <Outlet />
  if (hasNoCompanies) {
    mainContent = (
      <div className="h-full flex flex-col items-center justify-center text-center px-6">
        <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mb-4">
          <Building2 className="w-6 h-6 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">Add your first client</h2>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          Analyses appear here once a client company is created and its data is uploaded.
        </p>
        <button
          type="button"
          onClick={() => setNewClientOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add client
        </button>
      </div>
    )
  } else if (noCompanySelected) {
    mainContent = (
      <div className="h-full flex flex-col items-center justify-center text-center px-6">
        <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mb-4">
          <Building2 className="w-6 h-6 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">Select a client</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Choose a client from the company switcher in the top bar to view their analyses.
        </p>
      </div>
    )
  }

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
          {mainContent}
        </main>
      </div>
      <NewClientDialog open={newClientOpen} onClose={() => setNewClientOpen(false)} />
    </div>
  )
}
