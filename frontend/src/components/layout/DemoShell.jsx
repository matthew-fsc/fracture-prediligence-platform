import { useState, useEffect, useCallback, useMemo } from 'react'
import { Outlet, useSearchParams, Link } from 'react-router-dom'
import DemoSidebar from './DemoSidebar'
import ConversionModal from '../demo/ConversionModal'
import { DemoContext } from '../../context/DemoContext'
import { Bell, Search, Share2, Check, ArrowLeft } from 'lucide-react'
import { usePageTitle } from '../../hooks/usePageTitle'
import { apiClient } from '../../lib/apiClient'

// ---------------------------------------------------------------------------
// Demo-specific header
// ---------------------------------------------------------------------------
function DemoHeader({ demoData, slug, personalized }) {
  const drs = demoData?.drs?.base
  const tier = demoData?.drs?.tier
  const ev = demoData?.enterprise_value?.midpoint
  const companyName = demoData?.company?.name ?? 'Demo Company'
  const [copied, setCopied] = useState(false)

  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [])

  return (
    <header className="h-14 border-b border-border bg-card/60 backdrop-blur-sm flex items-center justify-between px-4 flex-shrink-0">
      {/* Left */}
      <div className="flex items-center gap-3">
        <Link
          to="/Home"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Dashboard
        </Link>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-card-foreground">
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
        {drs != null && (
          <span className="text-xs text-muted-foreground font-medium">
            {drs}/100 Readiness{tier ? ` · ${tier}` : ''}
          </span>
        )}
        {ev != null && (
          <span className="text-xs font-semibold text-primary">
            ${(ev / 1_000_000).toFixed(1)}M EV
          </span>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Share button */}
        <button
          onClick={handleShare}
          title="Copy demo link"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors text-xs font-medium"
          style={{ color: copied ? 'hsl(var(--primary))' : 'hsl(var(--warning))' }}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Share'}
        </button>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground w-48">
          <Search className="w-3.5 h-3.5" />
          <span>Search metrics, reports...</span>
        </div>
        <button className="relative p-1.5 rounded-md hover:bg-muted/50">
          <Bell className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-2 pl-2">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold">
            D
          </div>
          <div>
            <p className="text-[11px] font-medium text-card-foreground leading-tight">Demo User</p>
            <p className="text-[9px] text-muted-foreground leading-tight">CEPA Advisor</p>
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

  const basePrefix = slug ? `/demo/${slug}` : '/demo'

  // Page title
  const pageTitle = personalized
    ? `${personalized.recipient_name}'s Demo`
    : 'Live Demo'
  usePageTitle(pageTitle)

  useEffect(() => {
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
  }, [slug, searchParams])

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
