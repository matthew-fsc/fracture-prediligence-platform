/**
 * ClientReadiness — read-only DRS scorecard for business owners.
 *
 * Shows the same DRS radar + category breakdown as the advisor's Readiness page,
 * but without override controls or raw data access.
 */

import { useQuery } from '@tanstack/react-query'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { Grid3x3, Info } from 'lucide-react'
import { apiClient } from '../../lib/apiClient'
import { cn } from '../../lib/utils'
import { Skeleton } from '../../components/ui/Skeleton'
import { useUserRole } from '../../context/UserRoleContext'
import { usePageTitle } from '../../hooks/usePageTitle'
import SectionHeader from '../../components/ui/SectionHeader'

const CATEGORY_META = {
  revenue_quality:          { label: 'Revenue Quality',          weight: 25, icon: '📈' },
  financial_integrity:      { label: 'Financial Integrity',      weight: 20, icon: '🔍' },
  operational_independence: { label: 'Operational Independence', weight: 20, icon: '⚙️' },
  customer_risk:            { label: 'Customer Risk',            weight: 15, icon: '👥' },
  management_team:          { label: 'Management & Team',        weight: 10, icon: '🏢' },
  growth_drivers:           { label: 'Growth Drivers',           weight: 10, icon: '🚀' },
}

function scoreStyle(s) {
  if (s == null) return { color: 'text-muted-foreground', bar: 'bg-muted', tier: 'No data' }
  if (s >= 75)   return { color: 'text-emerald-400',      bar: 'bg-emerald-500', tier: 'Strong' }
  if (s >= 60)   return { color: 'text-emerald-400',      bar: 'bg-emerald-400', tier: 'Good' }
  if (s >= 45)   return { color: 'text-amber-400',        bar: 'bg-amber-500',   tier: 'Moderate' }
  if (s >= 30)   return { color: 'text-red-400',          bar: 'bg-red-400',     tier: 'Weak' }
  return                { color: 'text-red-500',          bar: 'bg-red-600',     tier: 'Critical' }
}

function drsTierInfo(score) {
  if (score == null) return null
  if (score >= 85) return { label: 'Institutional Grade', desc: 'Ready for institutional PE diligence',  color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' }
  if (score >= 70) return { label: 'Investment Grade',    desc: 'Suitable for most acquirers with prep', color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' }
  if (score >= 55) return { label: 'Conditional',         desc: 'Requires targeted improvements first',  color: 'text-amber-400',   border: 'border-amber-500/30',   bg: 'bg-amber-500/10' }
  if (score >= 40) return { label: 'High Risk',           desc: 'Significant issues need resolution',    color: 'text-red-400',     border: 'border-red-500/30',     bg: 'bg-red-500/10' }
  return                  { label: 'Pre-Diligence',       desc: 'Foundational work required',            color: 'text-red-500',     border: 'border-red-500/30',     bg: 'bg-red-500/10' }
}

export default function ClientReadiness() {
  usePageTitle('My Readiness Score')
  const { clientCompany } = useUserRole()
  const companyId = clientCompany?.id

  const { data: scores, isPending } = useQuery({
    queryKey: ['analytics-scores', companyId],
    queryFn: () => apiClient.get(`/api/analytics/scores/${companyId}`),
    enabled: companyId != null,
    staleTime: 60_000,
    meta: { suppressErrorToast: true },
  })

  const drs = scores?.drs?.base
  const drsLow = scores?.drs?.low
  const drsHigh = scores?.drs?.high
  const tier = drsTierInfo(drs)

  const categories = scores?.category_scores
    ? Object.entries(CATEGORY_META).map(([key, meta]) => {
        const raw = scores.category_scores[key]
        return {
          key,
          ...meta,
          score: typeof raw === 'object' ? raw.score : raw,
        }
      })
    : []

  const radarData = categories.map((c) => ({
    subject: c.label.split(' ')[0],
    score: Math.round(c.score ?? 0),
    fullMark: 100,
  }))

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <SectionHeader
        icon={<Grid3x3 className="w-5 h-5" />}
        title="My Readiness Score"
        subtitle="Your Diligence Readiness Score (DRS) reflects how prepared your business is for a professional M&A process."
      />

      {/* ── DRS Hero ───────────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          {/* Big score */}
          <div className="flex-shrink-0 text-center md:text-left">
            {isPending ? (
              <Skeleton className="h-20 w-32 mb-2" />
            ) : drs != null ? (
              <>
                <div className="flex items-end gap-2">
                  <span className={cn('text-7xl font-bold tabular-nums leading-none', tier?.color ?? 'text-foreground')}>
                    {Math.round(drs)}
                  </span>
                  <span className="text-2xl text-muted-foreground mb-2">/100</span>
                </div>
                {(drsLow != null && drsHigh != null) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Range: {Math.round(drsLow)}–{Math.round(drsHigh)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-lg">Not yet computed</p>
            )}
          </div>

          {/* Tier */}
          {tier && (
            <div className={cn('rounded-lg border px-4 py-3', tier.border, tier.bg)}>
              <p className={cn('text-base font-semibold', tier.color)}>{tier.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{tier.desc}</p>
            </div>
          )}

          {/* Radar */}
          {radarData.length > 0 && (
            <div className="flex-1 min-w-0" style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  />
                  <Radar
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.15}
                    strokeWidth={1.5}
                  />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 11 }}
                    formatter={(v) => [`${v}/100`, 'Score']}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── What does this mean ────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-card-foreground">Understanding Your Score</h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The Diligence Readiness Score (DRS) measures how well your business will hold up under a professional
          buyer's due-diligence process. A higher score typically means a cleaner transaction, fewer re-trades,
          and stronger multiple. Your advisor uses this score to prioritize the value-creation initiatives
          that will have the biggest impact before going to market.
        </p>
      </div>

      {/* ── Category breakdown ────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Score Breakdown
        </p>
        <div className="space-y-3">
          {isPending
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)
            : categories.map(({ key, label, weight, icon, score }) => {
                const s = scoreStyle(score)
                return (
                  <div key={key} className="bg-card rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span>{icon}</span>
                        <span className="text-sm font-medium text-card-foreground">{label}</span>
                        <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
                          {weight}% weight
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn('text-xs font-medium', s.color)}>{s.tier}</span>
                        <span className={cn('text-sm font-bold tabular-nums', s.color)}>
                          {score != null ? `${Math.round(score)}/100` : '—'}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', s.bar)}
                        style={{ width: `${Math.min(100, score ?? 0)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
        </div>
      </div>
    </div>
  )
}
