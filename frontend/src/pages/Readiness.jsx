import { useState, useEffect } from 'react'
import SectionHeader from '../components/ui/SectionHeader'
import { cn } from '../lib/utils'
import { AlertTriangle } from 'lucide-react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts'
import { Skeleton } from '../components/ui/Skeleton'

const COMPANY_ID = 1

const CATEGORY_META = {
  revenue_quality:          { label: 'Revenue Quality',          weight: 25, abbr: 'Revenue' },
  financial_integrity:      { label: 'Financial Integrity',      weight: 20, abbr: 'Financial' },
  operational_independence: { label: 'Operational Independence', weight: 20, abbr: 'Operations' },
  customer_risk:            { label: 'Customer Risk',            weight: 15, abbr: 'Customer' },
  management_team:          { label: 'Management & Team',        weight: 10, abbr: 'Management' },
  growth_drivers:           { label: 'Growth Drivers',           weight: 10, abbr: 'Growth' },
}

function scoreColor(s) {
  if (s >= 75) return 'text-emerald-400'
  if (s >= 55) return 'text-amber-400'
  return 'text-red-400'
}
function barColor(s) {
  if (s >= 75) return 'bg-emerald-500'
  if (s >= 55) return 'bg-amber-500'
  return 'bg-red-500'
}
function tierLabel(s) {
  if (s >= 85) return { label: 'Institutional Grade', color: 'emerald' }
  if (s >= 70) return { label: 'Investment Grade',    color: 'emerald' }
  if (s >= 55) return { label: 'Needs Work',          color: 'amber' }
  if (s >= 40) return { label: 'High Risk',           color: 'red' }
  return       { label: 'Not Saleable',               color: 'red' }
}

