import { useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import { Outlet, Navigate, useSearchParams } from 'react-router-dom'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { fmtM, cn } from '../../lib/utils'
import DemoSidebar from './DemoSidebar'
import ConversionModal from '../demo/ConversionModal'
import { DemoContext } from '../../context/DemoContext'
import { useCompany } from '../../context/CompanyContext'
import { Bell, Search, Share2, Check } from 'lucide-react'
import { usePageTitle } from '../../hooks/usePageTitle'
import { apiClient } from '../../lib/apiClient'
import { fetchDemoAccessStatus } from '../../lib/demoAccess'

const DEMO_COMPANY = { id: 1, name: 'ABC Company Inc' }

// ---------------------------------------------------------------------------
// Demo-specific header
// ---------------------------------------------------------------------------
function DemoHeader({ demoData, slug, personalized }) {
  // Prefer live-computed scores; fall back to the demo data payload when backend is unavailable
  const scorePlaceholder =
    demoData?.drs != null && demoData?.enterprise_value != null
      ? {
          drs: { base: demoData.drs.base, tier: demoData.drs.tier },
          enterprise_value: { midpoint: demoData.enterprise_value.midpoint },
        }
      : undefined

  const { data: liveScores } = useQuery({
    queryKey: ['analytics-scores', 1],
    queryFn: () => apiClient.get('/api/analytics/scores/1'),
    retry: false,
    staleTime: 120_000,
    placeholderData: scorePlaceholder,
    meta: { suppressErrorToast: true },
  })

  const drs  = liveScores?.drs?.base  ?? demoData?.drs?.base
  const tier = liveScores?.drs?.tier  ?? demoData?.drs?.tier
  const ev   = liveScores?.enterprise_value?.midpoint ?? demoData?.enterprise_value?.midpoint
  const companyName = demoData?.company?.name ?? 'Demo Company'

  const drsColor = drs == null ? 'text-muted-foreground'
    : drs >= 70 ? 'text-emerald-400'
    : drs >= 55 ? 'text-amber-400'
    : 'text-red-400'

  const [copied, setCopied] = useState(false)

  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [])

  return (
    <header className="h-14 border-b border-border bg-card/60 backdrop-blur-sm flex items-center justify-between px-4 flex-shrink-0">
      {/* Left — company badge + scores */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-card-foreground flex-shrink-0">
          <span
            style={{
              background: 'hsl(var(--warning))',
              color: 'hsl(var(--background))',
              fontWeight: 700,
              fontSize: 10,
              padding: '2px 7px',
              borderRadius: 4,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            DEMO
          </span>
          <span className="text-muted-foreground max-w-[160px] truncate">{companyName}</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap min-w-0">
          {drs != null && (
            <span className={cn('text-xs font-semibold', drsColor)}>
              {drs.toFixed(1)}/100
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

      {/* Right */}
      <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
        <button
          onClick={handleShare}
          title="Copy demo link"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors text-xs font-medium"
          style={{ color: copied ? 'hsl(var(--primary))' : 'hsl(var(--warning))' }}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Share'}
        </button>
        <button
          type="button"
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground w-48 min-h-[44px] hover:bg-muted/70"
        >
          <Search className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate text-left">Search pages…</span>
        </button>
        <button
          type="button"
          className="p-2.5 rounded-md hover:bg-muted/50 text-muted-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
          disabled
        >
          <Bell className="w-4 h-4 opacity-60" />
        </button>
        <div className="flex items-center gap-2 pl-2">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[11px] font-bold">
            D
          </div>
          <div>
            <p className="text-[11px] font-medium text-card-foreground leading-tight">Demo User</p>
            <p className="text-[11px] text-muted-foreground leading-tight">CEPA Advisor</p>
          </div>
        </div>
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
// DemoShell
// ---------------------------------------------------------------------------
export default function DemoShell({ slug = null }) {
  const [demoData, setDemoData] = useState(null)
  const [personalized, setPersonalized] = useState(null)
  const [spotsRemaining, setSpotsRemaining] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { setCompanyId } = useCompany()
  /** Generic /demo only: wait for access check; slug links skip the gate. */
  const [accessGate, setAccessGate] = useState(() => (slug ? 'ready' : 'checking'))

  useEffect(() => {
    if (slug) {
      setAccessGate('ready')
      return
    }
    let cancelled = false
    fetchDemoAccessStatus()
      .then((s) => {
        if (cancelled || !s) return
        if (s.granted) setAccessGate('ready')
        else setAccessGate('blocked')
      })
      .catch(() => {
        if (!cancelled) setAccessGate('blocked')
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  // Pre-seed company data so all demo pages see ABC Company Inc instead of an empty list
  useEffect(() => {
    queryClient.setQueryData(['companies'], [DEMO_COMPANY])
    queryClient.setQueryData(['company', 1], DEMO_COMPANY)
    setCompanyId(1)
  }, [queryClient, setCompanyId])

  /** Start heavy ABC (company 1) analytics before the outlet paints so Home/header share one request. */
  useLayoutEffect(() => {
    if (accessGate !== 'ready') return
    const demoStale = 120_000
    const quiet = { meta: { suppressErrorToast: true } }
    queryClient.prefetchQuery({
      queryKey: ['analytics-scores', 1],
      queryFn: () => apiClient.get('/api/analytics/scores/1'),
      staleTime: demoStale,
      ...quiet,
    })
    queryClient.prefetchQuery({
      queryKey: ['analytics-buyer-questions', 1],
      queryFn: () => apiClient.get('/api/analytics/buyer-questions/1'),
      staleTime: demoStale,
      ...quiet,
    })
    queryClient.prefetchQuery({
      queryKey: ['analytics-value-gap', 1],
      queryFn: () => apiClient.get('/api/analytics/value-gap/1'),
      staleTime: demoStale,
      ...quiet,
    })
    queryClient.prefetchQuery({
      queryKey: ['ingestion-jobs', 1],
      queryFn: () =>
        apiClient.get('/api/ingestion/jobs/1').then((d) => (Array.isArray(d) ? d : [])),
      staleTime: 60_000,
      ...quiet,
    })
    queryClient.prefetchQuery({
      queryKey: ['advisory-workflow', 1],
      queryFn: () => apiClient.get('/api/analytics/advisory-workflow/1'),
      staleTime: demoStale,
      ...quiet,
    })
    queryClient.prefetchQuery({
      queryKey: ['engagement-profile', 1],
      queryFn: () => apiClient.get('/api/analytics/engagement-profile/1').catch(() => null),
      staleTime: demoStale,
      ...quiet,
    })
    queryClient.prefetchQuery({
      queryKey: ['score-history', 1],
      queryFn: () => apiClient.get('/api/analytics/scores/1/history'),
      staleTime: demoStale,
      ...quiet,
    })
  }, [queryClient, accessGate])

  const basePrefix = slug ? `/demo/${slug}` : '/demo'

  // Page title
  const pageTitle = personalized
    ? `${personalized.recipient_name}'s Demo`
    : 'Live Demo'
  usePageTitle(pageTitle)

  useEffect(() => {
    if (!slug && accessGate !== 'ready') return

    // Handle ?ref=REFCODE on generic demo
    const refCode = searchParams.get('ref')
    if (refCode) {
      localStorage.setItem('demo_ref', refCode)
    }

    // Fetch data based on slug
    if (slug) {
      apiClient.get(`/api/demo/${slug}`)
        .then((d) => {
          if (d) {
            setDemoData(d.demo_data)
            setPersonalized(d.personalized)
            localStorage.setItem('demo_ref', slug)
          }
        })
        .catch(() => {})
    } else {
      apiClient.get('/api/demo/data')
        .then((d) => { if (d) setDemoData(d) })
        .catch(() => {})
    }

    apiClient.get('/api/spots-remaining')
      .then((d) => { if (d) setSpotsRemaining(d.spots_remaining) })
      .catch(() => {})
  }, [slug, searchParams, accessGate])

  // ---------------------------------------------------------------------------
  // Section tracking — called by DemoHome when sections enter viewport
  // ---------------------------------------------------------------------------
  const trackSection = useCallback((section) => {
    if (!slug) return  // Only track personalized links
    apiClient.post(`/api/demo/${slug}/track`, { section }).catch(() => {})
  }, [slug])

  const prefillEmail = personalized?.recipient_email ?? ''

  const openConversionModal = useCallback(() => setModalOpen(true), [])

  const demoCtx = useMemo(
    () => ({
      demoData,
      personalized,
      spotsRemaining,
      slug,
      trackSection,
      openConversionModal,
    }),
    [demoData, personalized, spotsRemaining, slug, trackSection, openConversionModal],
  )

  if (accessGate === 'checking') {
    return (
      <div className="dark flex h-screen items-center justify-center bg-background text-muted-foreground text-sm">
        Loading demo…
      </div>
    )
  }

  if (accessGate === 'blocked') {
    return <Navigate to="/request-demo" replace />
  }

  return (
    <DemoContext.Provider value={demoCtx}>
      <div className="dark flex h-screen overflow-hidden bg-background">
        {/* Sidebar — fixed full height */}
        <DemoSidebar basePrefix={basePrefix} />

        {/* Content column */}
        <div className="flex-1 flex flex-col overflow-hidden ml-56">
          {/* Personalized welcome banner */}
          {personalized && (
            <div className="bg-card border-b border-border px-4 py-2 flex items-center gap-2 flex-shrink-0">
              <span className="text-warning text-sm">👋</span>
              <p className="text-[12px] text-muted-foreground">
                Welcome,{' '}
                <strong className="text-card-foreground">{personalized.recipient_name}</strong>
                {personalized.recipient_firm && (
                  <> from <strong className="text-card-foreground">{personalized.recipient_firm}</strong></>
                )}
                {' '}— you're viewing a private demo prepared for you.
              </p>
            </div>
          )}

          {/* Header */}
          <DemoHeader demoData={demoData} slug={slug} personalized={personalized} />

          {/* Scrollable content */}
          <main className="flex-1 p-6 overflow-y-auto">
            <Outlet />
          </main>
        </div>

        <ConversionModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          prefillEmail={prefillEmail}
          slug={slug}
        />
      </div>
    </DemoContext.Provider>
  )
}
