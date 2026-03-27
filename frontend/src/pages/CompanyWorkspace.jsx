import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import SectionHeader from '../components/ui/SectionHeader'
import { cn, fmtM } from '../lib/utils'
import { company, valueCreationLevers } from '../lib/mockData'

// Map API category keys → display category for color coding
const CAT_PRIORITY_TO_SEVERITY = (p) => p === 1 ? 'critical' : p <= 3 ? 'high' : 'medium'
const CAT_PRIORITY_TO_TIMELINE = (p) => p <= 1 ? '18–24mo' : p <= 3 ? '6–12mo' : '3–6mo'

function buildLevers(gapData) {
  if (!gapData?.gaps?.length) return valueCreationLevers
  const rawSum = gapData.gaps.reduce((s, g) => s + g.ev_uplift, 0)
  const total  = gapData.total_value_gap ?? rawSum
  const scale  = rawSum > 0 ? total / rawSum : 1
  return gapData.gaps.map(g => ({
    rank:      g.priority,
    initiative: g.label,
    detail:    `Score ${g.current_score.toFixed(0)} → ${g.target_score}/100 · ${g.score_gap.toFixed(0)}-point gap`,
    valueMin:  Math.round(g.ev_uplift * scale * 0.75),
    valueMax:  Math.round(g.ev_uplift * scale),
    timeline:  CAT_PRIORITY_TO_TIMELINE(g.priority),
    severity:  CAT_PRIORITY_TO_SEVERITY(g.priority),
  }))
}
// Note: company (name/initials/founded/industry) still from mockData until company API exists
import { ArrowRight, TrendingUp } from 'lucide-react'
import { Skeleton } from '../components/ui/Skeleton'
import { useCompanyId } from '../context/CompanyContext'
import { withCompanyQuery } from '../lib/navLinks'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function buildChartData(monthly24m) {
  if (!monthly24m) return []
  return Object.entries(monthly24m)
    .filter(([, v]) => v > 100)
    .map(([k, v]) => {
      const [yr, mo] = k.split('-')
      return { month: MONTHS[parseInt(mo) - 1] + " '" + yr.slice(2), revenue: Math.round(v) }
    })
    .slice(-12)
}

