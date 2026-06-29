import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell, ChevronDown, Search, LogOut, Settings, Menu } from 'lucide-react'
import CompanySwitcher from './CompanySwitcher'
import CommandPalette from './CommandPalette'
import { fmtM, cn } from '../../lib/utils'
import { useUser, useClerk } from '@clerk/react'
import { apiClient } from '../../lib/apiClient'

const PUBLISHABLE_KEY = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim()

// ---------------------------------------------------------------------------
// Plan badge
// ---------------------------------------------------------------------------
const PLAN_BADGE = {
  founding: { label: 'FOUNDING', bg: '#17a773', color: '#fff' },
  pro:      { label: 'PRO',      bg: '#4ABEA4', color: '#0A1628' },
  team:     { label: 'TEAM',     bg: '#3B82F6', color: '#fff' },
}

function PlanBadge({ tier }) {
  const style = PLAN_BADGE[tier?.toLowerCase()] ?? null
  if (!style) return null
  return (
    <span
      style={{
        background: style.bg, color: style.color,
        fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 9,
        padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em', textTransform: 'uppercase',
      }}
    >
      {style.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// ClerkUserSection — only mounted when ClerkProvider is active
// ---------------------------------------------------------------------------
function ClerkUserSection({ sub }) {
  const { user } = useUser()
  const { signOut } = useClerk()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    function onDoc(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'U'
    : 'U'
  const displayName = user?.firstName ?? 'Advisor'
  const imageUrl = user?.imageUrl

  return (
    <div className="relative flex items-center gap-2 pl-2" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg hover:bg-muted/40 pr-1 py-0.5 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[11px] font-bold">
            {initials}
          </div>
        )}
        <div className="text-left hidden sm:block">
          <div className="flex items-center gap-1">
            <p className="text-[11px] font-medium text-card-foreground leading-tight">{displayName}</p>
            {sub?.tier && <PlanBadge tier={sub.tier} />}
          </div>
          <p className="text-[11px] text-muted-foreground leading-tight">CEPA Advisor</p>
        </div>
        <ChevronDown className={cn('w-3 h-3 text-muted-foreground transition-transform hidden sm:block', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 min-w-[180px] rounded-lg border border-border bg-card shadow-lg py-1 z-50"
        >
          <Link
            to="/settings"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-xs text-card-foreground hover:bg-muted/60"
            onClick={() => setOpen(false)}
          >
            <Settings className="w-3.5 h-3.5 text-muted-foreground" />
            Account settings
          </Link>
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-card-foreground hover:bg-muted/60 text-left"
            onClick={() => { setOpen(false); signOut() }}
          >
            <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Static fallback user section (no Clerk)
// ---------------------------------------------------------------------------
function StaticUserSection() {
  return (
    <div className="flex items-center gap-2 pl-2">
      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[11px] font-bold">U</div>
      <div className="hidden sm:block">
        <p className="text-[11px] font-medium text-card-foreground leading-tight">Advisor</p>
        <p className="text-[11px] text-muted-foreground leading-tight">CEPA Advisor</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// UserSection — switches between Clerk and static based on key presence
// ---------------------------------------------------------------------------
function UserSection() {
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => apiClient.get('/api/user/subscription'),
    enabled: !!PUBLISHABLE_KEY,
    retry: false,
    meta: { suppressErrorToast: true },
  })

  const sub = meQuery.data

  if (!PUBLISHABLE_KEY) return <StaticUserSection />
  return <ClerkUserSection sub={sub} />
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
export default function Header({
  liveScores,
  scoresLoading = false,
  scoresError = null,
  companyId = null,
  onOpenMobileNav,
}) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const { data: companyRow } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => apiClient.get(`/api/companies/${companyId}`),
    enabled: companyId != null && Number.isFinite(companyId) && companyId > 0,
  })
  const companyName =
    companyRow?.name ?? (companyId != null ? `Company #${companyId}` : 'Add a client…')

  const hasData = liveScores?.has_data === true
  const drs = hasData ? (liveScores?.drs?.base ?? null) : null
  const ev = hasData ? (liveScores?.enterprise_value?.midpoint ?? null) : null
  const tier = hasData ? (liveScores?.drs?.tier ?? null) : null

  const hasScoreData = hasData && liveScores != null && (drs != null || (ev != null && ev > 0))

  const drsColor = drs == null
    ? 'text-muted-foreground'
    : drs >= 70
      ? 'text-emerald-400'
      : drs >= 55
        ? 'text-amber-400'
        : 'text-red-400'

  return (
    <>
      <header className="h-14 border-b border-border bg-card/60 backdrop-blur-sm flex items-center justify-between px-2 md:px-4 sticky top-0 z-40 flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          <button
            type="button"
            className="md:hidden p-2.5 rounded-lg border border-border hover:bg-muted/50 text-card-foreground min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Open navigation menu"
            onClick={() => onOpenMobileNav?.()}
          >
            <Menu className="w-5 h-5" />
          </button>
          <CompanySwitcher displayName={companyName} />
          <div className="hidden sm:flex items-center gap-1 sm:gap-2 flex-wrap min-w-0 max-w-[min(100%,42rem)]">
            {scoresError && (
              <span
                className="text-xs text-amber-400 max-w-[140px] truncate"
                title={scoresError}
                role="status"
              >
                Metrics unavailable
              </span>
            )}
            {!scoresError && scoresLoading && (
              <span className="text-xs text-muted-foreground animate-pulse" role="status">
                Loading…
              </span>
            )}
            {!scoresError && !scoresLoading && hasScoreData && (
              <>
                <span className={cn('text-xs font-semibold', drsColor)}>
                  {drs != null ? `${drs.toFixed(1)}/100` : '—'}
                  <span className="text-muted-foreground font-normal ml-1">
                    Readiness{tier ? ` · ${tier}` : ''}
                  </span>
                </span>
                {ev != null && ev > 0 ? (
                  <span className="text-xs font-semibold text-primary">{fmtM(ev)} EV</span>
                ) : (
                  <span className="text-xs text-muted-foreground">No EV yet</span>
                )}
              </>
            )}
            {!scoresError && !scoresLoading && !hasScoreData && (
              <span className="text-xs text-muted-foreground max-w-[200px]" role="status">
                No score yet — upload data in Data Sources
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground w-48 min-h-[44px] hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Open command palette to jump to a page"
          >
            <Search className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate text-left">Search pages…</span>
          </button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="sm:hidden p-2.5 rounded-lg border border-border hover:bg-muted/50 text-muted-foreground min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Open command palette"
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="p-2.5 rounded-md hover:bg-muted/50 text-muted-foreground min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Notifications"
            title="Notifications (coming soon)"
            disabled
          >
            <Bell className="w-4 h-4 text-muted-foreground opacity-60" />
          </button>
          <UserSection />
        </div>
      </header>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  )
}