export default function Readiness() {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch(`/api/analytics/scores/${COMPANY_ID}`)
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
  }, [])

  if (data === null) {
    return (
      <div className="space-y-5 max-w-[1400px]">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-3">
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <Skeleton className="h-3 w-24 mx-auto" />
              <Skeleton className="h-32 w-32 rounded-full mx-auto" />
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-3 w-full" />)}
            </div>
          </div>
          <div className="col-span-12 lg:col-span-9">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between"><Skeleton className="h-3 w-40" /><Skeleton className="h-3 w-16" /></div>
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const drs = data?.drs?.base ?? 0
  const tier = tierLabel(drs)
  const cats = data?.category_scores ?? {}

  const breakdown = Object.entries(CATEGORY_META).map(([key, meta]) => {
    const score = cats[key]?.composite ?? 0
    const weighted = score * meta.weight / 100
    return { key, ...meta, score, weighted }
  })

  const radarData = breakdown.map(b => ({ subject: b.abbr, score: b.score, fullMark: 100 }))

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader
        title="Diligence Readiness Score"
        subtitle="Weighted scoring framework — Revenue Quality · Financial Integrity · Operational Independence · Customer Risk · Management · Growth"
        action={
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
            DRS: {drs.toFixed(1)} / 100
          </span>
        }
      />

      {/* Top row */}
      <div className="grid grid-cols-12 gap-4">
        {/* Score card */}
        <div className="col-span-12 lg:col-span-3">
          <div className="rounded-xl border border-emerald-500/20 bg-card p-6 space-y-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest text-center">Overall Score</p>
            <div className="flex flex-col items-center gap-2">
              <div className="relative w-32 h-32">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(220,18%,15%)" strokeWidth="10" />
                  <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(160,84%,39%)" strokeWidth="10"
                    strokeDasharray={`${2 * Math.PI * 50 * drs / 100} ${2 * Math.PI * 50 * (1 - drs / 100)}`}
                    strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-emerald-400">{Math.round(drs)}</span>
                  <span className="text-[10px] text-muted-foreground">/ 100</span>
                </div>
              </div>
              <span className={cn('text-sm font-bold', tier.color === 'emerald' ? 'text-emerald-400' : tier.color === 'amber' ? 'text-amber-400' : 'text-red-400')}>
                {tier.label}
              </span>
            </div>
            {/* Trend pills */}
            <div className="w-full space-y-1.5 pt-3 border-t border-border">
              {breakdown.map(b => (
                <div key={b.key} className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground truncate">{b.abbr}</span>
                  <span className={cn('font-bold', scoreColor(b.score))}>{b.score.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="col-span-12 lg:col-span-9">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">DRS Composition · Σ (score × weight)</p>
            <div className="space-y-4">
              {breakdown.map(item => (
                <div key={item.key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                      <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">{item.weight}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn('text-sm font-bold', scoreColor(item.score))}>{item.score.toFixed(0)}</span>
                      <span className="text-[10px] text-muted-foreground w-16 text-right">→ {item.weighted.toFixed(1)} pts</span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full">
                    <div className={cn('h-2 rounded-full transition-all', barColor(item.score))} style={{ width: `${item.score}%` }} />
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t border-border flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Weighted Total</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-2xl font-bold text-primary">{drs.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">/ 100</span>
                </div>
              </div>
            </div>

            {Object.entries(cats).some(([, v]) => v.data_confidence === 'LOW') && (
              <div className="rounded-xl border border-amber-500/20 bg-card p-4 mt-4">
                <p className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Data Gaps May Affect Score
                </p>
                <div className="space-y-1">
                  {Object.entries(cats)
                    .filter(([, v]) => v.data_confidence === 'LOW')
                    .map(([key, v]) => (
                      <p key={key} className="text-[11px] text-muted-foreground">
                        · {key.replace(/_/g, ' ')} — LOW confidence data; score may improve with fuller data
                      </p>
                    ))}
                </div>
              </div>
            )}

            {/* Radar */}
            <div className="pt-3 border-t border-border">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Dimension Radar</p>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                  <PolarGrid stroke="hsl(220,18%,20%)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'hsl(220,10%,50%)' }} />
                  <Radar name="Score" dataKey="score" stroke="hsl(160,84%,39%)" fill="hsl(160,84%,39%)" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* DRS Tier reference */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">DRS Tier Classification</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { range: '85–100', tier: 'Institutional Grade', color: 'emerald', note: 'Competitive process, minimal friction' },
            { range: '70–84',  tier: 'Investment Grade',    color: 'emerald', note: 'Standard diligence, closes on schedule' },
            { range: '55–69',  tier: 'Needs Work',          color: 'amber',   note: 'Material weaknesses, possible earnout' },
            { range: '40–54',  tier: 'High Risk',           color: 'red',     note: 'Significant structural problems' },
            { range: 'Below 40', tier: 'Not Saleable',      color: 'red',     note: 'No institutional bid viable' },
          ].map(t => {
            const isActive = (t.range === '70–84' && drs >= 70 && drs < 85) || (t.range === '85–100' && drs >= 85) ||
              (t.range === '55–69' && drs >= 55 && drs < 70) || (t.range === '40–54' && drs >= 40 && drs < 55) || (t.range === 'Below 40' && drs < 40)
            const c = t.color === 'emerald' ? 'border-emerald-500/20 bg-emerald-500/5' : t.color === 'amber' ? 'border-amber-500/20 bg-amber-500/5' : 'border-red-500/20 bg-red-500/5'
            const tc = t.color === 'emerald' ? 'text-emerald-400' : t.color === 'amber' ? 'text-amber-400' : 'text-red-400'
            return (
              <div key={t.range} className={cn('rounded-lg border p-3 space-y-1 transition-all', isActive ? `${c} ring-1 ring-offset-0` : 'border-border bg-muted/20')}>
                <p className="text-[10px] font-mono text-muted-foreground">{t.range}</p>
                <p className={cn('text-xs font-bold', isActive ? tc : 'text-muted-foreground')}>{t.tier}</p>
                <p className="text-[9px] text-muted-foreground leading-tight">{t.note}</p>
                {isActive && <span className="text-[9px] font-bold text-primary">← Current</span>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