export default function CompanyWorkspace() {
  const navigate = useNavigate()
  const companyId = useCompanyId()
  const [liveScores, setLiveScores] = useState(null)
  const [metrics, setMetrics]       = useState(null)
  const [bqData, setBqData]         = useState(null)
  const [gapData, setGapData]       = useState(null)
  const [marketBench, setMarketBench] = useState(undefined)

  useEffect(() => {
    fetch(`/api/analytics/scores/${companyId}`)
      .then(r => r.ok ? r.json() : null)
      .then(setLiveScores)
      .catch(() => {})
    fetch(`/api/analytics/metrics/${companyId}`)
      .then(r => r.ok ? r.json() : null)
      .then(setMetrics)
      .catch(() => {})
    fetch(`/api/analytics/buyer-questions/${companyId}`)
      .then(r => r.ok ? r.json() : null)
      .then(setBqData)
      .catch(() => {})
    fetch(`/api/analytics/value-gap/${companyId}`)
      .then(r => r.ok ? r.json() : null)
      .then(setGapData)
      .catch(() => {})
    fetch(`/api/analytics/market-benchmarks/${companyId}`)
      .then(r => r.ok ? r.json() : null)
      .then(setMarketBench)
      .catch(() => { setMarketBench(null) })
  }, [companyId])

  const ev = liveScores?.enterprise_value ?? {}
  const kpis = {
    drs:            liveScores?.drs?.base ?? 0,
    tier:           liveScores?.drs?.tier ?? '—',
    ebitda:         ev.ebitda_base        ?? metrics?.ebitda_ttm ?? 0,
    currentEV:      ev.midpoint                                          ?? 0,
    potentialEV:    gapData?.potential_ev_midpoint ?? ev.ceiling          ?? 0,
    // Derive gap as potentialEV − currentEV so the three cards always add up correctly
    // (gapData and scores use different EBITDA bases; reading gap from gapData directly causes mismatch)
    get valueGap() { return Math.max(0, this.potentialEV - this.currentEV) },
    ebitdaMultiple: ev.multiple_used      ?? '—',
    ttmRevenue:     metrics?.total_revenue_ttm ?? 0,
    drsPercentile:  liveScores?.drs?.base >= 85 ? 90 : liveScores?.drs?.base >= 70 ? 62 : 40,
  }

  // Revenue chart from real monthly data
  const chartData = buildChartData(metrics?.monthly_revenue_24m)

  // YoY growth
  const revByYear = metrics?.total_revenue_by_year ?? {}
  const years = Object.keys(revByYear).sort()
  const yoyGrowth = years.length >= 2
    ? ((revByYear[years[years.length-1]] - revByYear[years[years.length-2]]) / revByYear[years[years.length-2]] * 100)
    : null

  // Diligence blockers from buyer-questions (top CRITICAL then HIGH)
  const blockers = bqData?.questions
    ?.filter(q => q.severity === 'CRITICAL' || q.severity === 'HIGH')
    .slice(0, 3)
    .map(q => ({
      label:  q.question.length > 60 ? q.question.slice(0, 57) + '…' : q.question,
      detail: q.data_required ?? q.category ?? '',
      sev:    q.severity === 'CRITICAL' ? 'critical' : 'high',
    })) ?? []

  const levers = buildLevers(gapData)

  const intelCards = [
    { label: 'EBITDA',           value: fmtM(kpis.ebitda),          sub: 'Defensible (base)',         color: 'blue'    },
    { label: 'EBITDA Multiple',  value: `${kpis.ebitdaMultiple}×`,   sub: 'DRS-adjusted',              color: 'purple'  },
    { label: 'Current EV',       value: fmtM(kpis.currentEV),        sub: 'Midpoint valuation',        color: 'emerald' },
    { label: 'Value Gap',        value: `+${fmtM(kpis.valueGap)}`,   sub: 'Addressable upside',        color: 'amber'   },
    { label: 'Potential EV',     value: fmtM(kpis.potentialEV),      sub: 'At target DRS',             color: 'emerald' },
    { label: 'Readiness Score',  value: `${kpis.drs}/100`,           sub: `${kpis.drsPercentile}th pctile`, color: 'primary' },
  ]

  const colorCfg = {
    blue:    'border-blue-500/20 bg-blue-500/5 text-blue-400',
    purple:  'border-purple-500/20 bg-purple-500/5 text-purple-400',
    emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400',
    amber:   'border-amber-500/20 bg-amber-500/5 text-amber-400',
    primary: 'border-primary/20 bg-primary/5 text-primary',
  }

  if (liveScores === null || metrics === null) {
    return (
      <div className="space-y-5 max-w-[1400px]">
        {/* Company header skeleton */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start gap-4">
            <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-72" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        </div>
        {/* Intel cards skeleton */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-3 space-y-2">
              <Skeleton className="h-2 w-16" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-2 w-14" />
            </div>
          ))}
        </div>
        {/* 3-col content skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-36 w-full" />
            </div>
          ))}
        </div>
        {/* Levers + market position skeleton */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-8 rounded-xl border border-border bg-card p-4 space-y-3">
            <Skeleton className="h-2 w-40" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-2 border-b border-border/50 last:border-0">
                <Skeleton className="h-3 w-4 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-2 w-64" />
                </div>
                <Skeleton className="h-3 w-20 flex-shrink-0" />
                <Skeleton className="h-3 w-12 flex-shrink-0" />
                <Skeleton className="h-4 w-14 flex-shrink-0" />
              </div>
            ))}
          </div>
          <div className="col-span-12 md:col-span-4 rounded-xl border border-border bg-card p-4 space-y-3">
            <Skeleton className="h-2 w-28" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-1 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Company header */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg flex-shrink-0">
            {company.initials}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-card-foreground">{company.name}</h1>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">Active Engagement</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground">Pre-Diligence</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {company.employees} employees · Founded {company.founded} · {company.industry}
            </p>
            <div className="flex items-center gap-6 mt-2">
              <span className="text-xs text-muted-foreground">Readiness <span className="text-foreground font-semibold">{kpis.drs}/100</span></span>
              <span className="text-xs text-muted-foreground">Est. EV <span className="text-primary font-semibold">{fmtM(kpis.currentEV)}</span></span>
            </div>
          </div>
        </div>

      </div>

      {/* Intelligence cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {intelCards.map(c => (
          <div key={c.label} className={cn('rounded-xl border p-3', colorCfg[c.color])}>
            <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{c.label}</p>
            <p className="text-lg font-bold leading-tight">{c.value}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* 3-col content grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Revenue chart */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-card-foreground">Revenue vs Expenses T12M</p>
              <p className="text-[11px] text-muted-foreground">
                {fmtM(kpis.ttmRevenue)} TTM
                {yoyGrowth != null && <span className={yoyGrowth >= 0 ? ' text-emerald-400' : ' text-red-400'}> · {yoyGrowth >= 0 ? '+' : ''}{yoyGrowth.toFixed(1)}% YoY</span>}
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="cwRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(160,84%,39%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(160,84%,39%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs">
                  <p className="font-semibold text-foreground mb-1">{label}</p>
                  {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: {fmtM(p.value)}</p>)}
                </div>
              ) : null} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(160,84%,39%)" fill="url(#cwRev)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="expenses" name="Expenses" stroke="hsl(220,18%,40%)" fill="transparent" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Customer Risk Metrics */}
        {(() => {
          const custScores = liveScores?.category_scores?.customer_risk?.sub_scores ?? {}
          const custComposite = liveScores?.category_scores?.customer_risk?.composite ?? null
          const custStatus = custComposite >= 80 ? 'emerald' : custComposite >= 60 ? 'amber' : 'red'
          const custItems = [
            { label: 'Customers',      value: metrics ? String(metrics.total_customer_count) : '—',  sub: 'active base' },
            { label: 'Avg Tenure',     value: metrics ? `${metrics.avg_customer_tenure_years.toFixed(1)}yr` : '—', sub: 'retention signal' },
            { label: 'Recurring Rev',  value: (() => { const v = liveScores?.category_scores?.revenue_quality?.sub_scores?.recurring_rate?.value ?? metrics?.recurring_revenue_pct; return v != null ? `${parseFloat(v).toFixed(0)}%` : '—' })(), sub: 'of TTM revenue' },
            { label: 'Concentration',  value: custScores.concentration?.score != null ? `${custScores.concentration.score.toFixed(0)}` : '—', sub: 'HHI score /100' },
          ]
          return (
            <div className={cn('rounded-xl border bg-card p-4', `border-${custStatus}-500/20`)}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-card-foreground">Customer Risk</p>
                {custComposite != null && (
                  <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border',
                    custComposite >= 80 ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' :
                    custComposite >= 60 ? 'border-amber-500/20 bg-amber-500/10 text-amber-400' :
                    'border-red-500/20 bg-red-500/10 text-red-400')}>
                    {custComposite.toFixed(0)}/100
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {custItems.map(item => (
                  <div key={item.label} className="p-2 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                    <p className="text-base font-bold text-foreground">{item.value}</p>
                    <p className="text-[9px] text-muted-foreground">{item.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Diligence blockers */}
        <div className="rounded-xl border border-red-500/20 bg-card p-4">
          <p className="text-xs font-semibold text-card-foreground mb-3">Diligence Blockers</p>
          <div className="space-y-2.5">
            {(blockers.length > 0 ? blockers : [{ label: 'Loading risk flags…', detail: '', sev: 'high' }]).map((b) => (
              <div key={b.label} className="flex gap-2">
                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 h-fit',
                  b.sev === 'critical' ? 'border-red-500/20 bg-red-500/10 text-red-400' :
                  b.sev === 'high' ? 'border-amber-500/20 bg-amber-500/10 text-amber-400' :
                  'border-border bg-muted text-muted-foreground')}>
                  {b.sev}
                </span>
                <div>
                  <p className="text-[11px] font-medium text-card-foreground">{b.label}</p>
                  <p className="text-[10px] text-muted-foreground">{b.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => navigate(withCompanyQuery('/BuyerLens', companyId))}
            className="mt-3 text-[11px] text-primary font-medium flex items-center gap-1">
            Full risk profile <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Value creation levers + market position */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-8 rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Value Creation Levers</p>
          <div className="space-y-0">
            {levers.map((item) => (
              <div key={item.rank} className="flex items-center gap-4 py-2.5 border-b border-border last:border-0">
                <span className="text-[11px] font-bold text-muted-foreground w-4 flex-shrink-0">{item.rank}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-card-foreground">{item.initiative}</p>
                  <p className="text-[10px] text-muted-foreground">{item.detail}</p>
                </div>
                <span className="text-xs font-semibold text-emerald-400 whitespace-nowrap flex-shrink-0">
                  +{fmtM(item.valueMin)}–{fmtM(item.valueMax)}
                </span>
                <span className="text-[10px] text-muted-foreground w-16 flex-shrink-0 whitespace-nowrap">{item.timeline}</span>
                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0',
                  item.severity === 'critical' ? 'border-red-500/20 bg-red-500/10 text-red-400' :
                  item.severity === 'high' ? 'border-amber-500/20 bg-amber-500/10 text-amber-400' :
                  'border-border bg-muted text-muted-foreground')}>
                  {item.severity}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Market position */}
        <div className="col-span-12 md:col-span-4 rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Market Position</p>
          <p className="text-[10px] text-muted-foreground mb-3">
            {marketBench === undefined && 'Loading peer benchmarks…'}
            {marketBench !== undefined && (marketBench?.source_line || 'No curated benchmark segment matched — set company industry in data settings.')}
          </p>
          {marketBench?.comparison_note && (
            <p className="text-[9px] text-amber-400/90 mb-2">{marketBench.comparison_note}</p>
          )}
          <div className="space-y-3">
            {(marketBench?.benchmarks ?? []).map((b) => {
              const med = b.median != null ? Number(b.median) : null
              const co = b.company != null ? Number(b.company) : null
              if (med == null || co == null) return null
              const above = b.direction === 'higher_better' ? co > med : co < med
              const barPct = med > 0 ? Math.min((co / (med * 2)) * 100, 100) : 0
              return (
                <div key={b.metric}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-muted-foreground">{b.metric}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">med {med}{b.unit}</span>
                      <span className={cn('text-[11px] font-semibold', above ? 'text-emerald-400' : 'text-amber-400')}>
                        {co.toFixed(1)}{b.unit}
                      </span>
                    </div>
                  </div>
                  <div className="h-1 bg-muted rounded-full">
                    <div className={cn('h-1 rounded-full', above ? 'bg-emerald-500' : 'bg-amber-500')}
                      style={{ width: `${barPct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">
            {marketBench?.segment_label
              ? <>Segment: <span className="text-foreground font-medium">{marketBench.segment_label}</span>. </>
              : null}
            DRS proxy: <span className="text-foreground font-medium">{kpis.drsPercentile}th percentile</span> (illustrative vs platform scoring tiers)
          </p>
        </div>
      </div>
    </div>
  )
}
