import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import DemoBanner from '../demo/DemoBanner'
import ConversionModal from '../demo/ConversionModal'
import { DemoContext } from '../../context/DemoContext'
import { Bell, Search } from 'lucide-react'

// ---------------------------------------------------------------------------
// Demo-specific header (no company selector, shows DEMO badge)
// ---------------------------------------------------------------------------
function DemoHeader({ demoData }) {
  const drs = demoData?.drs?.base
  const ev = demoData?.enterprise_value?.midpoint

  return (
    <header className="h-14 border-b border-border bg-card/60 backdrop-blur-sm flex items-center justify-between px-4 sticky top-0 z-40 flex-shrink-0">
      {/* Left */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-card-foreground">
          <span
            style={{
              background: '#C9973A',
              color: '#0A1628',
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
          <span className="text-muted-foreground max-w-[140px] truncate">Lakeside HVAC Services</span>
        </div>
        {drs != null && (
          <span className="text-xs text-muted-foreground font-medium">{drs}/100 Readiness</span>
        )}
        {ev != null && (
          <span className="text-xs font-semibold text-primary">
            ${(ev / 1_000_000).toFixed(2)}M EV
          </span>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
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

  useEffect(() => {
    // If there's a slug, fetch personalized; otherwise fetch generic demo data
    if (slug) {
      fetch(`/api/demo/${slug}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (d) {
            setDemoData(d.demo_data)
            setPersonalized(d.personalized)
            // Store ref slug for signup tracking
            localStorage.setItem('demo_ref', slug)
          }
        })
        .catch(() => {})
    } else {
      fetch('/api/demo/data')
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d) setDemoData(d) })
        .catch(() => {})
    }

    fetch('/api/spots-remaining')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setSpotsRemaining(d.spots_remaining) })
      .catch(() => {})
  }, [slug])

  const prefillEmail = personalized?.recipient_email ?? ''

  return (
    <DemoContext.Provider value={{ demoData, personalized, spotsRemaining }}>
      <div className="dark">
        {/* Personalized welcome banner (shown above gold banner when slug present) */}
        {personalized && (
          <div
            style={{
              background: '#0F2040',
              borderBottom: '1px solid #1E3A5F',
              padding: '8px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              position: 'sticky',
              top: 0,
              zIndex: 70,
            }}
          >
            <span style={{ color: '#C9973A', fontSize: 14 }}>👋</span>
            <p
              style={{
                margin: 0,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                color: '#8A9BB0',
              }}
            >
              Welcome,{' '}
              <strong style={{ color: '#F0EDE8' }}>{personalized.recipient_name}</strong>
              {personalized.recipient_firm
                ? <> from <strong style={{ color: '#F0EDE8' }}>{personalized.recipient_firm}</strong></>
                : ''
              }
              {' '}— you're viewing a private demo prepared for you.
            </p>
          </div>
        )}

        {/* Gold spots banner */}
        <DemoBanner
          onClaim={() => setModalOpen(true)}
          spotsRemaining={spotsRemaining}
        />

        <div className="min-h-screen bg-background flex">
          <Sidebar />
          <div className="flex-1 flex flex-col ml-56">
            <DemoHeader demoData={demoData} />
            <main className="flex-1 p-6 overflow-auto">
              <Outlet />
            </main>
          </div>
        </div>

        <ConversionModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          prefillEmail={prefillEmail}
        />
      </div>
    </DemoContext.Provider>
  )
}
