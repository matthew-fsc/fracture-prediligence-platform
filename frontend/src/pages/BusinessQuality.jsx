import { useState, useEffect } from 'react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import SectionDivider from '../components/ui/SectionDivider'
import ProgressBar from '../components/ui/ProgressBar'

const COMPANY_ID = 1

const CATEGORY_META = {
  revenue_quality:          { label: 'Revenue Quality',         weight: 25, color: 'text-primary' },
  financial_integrity:      { label: 'Financial Integrity',     weight: 20, color: 'text-primary' },
  operational_independence: { label: 'Operational Independence',weight: 20, color: 'text-warning' },
  customer_risk:            { label: 'Customer Risk',           weight: 15, color: 'text-primary' },
  management_team:          { label: 'Management & Team',       weight: 10, color: 'text-primary' },
  growth_drivers:           { label: 'Growth Drivers',          weight: 10, color: 'text-primary' },
}

function tierVariant(tier) {
  if (!tier) return 'medium'
  if (tier.includes('Institutional')) return 'strong'
  if (tier.includes('Investment'))    return 'adequate'
  if (tier.includes('Conditional'))   return 'watch'
  if (tier.includes('High Risk'))     return 'high'
  return 'critical'
}

function scoreColor(s) {
  if (s >= 75) return 'text-primary'
  if (s >= 55) return 'text-warning'
  return 'text-destructive'
}

function progressColor(s) {
  if (s >= 75) return 'bg-primary'
  if (s >= 55) return 'bg-warning'
  return 'bg-destructive'
}

export default function BusinessQuality() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    fetch(`/api/analytics/scores/${COMPANY_ID}`)
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const drs       = data?.drs
  const cats      = data?.category_scores ?? {}
  const ev        = data?.enterprise_value

  const radarData = Object.entries(CATEGORY_META).map(([key, meta]) => ({
    category: meta.label.replace(' & ', '\n& '),
    score:    cats[key]?.composite ?? 0,
    fullMark: 100,
  }))

  return (
    <div>
      <PageHeader
        section="Intelligence"
        title="Business Quality"
        subtitle="Diligence Readiness Score and all six Blueprint II category analyses"
        badge={drs ? `DRS ${drs.base}/100` : undefined}
      />

      {loading && (
        <div className="text-center py-16 text-muted-foreground text-sm">Computing scores…</div>
      )}

      {error && (
        <div className="text-center py-16 text-sm">
          <p className="text-destructive mb-2">{error}</p>
          <p className="text-muted-foreground text-xs">Upload financial data in Data Sources first to generate real scores.</p>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* DRS Hero */}
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-1 bg-card border border-border rounded-lg p-5 flex flex-col items-center justify-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">DRS Score</p>
              <p className={`text-5xl font-black ${scoreColor(drs?.base)}`}>{drs?.base ?? '—'}</p>
              <p className="text-xs text-muted-foreground mt-1">/ 100</p>
              {drs?.tier && (
                <StatusBadge variant={tierVariant(drs.tier)} className="mt-3">{drs.tier}</StatusBadge>
              )}
              {drs && (
                <div className="mt-4 w-full space-y-1 text-center">
                  <p className="text-[10px] text-muted-foreground">Conservative  {drs.conservative}  ·  Optimistic  {drs.optimistic}</p>
                </div>
              )}
            </div>

            <div className="col-span-2 bg-card border border-border rounded-lg p-4">
              <p className="text-xs font-semibold text-card-foreground mb-3">Score Radar</p>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="category" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                  <Radar name="Score" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }}
                    formatter={v => [`${v}/100`, 'Score']}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
              <p className="text-xs font-semibold text-card-foreground">Enterprise Value Range</p>
              {ev ? (
                <>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Floor</p>
                    <p className="text-lg font-bold text-card-foreground">${(ev.floor / 1e6).toFixed(2)}M</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Midpoint</p>
                    <p className="text-2xl font-black text-primary">${(ev.midpoint / 1e6).toFixed(2)}M</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ceiling</p>
                    <p className="text-lg font-bold text-card-foreground">${(ev.ceiling / 1e6).toFixed(2)}M</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-auto">{ev.multiple_used}x EBITDA · ${(ev.ebitda_base / 1e3).toFixed(0)}K EBITDA base</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No financial data yet</p>
              )}
            </div>
          </div>

          {/* Category Breakdown */}
          <SectionDivider label="Category Scores" />
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(CATEGORY_META).map(([key, meta]) => {
              const cat = cats[key]
              if (!cat) return null
              const score = cat.composite ?? 0
              const subScores = cat.sub_scores ?? {}

              return (
                <div key={key} className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-card-foreground">{meta.label}</p>
                      <p className="text-[10px] text-muted-foreground">{meta.weight}% of DRS</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-black ${scoreColor(score)}`}>{score}</p>
                      <StatusBadge variant={cat.data_confidence === 'HIGH' ? 'adequate' : cat.data_confidence === 'MEDIUM' ? 'watch' : 'medium'} className="text-[9px]">
                        {cat.data_confidence} confidence
                      </StatusBadge>
                    </div>
                  </div>
                  <div className="px-4 py-1">
                    <ProgressBar value={score} color={progressColor(score)} className="my-2" />
                  </div>
                  <div className="divide-y divide-border">
                    {Object.entries(subScores).map(([dim, sub]) => (
                      <div key={dim} className="flex items-center gap-3 px-4 py-2">
                        <span className="text-[10px] text-muted-foreground flex-1 capitalize">{sub.label}</span>
                        <div className="w-20">
                          <ProgressBar value={sub.score} color={progressColor(sub.score)} />
                        </div>
                        <span className={`text-xs font-bold w-8 text-right ${scoreColor(sub.score)}`}>{sub.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
