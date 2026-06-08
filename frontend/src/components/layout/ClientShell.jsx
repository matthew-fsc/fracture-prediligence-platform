/**
 * ClientShell — authenticated layout wrapper for the business-owner (CLIENT) portal.
 *
 * Sets up the company context from the client's linked company, renders
 * ClientSidebar + ClientHeader + scrollable content area.
 */

import { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell, Menu, LogOut } from 'lucide-react'
import { useUser, useClerk } from '@clerk/react'
import ClientSidebar from './ClientSidebar'
import { useUserRole } from '../../context/UserRoleContext'
import { useCompany } from '../../context/CompanyContext'
import { apiClient } from '../../lib/apiClient'
import { fmtM, cn } from '../../lib/utils'

const HAS_CLERK = Boolean((import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim())

// ---------------------------------------------------------------------------
// Client header
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
      {/* Left — mobile menu + company/scores */}
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

      {/* Right — notifications + user */}
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
// ClientShell
// ---------------------------------------------------------------------------
export default function ClientShell() {
  const navigate = useNavigate()
  const { clientCompany, isClient, loading: roleLoading } = useUserRole()
  const { setCompanyId } = useCompany()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Sync the company context with the client's linked company
  useEffect(() => {
    if (clientCompany?.id) {
      setCompanyId(clientCompany.id)
    }
  }, [clientCompany, setCompanyId])

  // Guard: if role has loaded and user is not a client, redirect to advisor home
  useEffect(() => {
    if (roleLoading) return
    if (!isClient) navigate('/Home', { replace: true })
  }, [roleLoading, isClient, navigate])

  const companyId = clientCompany?.id

  const { data: liveScores } = useQuery({
    queryKey: ['analytics-scores', companyId],
    queryFn: () => apiClient.get(`/api/analytics/scores/${companyId}`),
    enabled: companyId != null,
    staleTime: 60_000,
    meta: { suppressErrorToast: true },
  })

  if (roleLoading) {
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

  if (!clientCompany) {
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
      <ClientSidebar mobileOpen={mobileNavOpen} onNavigate={() => setMobileNavOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden md:ml-56">
        <ClientHeader
          companyName={clientCompany.name}
          liveScores={liveScores}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main id="main-content" className="flex-1 p-4 md:p-6 overflow-y-auto" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
