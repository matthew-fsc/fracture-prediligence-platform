import { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, Plus, Bell, Menu, LogOut } from 'lucide-react'
import { useUser, useClerk } from '@clerk/react'
import Sidebar from './Sidebar'
import Header from './Header'
import NewClientDialog from './NewClientDialog'
import { apiClient } from '../../lib/apiClient'
import { useCompanyId, useCompany } from '../../context/CompanyContext'
import { useUserRole } from '../../context/UserRoleContext'
import { fmtM, cn } from '../../lib/utils'

const HAS_CLERK = Boolean((import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim())

// ---------------------------------------------------------------------------
// Client header (rendered inside AppShell when role === CLIENT)
// ---------------------------------------------------------------------------
function ClientHeader({ companyName, liveScores, onOpenMobileNav }) {
  const { user } = HAS_CLERK ? useUser() : { user: null }
  const { signOut } = HAS_CLERK ? useClerk() : { signOut: null }

  const displayName = user?.firstName ?? user?.username ?? 'Owner'
  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'O'
    : 'O'
  const imageUrl = user?.imageUrl

  const hasData = liveScores?.has_data === true
  const drs = hasData ? liveScores?.drs?.base : null
  const ev = hasData ? liveScores?.enterprise_value?.midpoint : null
  const tier = hasData ? liveScores?.drs?.tier : null

  const drsColor = drs == null
    ? 'text-muted-foreground'
    : drs >= 70 ? 'text-emerald-400'
    : drs >= 55 ? 'text-amber-400'
    : 'text-red-400'

  return (
    <header className="h-14 border-b border-border bg-card/60 backdrop-blur-sm flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          type="button"
          className="md:hidden p-2 rounded-md hover:bg-muted/50 text-muted-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
          onClick={onOpenMobileNav}
          aria-label="Open menu"
        >
          <Menu className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-border text-xs font-medium text-card-foreground flex-shrink-0">
          <span
            style={{
              background: 'hsl(var(--primary))',
              color: 'hsl(var(--background))',
              fontWeight: 700,
              fontSize: 9,
              padding: '2px 6px',
              borderRadius: 3,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            OWNER
          </span>
          <span className="text-muted-foreground max-w-[160px] truncate">{companyName}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {drs != null && (
            <span className={cn('text-xs font-semibold', drsColor)}>
              {Math.round(drs)}/100
              <span className="text-muted-foreground font-normal ml-1">
                Readiness{tier ? ` · ${tier}` : ''}
              </span>
            </span>
          )}
          {ev != null && ev > 0 && (
            <span className="text-xs font-semibold text-primary">{fmtM(ev)} EV</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
        <button
          type="button"
          className="p-2.5 rounded-md hover:bg-muted/50 text-muted-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
          disabled
        >
          <Bell className="w-4 h-4 opacity-60" />
        </button>

        <div className="flex items-center gap-2 pl-2">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[11px] font-bold">
              {initials}
            </div>
          )}
          <div className="hidden sm:block">
            <p className="text-[11px] font-medium text-card-foreground leading-tight">{displayName}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Business Owner</p>
          </div>
        </div>

        {HAS_CLERK && signOut && (
          <button
            type="button"
            onClick={() => signOut()}
            className="p-2 rounded-md hover:bg-muted/50 text-muted-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
// AppShell — handles both ADVISOR and CLIENT layouts
// ---------------------------------------------------------------------------
export default function AppShell() {
  const navigate = useNavigate()
  const { isClient, clientCompany, loading: roleLoading } = useUserRole()
  const { setCompanyId } = useCompany()
  const companyId = useCompanyId()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [newClientOpen, setNewClientOpen] = useState(false)

  // CLIENT: sync company context from linked client company
  useEffect(() => {
    if (isClient && clientCompany?.id) {
      setCompanyId(clientCompany.id)
    }
  }, [isClient, clientCompany, setCompanyId])

  // CLIENT guard: if role loaded and user is not a client, redirect to advisor home
  useEffect(() => {
    if (isClient && !roleLoading && !clientCompany) return // handled below
  }, [isClient, roleLoading, clientCompany])

  // ── Advisor: list of companies ───────────────────────────────────────────
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => apiClient.get('/api/companies'),
    retry: 1,
    meta: { suppressErrorToast: true },
    enabled: !isClient,
  })

  // ── Scores (used by both advisor header and client header) ───────────────
  const effectiveCompanyId = isClient ? clientCompany?.id : companyId
  const {
    data: liveScores = null,
    isPending: scoresPending,
    isError: scoresError,
    error: scoresQueryError,
    isFetching: scoresFetching,
  } = useQuery({
    queryKey: ['analytics-scores', effectiveCompanyId],
    queryFn: () => apiClient.get(`/api/analytics/scores/${effectiveCompanyId}`),
    enabled: effectiveCompanyId != null && Number.isFinite(effectiveCompanyId) && effectiveCompanyId > 0,
    staleTime: isClient ? 60_000 : undefined,
    meta: isClient ? { suppressErrorToast: true } : undefined,
  })

  // ── Loading spinner (client role resolution) ─────────────────────────────
  if (isClient && roleLoading) {
    return (
      <div className="dark flex h-screen items-center justify-center bg-background">
        <div
          className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent"
          style={{ animation: 'spin 0.8s linear infinite' }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Client: not yet linked to a company ──────────────────────────────────
  if (isClient && !clientCompany) {
    return (
      <div className="dark flex h-screen items-center justify-center bg-background flex-col gap-4 p-8 text-center">
        <div className="text-amber-400 text-4xl mb-2">⏳</div>
        <h2 className="text-lg font-semibold text-card-foreground">Waiting for your advisor</h2>
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
          Your account isn't linked to a company yet. Your advisor needs to send you an invite link.
          Check your email or contact them directly.
        </p>
        <p className="text-xs text-muted-foreground">
          Already have an invite link? Open it in your browser to get connected.
        </p>
      </div>
    )
  }

  // ── Advisor: empty state ─────────────────────────────────────────────────
  const scoresErrorMessage = scoresError && scoresQueryError ? scoresQueryError.message : null
  const hasNoCompanies = !isClient && !companiesLoading && companies.length === 0
  const noCompanySelected = !isClient && !companiesLoading && companies.length > 0 && companyId == null

  let mainContent = <Outlet />
  if (!isClient) {
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
        {isClient ? (
          <ClientHeader
            companyName={clientCompany?.name}
            liveScores={liveScores}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />
        ) : (
          <Header
            liveScores={liveScores}
            scoresLoading={scoresPending || scoresFetching}
            scoresError={scoresErrorMessage}
            companyId={companyId}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />
        )}
        <main id="main-content" className="flex-1 p-4 md:p-6 overflow-y-auto" tabIndex={-1}>
          {mainContent}
        </main>
      </div>
      {!isClient && (
        <NewClientDialog open={newClientOpen} onClose={() => setNewClientOpen(false)} />
      )}
    </div>
  )
}
