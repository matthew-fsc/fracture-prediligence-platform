import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { ArrowRight, NotebookPen, Edit2, Check, X } from 'lucide-react'
import SectionHeader from '../components/ui/SectionHeader'
import InviteOwnerPanel from '../components/advisor/InviteOwnerPanel'
import { cn, fmtM } from '../lib/utils'
import { apiClient } from '../lib/apiClient'

// Map API category keys → display category for color coding
const CAT_PRIORITY_TO_SEVERITY = (p) => p === 1 ? 'critical' : p <= 3 ? 'high' : 'medium'
const CAT_PRIORITY_TO_TIMELINE = (p) => p <= 1 ? '18–24mo' : p <= 3 ? '6–12mo' : '3–6mo'

function buildLevers(gapData) {
  if (!gapData?.gaps?.length) return []
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
import { Skeleton } from '../components/ui/Skeleton'
import { useCompanyId } from '../context/CompanyContext'
import { withCompanyQuery, resolvePath } from '../lib/navLinks'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtCompact(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n)}`
}

function buildChartData(monthly24m) {
  if (!monthly24m) return []
  const entries = Object.entries(monthly24m)
    .sort(([a], [b]) => a.localeCompare(b))
  const recent12 = entries.slice(-12)
  const lookup = Object.fromEntries(entries.map(([k, v]) => [k, Math.round(Number(v))]))
  return recent12
    .filter(([, v]) => v > 100)
    .map(([k, v]) => {
      const [yr, mo] = k.split('-')
      const priorKey = `${parseInt(yr) - 1}-${mo}`
      const priorVal = lookup[priorKey]
      return {
        month: MONTHS[parseInt(mo) - 1] + " '" + yr.slice(2),
        revenue: Math.round(Number(v)),
        priorYear: priorVal > 0 ? priorVal : null,
      }
    })
}

export default function CompanyWorkspace() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const companyId = useCompanyId()
  const go = (appPath) => navigate(withCompanyQuery(resolvePath(appPath, pathname), companyId))
  const [liveScores, setLiveScores] = useState(null)
  const [metrics, setMetrics]       = useState(null)
  const [bqData, setBqData]         = useState(null)
  const [gapData, setGapData]       = useState(null)
  const [marketBench, setMarketBench] = useState(undefined)
  const [companyData, setCompanyData] = useState(null)
  const [editingHeadcount, setEditingHeadcount] = useState(false)
  const [headcountInput, setHeadcountInput] = useState('')

  useEffect(() => {
    apiClient.get(`/api/analytics/scores/${companyId}`)
      .then(setLiveScores)
      .catch(() => {})
    apiClient.get(`/api/analytics/metrics/${companyId}`)
      .then(setMetrics)
      .catch(() => {})
    apiClient.get(`/api/analytics/buyer-questions/${companyId}`)
      .then(setBqData)
      .catch(() => {})
    apiClient.get(`/api/analytics/value-gap/${companyId}`)
      .then(setGapData)
      .catch(() => {})
    apiClient.get(`/api/analytics/market-benchmarks/${companyId}`)
      .then(setMarketBench)
      .catch(() => { setMarketBench(null) })
    apiClient.get(`/api/companies/${companyId}`)
      .then(setCompanyData)
      .catch(() => {})
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
    { label: 'Readiness Score',  value: `${kpis.drs}/100`,           sub: kpis.tier.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), color: 'primary' },
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
            {(companyData?.name ?? '??').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-card-foreground">{companyData?.name ?? 'Loading…'}</h1>
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">Active Engagement</span>
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground">Pre-Diligence</span>
              <button
                type="button"
                onClick={() => go('/EngagementIntake')}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
              >
                <NotebookPen className="h-3 w-3" aria-hidden />
                Engagement intake
              </button>
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap">{editingHeadcount ? (
                <span className="inline-flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    value={headcountInput}
                    onChange={e => setHeadcountInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const val = parseInt(headcountInput, 10)
                        if (!isNaN(val) && val >= 0) {
                          apiClient.patch(`/api/companies/${companyId}`, { total_headcount: val })
                            .then(updated => {
                              setCompanyData(updated)
                              setMetrics(prev => prev ? { ...prev, total_headcount: val } : prev)
                            })
                            .catch(() => {})
                        }
                        setEditingHeadcount(false)
                      }
                      if (e.key === 'Escape') setEditingHeadcount(false)
                    }}
                    autoFocus
                    className="w-16 text-sm bg-secondary border border-primary/40 rounded px-1.5 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  <button
                    onClick={() => {
                      const val = parseInt(headcountInput, 10)
                      if (!isNaN(val) && val >= 0) {
                        apiClient.patch(`/api/companies/${companyId}`, { total_headcount: val })
                          .then(updated => {
                            setCompanyData(updated)
                            setMetrics(prev => prev ? { ...prev, total_headcount: val } : prev)
                          })
                          .catch(() => {})
                      }
                      setEditingHeadcount(false)
                    }}
                    className="text-emerald-400 hover:text-emerald-300"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setEditingHeadcount(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setHeadcountInput(String(companyData?.total_headcount ?? metrics?.total_headcount ?? ''))
                    setEditingHeadcount(true)
                  }}
                  className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors group"
                  title="Click to edit employee count"
                >
                  {companyData?.total_headcount ?? metrics?.total_headcount ?? '—'} employees
                  <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                </button>
              )}<span>· Founded {companyData?.founded ?? '—'} · {companyData?.industry ?? '—'}</span>
            </div>
            <div className="flex items-center gap-6 mt-2">
              <span className="text-xs text-muted-foreground">Readiness <span className="text-foreground font-semibold">{kpis.drs}/100</span></span>
              <span className="text-xs text-muted-foreground">Est. EV <span className="text-primary font-semibold">{fmtM(kpis.currentEV)}</span></span>
            </div>
          </div>
        </div>

      </div>

      {/* Owner onboarding invite panel */}
      <InviteOwnerPanel companyId={companyId} companyData={companyData} />

      {/* Intelligence cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {intelCards.map(c => (
          <div key={c.label} className={cn('rounded-xl border p-3', colorCfg[c.color])}>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{c.label}</p>
            <p className="text-lg font-bold leading-tight">{c.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* 3-col content grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Revenue trend chart */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-card-foreground">Revenue Trend</p>
              <p className="text-[11px] text-muted-foreground">
                {fmtM(kpis.ttmRevenue)} TTM
                {yoyGrowth != null && <span className={yoyGrowth >= 0 ? ' text-emerald-400' : ' text-red-400'}> · {yoyGrowth >= 0 ? '+' : ''}{yoyGrowth.toFixed(1)}% YoY</span>}
              </p>
            </div>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={150}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                <defs>
                  <linearGradient id="cwBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(160,84%,39%)" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="hsl(160,84%,39%)" stopOpacity={0.45} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${(v/1_000).toFixed(0)}K` : `$${v}`}
                  width={48} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const rev = payload.find(p => p.dataKey === 'revenue')?.value
                  const prior = payload.find(p => p.dataKey === 'priorYear')?.value
                  const yoyDelta = rev && prior ? ((rev - prior) / prior * 100) : null
                  const idx = chartData.findIndex(d => d.month === label)
                  const prevRev = idx > 0 ? chartData[idx - 1]?.revenue : null
                  const momDelta = rev && prevRev ? ((rev - prevRev) / prevRev * 100) : null
                  return (
                    <div className="bg-card border border-border rounded-lg px-3 py-2.5 shadow-xl text-xs space-y-1">
                      <p className="font-semibold text-foreground">{label}</p>
                      <p className="text-emerald-400">Revenue: {fmtM(rev)}</p>
                      {prior != null && <p className="text-muted-foreground">Prior year: {fmtM(prior)}</p>}
                      <div className="flex gap-3 pt-0.5 border-t border-border/50 mt-1">
                        {yoyDelta != null && (
                          <span className={yoyDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            YoY {yoyDelta >= 0 ? '+' : ''}{yoyDelta.toFixed(1)}%
                          </span>
                        )}
                        {momDelta != null && (
                          <span className={momDelta >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}>
                            MoM {momDelta >= 0 ? '+' : ''}{momDelta.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  )
                }} />
                <Bar dataKey="revenue" name="Revenue" fill="url(#cwBar)" radius={[3, 3, 0, 0]} barSize={14} />
                {chartData.some(d => d.priorYear != null) && (
                  <Line type="monotone" dataKey="priorYear" name="Prior Year" stroke="hsl(220,15%,50%)"
                    strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[150px] text-xs text-muted-foreground">
              No monthly revenue data available
            </div>
          )}
        </div>

        {/* Customer Risk Metrics */}
        {(() => {
          const custScores = liveScores?.category_scores?.customer_risk?.sub_scores ?? {}
          const custComposite = liveScores?.category_scores?.customer_risk?.composite ?? null
          const custStatus = custComposite >= 80 ? 'emerald' : custComposite >= 60 ? 'amber' : 'red'
          const custItems = [
            { label: 'Customers',      value: metrics ? String(metrics.total_customer_count) : '—',  sub: 'active base' },
            { label: 'Avg Tenure',     value: metrics ? `${metrics.avg_customer_tenure_years.toFixed(1)}yr` : '—', sub: 'retention signal' },
            { label: (() => { const d = liveScores?.category_scores?.revenue_quality?.sub_scores?.durability; return d?.source === 'advisor_input' ? 'Contract Cov.' : 'Recurring Rev' })(),
              value: (() => { const subs = liveScores?.category_scores?.revenue_quality?.sub_scores ?? {}; const d = subs.durability; if (d?.source === 'advisor_input' && d.value != null) return `${parseFloat(d.value).toFixed(0)}%`; const explicit = metrics?.recurring_revenue_pct; const v = (explicit != null && explicit > 0) ? explicit : (subs.recurring_rate?.value ?? explicit); return v != null ? `${parseFloat(v).toFixed(0)}%` : '—' })(),
              sub: (() => { const d = liveScores?.category_scores?.revenue_quality?.sub_scores?.durability; return d?.source === 'advisor_input' ? 'advisor input' : 'of TTM revenue' })() },
            { label: 'Concentration',  value: custScores.concentration?.score != null ? `${custScores.concentration.score.toFixed(0)}` : '—', sub: 'HHI score /100' },
          ]
          return (
            <div className={cn('rounded-xl border bg-card p-4', `border-${custStatus}-500/20`)}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-card-foreground">Customer Risk</p>
                {custComposite != null && (
                  <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded border',
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
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                    <p className="text-base font-bold text-foreground">{item.value}</p>
                    <p className="text-[11px] text-muted-foreground">{item.sub}</p>
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
                <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 h-fit',
                  b.sev === 'critical' ? 'border-red-500/20 bg-red-500/10 text-red-400' :
                  b.sev === 'high' ? 'border-amber-500/20 bg-amber-500/10 text-amber-400' :
                  'border-border bg-muted text-muted-foreground')}>
                  {b.sev}
                </span>
                <div>
                  <p className="text-[11px] font-medium text-card-foreground">{b.label}</p>
                  <p className="text-[11px] text-muted-foreground">{b.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => go('/BuyerLens')}
            className="mt-3 text-[11px] text-primary font-medium flex items-center gap-1">
            Full risk profile <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Value creation levers + market position */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-8 rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Value Creation Levers</p>
          <div className="space-y-0">
            {levers.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No value-gap levers yet — categories are at or above the improvement target, or value-gap data is still loading.
              </p>
            )}
            {levers.map((item) => (
              <div key={item.rank} className="flex items-center gap-4 py-2.5 border-b border-border last:border-0">
                <span className="text-[11px] font-bold text-muted-foreground w-4 flex-shrink-0">{item.rank}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-card-foreground">{item.initiative}</p>
                  <p className="text-[11px] text-muted-foreground">{item.detail}</p>
                </div>
                <span className="text-xs font-semibold text-emerald-400 whitespace-nowrap flex-shrink-0">
                  +{fmtM(item.valueMin)}–{fmtM(item.valueMax)}
                </span>
                <span className="text-[11px] text-muted-foreground w-16 flex-shrink-0 whitespace-nowrap">{item.timeline}</span>
                <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0',
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
        {(() => {
          const ebitdaMargin = kpis.ttmRevenue > 0 ? kpis.ebitda / kpis.ttmRevenue * 100 : null
          const revenuePerEmp = metrics?.revenue_per_employee ?? null

          const revQualSubs = liveScores?.category_scores?.revenue_quality?.sub_scores ?? {}
          const durabilitySub = revQualSubs.durability ?? {}
          const isAdvisorContract = durabilitySub.source === 'advisor_input'
          const contractLabel = isAdvisorContract ? 'Contract Coverage' : 'Recurring Rev.'
          const contractValue = isAdvisorContract
            ? (durabilitySub.value != null ? Number(durabilitySub.value) : null)
            : (() => {
                // Prefer explicit contract tagging; fall back to behavioral detection
                const explicit = metrics?.recurring_revenue_pct
                if (explicit != null && explicit > 0) return explicit
                return revQualSubs.recurring_rate?.value ?? explicit ?? null
              })()

          const multipleBasis = ev.multiple_basis ?? 'drs_tier_heuristic'
          const drsMultFloor = ev.drs_multiple_floor
          const drsMultCeil = ev.drs_multiple_ceiling

          const hasPeerData = (marketBench?.benchmarks ?? []).length > 0
          const findPeer = (label) => hasPeerData ? (marketBench.benchmarks ?? []).find(b => b.metric === label)?.median : null

          const stats = [
            { label: 'Rev. Growth', value: yoyGrowth, unit: '%', dir: 'higher_better', peer: findPeer('Revenue Growth') },
            { label: 'EBITDA Margin', value: ebitdaMargin, unit: '%', dir: 'higher_better', peer: findPeer('EBITDA Margin') },
            { label: contractLabel, value: contractValue, unit: '%', dir: 'higher_better', peer: findPeer('Recurring Rev.') },
            { label: 'Rev / Employee', value: revenuePerEmp, unit: '$auto', dir: 'higher_better', peer: findPeer('Rev / Employee') },
          ].filter(m => m.value != null)

          if (marketBench === undefined) {
            return (
              <div className="col-span-12 md:col-span-4 rounded-xl border border-border bg-card p-4 space-y-3">
                <Skeleton className="h-3 w-24" />
                <div className="grid grid-cols-2 gap-2">
                  {[0,1,2,3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                </div>
                <Skeleton className="h-3 w-40" />
              </div>
            )
          }

          return (
            <div className="col-span-12 md:col-span-4 rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Market Position</p>
                {marketBench?.segment_label && (
                  <span className="text-[10px] text-muted-foreground">{marketBench.segment_label}</span>
                )}
              </div>

              {/* Key metrics — compact 2×2 grid */}
              <div className="grid grid-cols-2 gap-2">
                {stats.map(m => {
                  const v = Number(m.value)
                  const med = m.peer != null ? Number(m.peer) : null
                  const good = m.dir === 'higher_better' ? v > (med ?? 0) : v < (med ?? 100)
                  const display = m.unit === '$auto' ? fmtCompact(v) : `${v.toFixed(1)}${m.unit}`
                  const peerDisplay = med != null ? (m.unit === '$auto' ? fmtCompact(med) : `${med.toFixed(1)}${m.unit}`) : null
                  return (
                    <div key={m.label} className="p-2 rounded-lg bg-muted/30 border border-border/50">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{m.label}</p>
                      <p className={cn('text-base font-bold', med != null ? (good ? 'text-emerald-400' : 'text-amber-400') : 'text-foreground')}>
                        {display}
                      </p>
                      {peerDisplay != null && (
                        <p className="text-[10px] text-muted-foreground/60">peer {peerDisplay}</p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Valuation multiples — inline */}
              {drsMultFloor != null && (
                <div className="flex items-center justify-between text-[11px] px-1">
                  <span className="text-muted-foreground">Multiple range</span>
                  <span className="font-semibold text-foreground">
                    {drsMultFloor.toFixed(1)}× – {drsMultCeil.toFixed(1)}×
                    <span className="text-muted-foreground/60 font-normal ml-1">
                      ({multipleBasis === 'blended' ? 'blended' : multipleBasis === 'market_median' ? 'market' : 'DRS'})
                    </span>
                  </span>
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
