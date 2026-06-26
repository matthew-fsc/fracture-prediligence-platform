import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'
import { apiClient } from '../lib/apiClient'

const COLORS = {
  bg: '#0A1628', gold: '#C9973A', offWhite: '#F0EDE8',
  muted: '#8A9BB0', card: '#0F2040', border: '#1E3A5F',
}

const FEATURES = [
  'Full DRS scoring engine',
  'Defensible EBITDA recast',
  'Enterprise value estimation',
  'Buyer question simulation',
  'PDF advisor reports',
  'AI Copilot for diligence Q&A',
  'Data room organization',
  'Value gap initiative roadmap',
]

export default function PartnerLandingPage() {
  const { slug } = useParams()
  const [partner, setPartner] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  usePageTitle(partner ? `${partner.name} × Exit Blueprint` : 'Member Pricing')

  useEffect(() => {
    if (!slug) return
    apiClient.get(`/api/partners/${slug}`)
      .then(d => { setPartner(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [slug])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif" }}>Loading...</p>
    </div>
  )

  if (error || !partner) return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <p style={{ color: '#f87171', fontFamily: "'DM Sans', sans-serif" }}>Partner page not found.</p>
      <Link to="/pricing" style={{ color: COLORS.gold, fontFamily: "'DM Sans', sans-serif" }}>View standard pricing →</Link>
    </div>
  )

  const pricingUrl = `/pricing?partner=${slug}`

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg }}>
      <nav style={{ background: 'rgba(10,22,40,0.95)', borderBottom: `1px solid ${COLORS.border}`, backdropFilter: 'blur(12px)', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: COLORS.gold, borderRadius: 6, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: COLORS.bg, fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 15 }}>F</span>
          </div>
          <span style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>×</span>
          {partner.logo_url ? (
            <img src={partner.logo_url} alt={partner.name} style={{ height: 28, objectFit: 'contain' }} />
          ) : (
            <span style={{ color: COLORS.offWhite, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14 }}>{partner.name}</span>
          )}
        </div>
        <Link to="/sign-in" style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13, textDecoration: 'none' }}>Sign In</Link>
      </nav>

      <section style={{ padding: '80px 24px 60px', textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
        <p style={{ color: COLORS.gold, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 16 }}>
          {partner.name} Member Benefit
        </p>
        <h1 style={{ color: COLORS.offWhite, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, lineHeight: 1.1, margin: '0 0 20px 0' }}>
          Pre-Diligence Intelligence,<br />Built for Exit Advisors
        </h1>
        {partner.has_discount ? (
          <div style={{ display: 'inline-block', background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: 10, padding: '12px 24px', marginBottom: 28 }}>
            <p style={{ color: '#16a34a', fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700, margin: 0 }}>
              {partner.name} members save {partner.discount_pct}% — applied automatically at checkout
            </p>
          </div>
        ) : (
          <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 15, marginBottom: 28 }}>
            Exclusive access for {partner.name} members
          </p>
        )}
        <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 15, lineHeight: 1.7, marginBottom: 40 }}>
          Exit Blueprint is the pre-diligence operating intelligence platform trusted by exit advisors to prepare clients before buyers arrive. Turn 40 hours of manual prep into a structured, buyer-ready package.
        </p>
        <Link
          to={pricingUrl}
          style={{
            display: 'inline-block',
            background: COLORS.gold, color: COLORS.bg,
            fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15,
            padding: '14px 36px', borderRadius: 10, textDecoration: 'none',
          }}
        >
          Claim member pricing →
        </Link>
        <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 12, marginTop: 12 }}>14-day free trial · No credit card required</p>
      </section>

      <section style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px 80px' }}>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: '32px 28px' }}>
          <h2 style={{ color: COLORS.offWhite, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 24, fontWeight: 600, margin: '0 0 24px 0' }}>
            What's included
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px 24px' }}>
            {FEATURES.map(f => (
              <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: COLORS.gold, fontWeight: 700 }}>✓</span>
                <span style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
