import { useState, useEffect } from 'react'
import SectionHeader from '../components/ui/SectionHeader'
import { cn, fmtM } from '../lib/utils'
import { AlertTriangle, Sparkles, RefreshCw } from 'lucide-react'
import { Skeleton } from '../components/ui/Skeleton'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'
import { apiClient } from '../lib/apiClient'
import { useCompanyId } from '../context/CompanyContext'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function buildChartData(monthly24m) {
  if (!monthly24m) return []
  return Object.entries(monthly24m)
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, v]) => v > 100)
    .map(([k, v]) => {
      const [yr, mo] = k.split('-')
      return { month: MONTHS[parseInt(mo) - 1] + " '" + yr.slice(2), revenue: Math.round(v) }
    })
    .slice(-12)
}

function MetricPanel({ label, displayValue, benchmark, percentile, status, trendDir, trendLabel, children }) {
  const colors = {
    strong:   { border: 'border-emerald-500/20', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', value: 'text-emerald-400' },
    adequate: { border: 'border-blue-500/20',    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',         value: 'text-blue-400'    },
    watch:    { border: 'border-amber-500/20',   badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',      value: 'text-amber-400'   },
    concern:  { border: 'border-red-500/20',     badge: 'bg-red-500/10 text-red-400 border-red-500/20',            value: 'text-red-400'     },
  }
  const c = colors[status] || colors.adequate
  return (
    <div className={cn('rounded-xl border bg-card p-4 space-y-3', c.border)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className={cn('text-2xl font-bold mt-0.5', c.value)}>{displayValue}</p>
        </div>
        <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded border uppercase', c.badge)}>{status}</span>
      </div>
      <div className="min-h-[60px]">{children}</div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{benchmark}</span>
        {percentile != null && <span className={cn('font-bold', c.value)}>{percentile}th pctile</span>}
      </div>
      {trendLabel && (
        <p className={cn('text-[11px]', trendDir === 'up' ? 'text-emerald-400' : trendDir === 'down' ? 'text-red-400' : 'text-muted-foreground')}>
          {trendDir === 'up' ? '↑' : trendDir === 'down' ? '↓' : '→'} {trendLabel}
        </p>
      )}
    </div>
  )
}

const CAT_LABELS = {
  revenue_quality: 'Revenue Quality',
  financial_integrity: 'Financial Integrity',
  operational_independence: 'Operational Independence',
  customer_risk: 'Customer Risk',
  management_team: 'Management & Team',
  growth_drivers: 'Growth Drivers',
}

export default function BusinessQuality() {
  const companyId = useCompanyId()
  const [scores, setScores] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [fetchError, setFetchError] = useState(null)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [aiInsights, setAiInsights] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)

  async function generateAiInterpretation() {
    if (!scores || !companyId) return
    setAiLoading(true)
    setAiError(null)
    const cats = scores?.category_scores ?? {}
    const categoryPayload = {}
    for (const [key, data] of Object.entries(cats)) {
      const drivers = Object.entries(data?.sub_scores ?? {}).slice(0, 4).map(([k, v]) => ({
        label: k.replace(/_/g, ' '),
        value: typeof v?.value === 'number' ? (v.value > 1 ? `${v.value.toFixed(0)}%` : v.value.toFixed(2)) : String(v?.value ?? ''),
      }))
      categoryPayload[key] = { score: data?.composite ?? 0, drivers }
    }
    try {
      const result = await apiClient.post(`/api/insights/${companyId}`, {
        module: 'drs_interpretation',
        payload: {
          drs_score: scores.drs_score ?? 0,
          drs_tier: scores.tier ?? '',
          categories: categoryPayload,
        },
      })
      if (result.result) setAiInsights(result.result)
      else setAiError(result.error || 'AI analysis unavailable')
    } catch (e) {
      setAiError(e?.message || 'AI analysis unavailable')
    }
    setAiLoading(false)
  }

  useEffect(() => {
    if (!companyId) { setScores(null); setMetrics(null); return }
    setFetchError(null)
    Promise.all([
      apiClient.get(`/api/analytics/scores/${companyId}`),
      apiClient.get(`/api/analytics/metrics/${companyId}`),
    ])
      .then(([s, m]) => { setScores(s); setMetrics(m) })
      .catch((err) => setFetchError(err?.message || 'Failed to load business quality data'))
  }, [companyId])

  if (!companyId) {
    return (
      <div className="space-y-5 max-w-[1400px]">
        <SectionHeader
          title="Business Quality"
          subtitle="Operating metrics benchmarked against industry peers"
        />
        <p className="text-sm text-muted-foreground">
          Select or create a client in the header to load business quality data.
        </p>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {fetchError}
      </div>
    )
  }

  if (scores === null || metrics === null) {
    return (
      <div className="space-y-5 max-w-[1400px]">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <Skeleton className="h-2 w-20" /><Skeleton className="h-7 w-24" /><Skeleton className="h-2 w-28" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8 rounded-xl border border-border bg-card p-5">
            <Skeleton className="h-56 w-full" />
          </div>
          <div className="col-span-12 lg:col-span-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        </div>
      </div>
    )
  }

  // ── Derived values from real API ──────────────────────────────────────────
  const cats = scores?.category_scores ?? {}

  const totalRevenue   = metrics?.total_revenue_ttm ?? 0
  const ebitda         = metrics?.ebitda_ttm ?? 0
  // Use explicit contract tagging from metrics as primary; DRS sub-score (behavioral detection) as fallback
  const recurringRateExplicit = metrics?.recurring_revenue_pct ?? 0
  const recurringRateBehavioral = cats.revenue_quality?.sub_scores?.recurring_rate?.value ?? 0
  // Show explicit if meaningful (>0), otherwise show behavioral with a note
  const recurringRate = recurringRateExplicit > 0 ? recurringRateExplicit : recurringRateBehavioral
  const recurringIsBehavioral = recurringRateExplicit === 0 && recurringRateBehavioral > 0

  const headcount      = (metrics?.total_headcount ?? 0) > 0 ? metrics.total_headcount : null
  const revenuePerEmp  = totalRevenue > 0 && headcount != null ? totalRevenue / headcount : null

  // YoY growth from total_revenue_by_year
  const revByYear  = metrics?.total_revenue_by_year ?? {}
  const years      = Object.keys(revByYear).sort()
  const yoyGrowth  = years.length >= 2
    ? ((revByYear[years[years.length - 1]] - revByYear[years[years.length - 2]]) / revByYear[years[years.length - 2]] * 100)
    : null

  // EBITDA margin
  const ebitdaMargin = totalRevenue > 0 ? (ebitda / totalRevenue) * 100 : 0

  // Total cost ratio: (COGS + OpEx) / Revenue — labelled as "Cost Ratio" in UI
  const totalCosts  = totalRevenue - ebitda
  const costRatio   = totalRevenue > 0 ? (totalCosts / totalRevenue) * 100 : 0

  // Revenue CAGR from sub_scores or metrics
  const cagr = metrics?.cagr_3yr ?? 0

  // Chart data from real monthly_revenue_24m
  const chartData = buildChartData(metrics?.monthly_revenue_24m)

  // Monthly average cost line for chart
  const monthlyCost = totalCosts / 12
  const chartWithExp = chartData.map(d => ({
    ...d,
    expenses: Math.round(monthlyCost),
  }))

  // ── Status helpers ─────────────────────────────────────────────────────────
  const yoyStatus     = yoyGrowth == null ? 'adequate'
    : yoyGrowth >= 20 ? 'strong' : yoyGrowth >= 10 ? 'adequate' : yoyGrowth >= 0 ? 'watch' : 'concern'
  // Field services: project-based revenue is normal; benchmark against project-based peers
  const recurringStatus = recurringRate >= 40 ? 'strong' : recurringRate >= 20 ? 'adequate' : recurringRate >= 5 ? 'watch' : 'concern'
  const ebitdaStatus    = ebitdaMargin >= 25 ? 'strong' : ebitdaMargin >= 15 ? 'adequate' : ebitdaMargin >= 8 ? 'watch' : 'concern'
  // Field services cost ratio benchmarks (includes COGS + OpEx)
  const costStatus      = costRatio <= 65 ? 'strong' : costRatio <= 75 ? 'adequate' : costRatio <= 85 ? 'watch' : 'concern'
  const empStatus       = revenuePerEmp == null ? 'adequate' : revenuePerEmp >= 220000 ? 'strong' : revenuePerEmp >= 130000 ? 'adequate' : 'watch'

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader
        title="Business Quality Assessment"
        subtitle="Internal operating truth derived from normalized data — source of record for all advisory analysis"
        action={<span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400">Internal Data · Source of Record</span>}
      />

      {!bannerDismissed && metrics?.total_opex_ttm === 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-[11px] text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span className="flex-1">
            <strong>Partial expense data:</strong> Only payroll costs available from Gusto. COGS, rent, software, and other operating expenses not ingested. Metrics reflect payroll-adjusted margins only.
          </span>
          <button
            onClick={() => setBannerDismissed(true)}
            className="flex-shrink-0 text-amber-400/60 hover:text-amber-400 transition-colors ml-1"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Revenue Growth YoY */}
        <MetricPanel
          label="Revenue Growth (YoY)"
          displayValue={yoyGrowth != null ? `${yoyGrowth.toFixed(1)}%` : '—'}
          benchmark="Directional benchmark — strong = above 15%, adequate = 5–15%"
          percentile={yoyGrowth != null ? (yoyGrowth >= 18 ? 82 : yoyGrowth >= 8 ? 62 : 40) : null}
          status={yoyStatus}
          trendDir={yoyGrowth != null ? (yoyGrowth >= 0 ? 'up' : 'down') : 'flat'}
          trendLabel={yoyGrowth != null ? `${yoyGrowth >= 0 ? '+' : ''}${yoyGrowth.toFixed(1)}% trailing 12 months` : 'Calculating…'}
        >
          <ResponsiveContainer width="100%" height={60}>
            <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="bqRevG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(160,84%,39%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(160,84%,39%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="revenue" stroke="hsl(160,84%,39%)" fill="url(#bqRevG)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </MetricPanel>

        {/* Recurring Revenue */}
        <MetricPanel
          label="Recurring Revenue %"
          displayValue={`${recurringRate.toFixed(0)}%`}
          benchmark="Directional — strong = 40%+, adequate = 20–40%, project-only = low"
          percentile={recurringRate >= 40 ? 75 : recurringRate >= 20 ? 50 : 25}
          status={recurringStatus}
          trendDir={recurringRate >= 20 ? 'up' : 'flat'}
          trendLabel={
            recurringRate === 0 ? 'No explicitly-tagged recurring revenue — project-based model'
            : recurringIsBehavioral ? `~${recurringRate.toFixed(0)}% estimated behavioral recurring (no explicit tags)`
            : recurringRate >= 20 ? 'Above field services median'
            : 'Below field services median'
          }
        >
          <div className="space-y-1.5 mt-1">
            <div className="h-2 bg-muted rounded-full">
              <div className="h-2 bg-emerald-500 rounded-full" style={{ width: `${Math.min(recurringRate, 100)}%` }} />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>0%</span><span className="text-amber-400">20% med</span><span className="text-emerald-400">40% UQ</span>
            </div>
          </div>
        </MetricPanel>

        {/* EBITDA Margin */}
        <MetricPanel
          label="EBITDA Margin"
          displayValue={ebitdaMargin > 0 ? `${ebitdaMargin.toFixed(1)}%` : '—'}
          benchmark="Directional — strong = 22%+, adequate = 13–22%, watch = below 10%"
          percentile={ebitdaMargin >= 35 ? 92 : ebitdaMargin >= 22 ? 75 : ebitdaMargin >= 13 ? 50 : 30}
          status={ebitdaStatus}
          trendDir="up"
          trendLabel={`${fmtM(ebitda)} EBITDA on ${fmtM(totalRevenue)} revenue`}
        >
          <div className="space-y-1.5 mt-1">
            <div className="h-2 bg-muted rounded-full">
              <div className="h-2 bg-emerald-500 rounded-full" style={{ width: `${Math.min((ebitdaMargin / 50) * 100, 100)}%` }} />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>0%</span><span className="text-amber-400">13% med</span><span className="text-emerald-400">22% UQ</span>
            </div>
          </div>
        </MetricPanel>

        {/* Cost Ratio */}
        <MetricPanel
          label="Cost Ratio (COGS + OpEx)"
          displayValue={costRatio > 0 ? `${costRatio.toFixed(1)}%` : '—'}
          benchmark="Directional — lower is better; strong = below 65%, watch = above 80%"
          percentile={costRatio <= 65 ? 80 : costRatio <= 75 ? 55 : 35}
          status={costStatus}
          trendDir={costRatio <= 75 ? 'up' : 'down'}
          trendLabel={headcount != null ? `${costRatio.toFixed(0)}% of revenue to direct costs · ${headcount} employees` : `${costRatio.toFixed(0)}% of revenue to direct costs`}
        >
          <div className="space-y-1.5">
            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-muted-foreground">This company</span>
                <span className={cn('font-bold', costRatio > 85 ? 'text-red-400' : costRatio > 75 ? 'text-amber-400' : 'text-emerald-400')}>{costRatio.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full">
                <div className={cn('h-1.5 rounded-full', costRatio > 85 ? 'bg-red-500' : costRatio > 75 ? 'bg-amber-500' : 'bg-emerald-500')}
                  style={{ width: `${Math.min((costRatio / 100) * 100, 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-muted-foreground">Field svc median</span>
                <span className="text-amber-400 font-bold">75%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full">
                <div className="h-1.5 bg-amber-500 rounded-full" style={{ width: '75%' }} />
              </div>
            </div>
          </div>
        </MetricPanel>

        {/* Revenue per Employee */}
        <MetricPanel
          label="Revenue per Employee"
          displayValue={revenuePerEmp != null ? fmtM(revenuePerEmp) : '—'}
          benchmark="Directional — strong = above $180K/employee, watch = below $100K"
          percentile={revenuePerEmp != null ? (revenuePerEmp >= 180000 ? 78 : revenuePerEmp >= 130000 ? 55 : 35) : null}
          status={empStatus}
          trendDir={revenuePerEmp != null ? (revenuePerEmp >= 130000 ? 'up' : 'down') : 'flat'}
          trendLabel={revenuePerEmp != null && headcount != null ? `${fmtM(revenuePerEmp)} per employee · ${headcount} headcount` : null}
        >
          <ResponsiveContainer width="100%" height={60}>
            <BarChart
              data={[
                { n: 'This Co.', v: revenuePerEmp != null ? Math.round(revenuePerEmp / 1000) : 0 },
                { n: 'Median',   v: 130 },
                { n: 'UQ',       v: 180 },
              ]}
              margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
            >
              <XAxis dataKey="n" tick={{ fontSize: 9, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} />
              <Bar dataKey="v" radius={[3, 3, 0, 0]} barSize={20}>
                <Cell fill="hsl(217,91%,60%)" />
                <Cell fill="hsl(220,18%,25%)" />
                <Cell fill="hsl(220,18%,25%)" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </MetricPanel>

        {/* Revenue CAGR */}
        <MetricPanel
          label="Revenue CAGR (3-Year)"
          displayValue={cagr > 0 ? `${cagr.toFixed(1)}%` : '—'}
          benchmark="Directional — strong = 15%+, adequate = 5–15%, flat/declining = watch"
          percentile={cagr >= 15 ? 80 : cagr >= 6 ? 60 : 35}
          status={cagr >= 15 ? 'strong' : cagr >= 6 ? 'adequate' : 'watch'}
          trendDir={cagr >= 6 ? 'up' : 'down'}
          trendLabel={years.length >= 2
            ? `${fmtM(revByYear[years[0]])} (${years[0]}) → ${fmtM(revByYear[years[years.length-1]])} (${years[years.length-1]})`
            : 'Computing…'}
        >
          <div className="space-y-1.5 mt-1">
            {years.slice(-3).map((yr, i) => (
              <div key={yr}>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="text-muted-foreground">{yr}</span>
                  <span className="text-foreground font-medium">{fmtM(revByYear[yr])}</span>
                </div>
                <div className="h-1 bg-muted rounded-full">
                  <div className="h-1 bg-blue-500 rounded-full transition-all"
                    style={{ width: `${(revByYear[yr] / Math.max(...Object.values(revByYear))) * 100}%`, opacity: 0.4 + i * 0.3 }} />
                </div>
              </div>
            ))}
          </div>
        </MetricPanel>
      </div>

      {/* AI DRS Score Interpretation */}
      <div className="rounded-xl border border-violet-500/20 bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-violet-500/15 bg-violet-500/5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">DRS Category Interpretation</h3>
              <p className="text-[10px] text-muted-foreground">Plain-English explanation of what each score means and what to do about it</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-semibold text-violet-400/70 uppercase tracking-wider">AI-Generated Analysis</span>
            <button
              onClick={generateAiInterpretation}
              disabled={aiLoading}
              className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 disabled:opacity-50 transition-colors"
            >
              {aiLoading
                ? <><RefreshCw className="w-3 h-3 animate-spin" /> Analyzing…</>
                : <><Sparkles className="w-3 h-3" /> {aiInsights ? 'Regenerate' : 'Analyze with AI'}</>
              }
            </button>
          </div>
        </div>
        <div className="p-5">
          {!aiInsights && !aiLoading && !aiError && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Click "Analyze with AI" to generate plain-English interpretation of each category score.
            </p>
          )}
          {aiLoading && (
            <div className="space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          )}
          {aiError && !aiLoading && (
            <p className="text-xs text-red-400/70 text-center py-4">{aiError}</p>
          )}
          {aiInsights && !aiLoading && (
            <div className="space-y-3">
              {Object.entries(aiInsights).map(([key, text]) => (
                <div key={key} className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-[10px] font-semibold text-violet-400/80 uppercase tracking-wider mb-1.5">
                    {CAT_LABELS[key] ?? key.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Revenue chart */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">Revenue vs Cost — Operating Consistency</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Trailing 12 months · {fmtM(totalRevenue)} TTM · Source: QuickBooks Online
            </p>
          </div>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded border border-border text-muted-foreground">Internal Data</span>
        </div>
        {chartWithExp.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartWithExp} margin={{ top: 5, right: 5, bottom: 0, left: 10 }}>
              <defs>
                <linearGradient id="bqRev2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(160,84%,39%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(160,84%,39%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="bqExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217,91%,60%)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(217,91%,60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} width={44} />
              <Tooltip
                content={({ active, payload, label }) => active && payload?.length ? (
                  <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs">
                    <p className="font-semibold text-foreground mb-1">{label}</p>
                    {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: ${(p.value/1000).toFixed(0)}K</p>)}
                  </div>
                ) : null}
              />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(160,84%,39%)" fill="url(#bqRev2)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="expenses" name="Avg Monthly Cost" stroke="hsl(217,91%,60%)" fill="url(#bqExp)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Loading chart data…</div>
        )}
      </div>
    </div>
  )
}
