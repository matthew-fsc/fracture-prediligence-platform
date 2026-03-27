import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell, Building2, ChevronDown, Search, LogOut, Settings } from 'lucide-react'
import { fmtM, cn } from '../../lib/utils'
import { useUser, useClerk } from '@clerk/clerk-react'
import { apiClient } from '../../lib/apiClient'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

// ---------------------------------------------------------------------------
// Plan badge
// ---------------------------------------------------------------------------
const PLAN_BADGE = {
  founding: { label: 'FOUNDING', bg: '#C9973A', color: '#0A1628' },
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
        className="flex items-center gap-2 rounded-lg hover:bg-muted/40 pr-1 py-0.5"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold">
            {initials}
          </div>
        )}
        <div className="text-left">
          <div className="flex items-center gap-1">
            <p className="text-[11px] font-medium text-card-foreground leading-tight">{displayName}</p>
            {sub?.tier && <PlanBadge tier={sub.tier} />}
          </div>
          <p className="text-[9px] text-muted-foreground leading-tight">CEPA Advisor</p>
        </div>
        <ChevronDown className={cn('w-3 h-3 text-muted-foreground transition-transform', open && 'rotate-180')} />
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
      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold">U</div>
      <div>
        <p className="text-[11px] font-medium text-card-foreground leading-tight">Advisor</p>
        <p className="text-[9px] text-muted-foreground leading-tight">CEPA Advisor</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// UserSection — switches between Clerk and static based on key presence
// ---------------------------------------------------------------------------
function UserSection() {
  const [sub, setSub] = useState(null)

  useEffect(() => {
    apiClient.get('/api/user/subscription')
      .then((d) => { if (d) setSub(d) })
      .catch(() => {})
  }, [])

  if (!PUBLISHABLE_KEY) return <StaticUserSection />
  return <ClerkUserSection sub={sub} />
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
export default function Header({ liveScores, companyId = 1 }) {
  const { data: companyRow } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => apiClient.get(`/api/companies/${companyId}`),
    enabled: Number.isFinite(companyId) && companyId > 0,
  })
  const companyName = companyRow?.name ?? `Company #${companyId}`

  const loading = liveScores === null
  const drs = liveScores?.drs?.base
  const ev  = liveScores?.enterprise_value?.midpoint ?? null
  const tier = liveScores?.drs?.tier ?? null

  const drsColor = drs == null ? 'text-muted-foreground'
    : drs >= 75 ? 'text-emerald-400'
    : drs >= 55 ? 'text-amber-400'
    : 'text-red-400'

  return (
    <header className="h-14 border-b border-border bg-card/60 backdrop-blur-sm flex items-center justify-between px-4 sticky top-0 z-40 flex-shrink-0">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted/50 transition-colors text-xs font-medium text-card-foreground">
          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="max-w-[140px] truncate">{companyName}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
        <span className={cn('text-xs font-semibold', drsColor)}>
          {loading ? '—' : `${Math.round(drs)}/100`}
          <span className="text-muted-foreground font-normal ml-1">Readiness{tier ? ` · ${tier}` : ''}</span>
        </span>
        {!loading && ev !== null && ev > 0
          ? <span className="text-xs font-semibold text-primary">{fmtM(ev)} EV</span>
          : !loading
          ? <span className="text-xs text-muted-foreground">—</span>
          : null
        }
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground w-48">
          <Search className="w-3.5 h-3.5" />
          <span>Search metrics, reports...</span>
        </div>
        <button className="relative p-1.5 rounded-md hover:bg-muted/50">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full flex items-center justify-center">
            3
          </span>
        </button>
        <UserSection />
      </div>
    </header>
  )
}
