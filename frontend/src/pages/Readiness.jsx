import { useState, useEffect } from 'react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'
import PageHeader from '../components/ui/PageHeader'
import KpiCard from '../components/ui/KpiCard'
import StatusBadge from '../components/ui/StatusBadge'
import ProgressBar from '../components/ui/ProgressBar'
import SectionDivider from '../components/ui/SectionDivider'

const COMPANY_ID = 1

const CATEGORIES = [
  { key: 'revenue_quality',          label: 'Revenue Quality',          weight: 0.25 },
  { key: 'financial_integrity',      label: 'Financial Integrity',      weight: 0.20 },
  { key: 'operational_independence', label: 'Operational Independence', weight: 0.20 },
  { key: 'customer_risk',            label: 'Customer Risk',            weight: 0.15 },
  { key: 'management_team',          label: 'Management & Team',        weight: 0.10 },
  { key: 'growth_drivers',           label: 'Growth Drivers',           weight: 0.10 },
]

function scoreTier(s) {
  if (s >= 80) return { label: 'Strong',    variant: 'adequate' }
  if (s >= 65) return { label: 'Adequate',  variant: 'adequate' }
  if (s >= 50) return { label: 'Watch',     variant: 'watch'    }
  if (s >= 35) return { label: 'High Risk', variant: 'high'     }
  return              { label: 'Critical',  variant: 'critical' }
}

function progressColor(s) {
  if (s >= 65) return 'bg-primary'
  if (s >= 50) return 'bg-warning'
  return 'bg-destructive'
}

export default function Readiness() {
  const [scores, setScores] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/analytics/scores/${COMPANY_ID}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setScores(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const drs  = scores?.drs
  const cats = scores?.category_scores ?? {}

  const radarData = CATEGORIES.map(c => ({
    subject:  c.label.split(' ')[0],
    score:    cats[c.key]?.composite ?? 0,
    fullMark: 100,
  }))

  return (
    <div>
      <PageHeader
        section="Intelligence"
        title="Diligence Readiness Score"
        subtitle="Composite operational readiness index — weighted across 6 diligence categories"
        badge={drs ? `DRS ${drs.base}/100` : undefined}
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard label="DRS Score"        value={drs ? `${drs.base}/100`        : '—'} sublabel="Base confidence" />
        <KpiCard label="Conservative DRS" value={drs ? `${drs.conservative}/100` : '—'} sublabel="Low-confidence inputs excluded" />
        <KpiCard label="Optimistic DRS"   value={drs ? `${drs.optimistic}/100`   : '—'} sublabel="All gaps resolved favorably" />
        <KpiCard label="Tier"             value={drs?.tier ?? '—'}                       sublabel="DRS classification" />
      </div>

      {loading && (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading scores…</div>
      )}

      {!loading && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <SectionDivider label="Category Radar" />
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Radar name="DRS" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }}
                  formatter={v => [`${v}/100`, 'Score']}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <SectionDivider label="Category Breakdown" />
            <div className="space-y-4">
              {CATEGORIES.map(c => {
                const score = cats[c.key]?.composite ?? 0
                const tier  = scoreTier(score)
                return (
                  <div key={c.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-card-foreground">{c.label}</span>
                      <div className="flex items-center gap-2">
                        <StatusBadge variant={tier.variant}>{tier.label}</StatusBadge>
                        <span className="text-xs font-bold text-card-foreground">{score}</span>
                        <span className="text-[10px] text-muted-foreground">({(c.weight * 100).toFixed(0)}%)</span>
                      </div>
                    </div>
                    <ProgressBar value={score} color={progressColor(score)} />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
