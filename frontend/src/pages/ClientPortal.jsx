import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiClient } from '../lib/apiClient'
import { usePageTitle } from '../hooks/usePageTitle'
import { Skeleton } from '../components/ui/Skeleton'

const COLORS = {
  bg: '#0A1628', gold: '#C9973A', offWhite: '#F0EDE8',
  muted: '#8A9BB0', card: '#0F2040', border: '#1E3A5F',
}

const TIER_LABELS = {
  'Institutional Grade': { color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
  'Investment Grade':    { color: '#2563eb', bg: 'rgba(37,99,235,0.1)' },
  'Conditional':         { color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
  'High Risk':           { color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
  'Pre-Diligence Required': { color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
}

function TierBadge({ tier }) {
  const style = TIER_LABELS[tier] || { color: COLORS.muted, bg: 'rgba(138,155,176,0.1)' }
  return (
    <span style={{
      display: 'inline-block',
      background: style.bg, color: style.color,
      fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700,
      padding: '4px 12px', borderRadius: 20,
      border: `1px solid ${style.color}44`,
    }}>
      {tier}
    </span>
  )
}

export default function ClientPortal() {
  usePageTitle('Your Exit Readiness')
  const [searchParams] = useSearchParams()
  const companyId = searchParams.get('company')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!companyId) { setLoading(false); return }
    apiClient.get(`/api/portal/${companyId}/summary`)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [companyId])

  if (!companyId) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif" }}>No company specified. Ask your advisor for your portal link.</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg }}>
      <nav style={{ background: 'rgba(10,22,40,0.97)', borderBottom: `1px solid ${COLORS.border}`, padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: COLORS.gold, borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: COLORS.bg, fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 14 }}>F</span>
          </div>
          <span style={{ color: COLORS.offWhite, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14 }}>Exit Readiness Portal</span>
        </div>
        {data && <span style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>{data.company_name}</span>}
      </nav>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px 64px' }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Skeleton style={{ height: 80 }} />
            <Skeleton style={{ height: 120 }} />
            <Skeleton style={{ height: 200 }} />
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 12, padding: '20px 24px', color: '#f87171', fontFamily: "'DM Sans', sans-serif" }}>
            Could not load your engagement data: {error}
          </div>
        )}

        {data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Header */}
            <div>
              <h1 style={{ color: COLORS.offWhite, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 32, fontWeight: 700, margin: '0 0 6px 0' }}>
                {data.company_name}
              </h1>
              {data.exit_timeline && (
                <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14, margin: 0 }}>
                  Target exit timeline: <strong style={{ color: COLORS.offWhite }}>{data.exit_timeline}</strong>
                </p>
              )}
            </div>

            {/* DRS Score */}
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: '28px 24px' }}>
              <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 12px 0' }}>
                Diligence Readiness Score
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                <span style={{ color: COLORS.gold, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 64, fontWeight: 700, lineHeight: 1 }}>
                  {data.drs.score}
                </span>
                <div>
                  <TierBadge tier={data.drs.tier} />
                  <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13, marginTop: 6 }}>
                    Range: {data.drs.conservative} – {data.drs.optimistic} / 100
                  </p>
                </div>
              </div>
              <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13, marginTop: 12, lineHeight: 1.6 }}>
                Your Diligence Readiness Score measures how prepared your business is for buyer due diligence across revenue quality, operational independence, customer risk, and financial integrity.
              </p>
            </div>

            {/* Enterprise Value */}
            {data.enterprise_value && (
              <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: '28px 24px' }}>
                <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 16px 0' }}>
                  Estimated Enterprise Value
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {[
                    { label: 'Conservative', value: data.enterprise_value.floor },
                    { label: 'Base Case', value: data.enterprise_value.midpoint, highlight: true },
                    { label: 'Optimistic', value: data.enterprise_value.ceiling },
                  ].map(({ label, value, highlight }) => (
                    <div key={label} style={{ textAlign: 'center' }}>
                      <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 11, margin: '0 0 4px 0' }}>{label}</p>
                      <p style={{ color: highlight ? COLORS.gold : COLORS.offWhite, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: highlight ? 26 : 20, fontWeight: 700, margin: 0 }}>
                        ${(value / 1_000_000).toFixed(1)}M
                      </p>
                    </div>
                  ))}
                </div>
                <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 12, marginTop: 12, lineHeight: 1.5 }}>
                  Based on defensible EBITDA of ${data.enterprise_value.ebitda?.toLocaleString(undefined, { maximumFractionDigits: 0 })} and your DRS tier multiple. Values are estimates — final transaction value depends on buyer negotiation, market conditions, and diligence outcome.
                </p>
              </div>
            )}

            {/* Top Initiatives */}
            {data.top_initiatives?.length > 0 && (
              <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: '28px 24px' }}>
                <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 16px 0' }}>
                  Top Value Creation Initiatives
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {data.top_initiatives.map((init, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
                      <div>
                        <p style={{ color: COLORS.offWhite, fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, margin: '0 0 3px 0' }}>{init.title}</p>
                        {init.timeline && <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 12, margin: 0 }}>Timeline: {init.timeline}</p>}
                      </div>
                      {init.ev_impact_estimate && (
                        <span style={{ color: COLORS.green, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', marginLeft: 16 }}>
                          +${(init.ev_impact_estimate / 1000).toFixed(0)}K EV
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Engagement Timeline */}
            {data.engagement_timeline?.length > 0 && (
              <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: '28px 24px' }}>
                <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 16px 0' }}>
                  Engagement Milestones
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.engagement_timeline.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                        background: s.status === 'complete' ? COLORS.green : s.status === 'current' ? COLORS.gold : COLORS.border,
                      }} />
                      <div>
                        <p style={{ color: s.status === 'current' ? COLORS.offWhite : COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: s.status === 'current' ? 600 : 400, margin: '0 0 2px 0' }}>
                          {s.milestone}
                        </p>
                        <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 11, margin: 0 }}>{s.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 12, textAlign: 'center', lineHeight: 1.5 }}>
              This portal is read-only. Contact your advisor to discuss findings or make changes to your engagement.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
