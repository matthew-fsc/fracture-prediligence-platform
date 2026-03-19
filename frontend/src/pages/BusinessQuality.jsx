import { useState, useEffect } from 'react'
import SectionHeader from '../components/ui/SectionHeader'
import { cn } from '../lib/utils'
import { fmtM } from '../lib/utils'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'

const COMPANY_ID = 1

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
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className={cn('text-2xl font-bold mt-0.5', c.value)}>{displayValue}</p>
        </div>
        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase', c.badge)}>{status}</span>
      </div>
      <div className="min-h-[60px]">{children}</div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">{benchmark}</span>
        {percentile != null && <span className={cn('font-bold', c.value)}>{percentile}th pctile</span>}
      </div>
      {trendLabel && (
        <p className={cn('text-[10px]', trendDir === 'up' ? 'text-emerald-400' : trendDir === 'down' ? 'text-red-400' : 'text-muted-foreground')}>
          {trendDir === 'up' ? '↑' : trendDir === 'down' ? '↓' : '→'} {trendLabel}
        </p>
      )}
    </div>
  )
}

export default function BusinessQuality() {
  const [scores, setScores] = useState(null)
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    fetch(`/api/analytics/scores/${COMPANY_ID}`)
      .then(r => r.ok ? r.json() : null)
      .then(setScores)
      .catch(() => {})
    fetch(`/api/analytics/metrics/${COMPANY_ID}`)
      .then(r => r.ok ? r.json() : null)
      .then(setMetrics)
      .catch(() => {})
  }, [])

  // ── Derived values from real API ──────────────────────────────────────────
  const cats = scores?.category_scores ?? {}

  const totalRevenue   = metrics?.total_revenue_ttm ?? 0
  const ebitda         = metrics?.ebitda_ttm ?? 0
  const recurringRate  = metrics?.recurring_revenue_pct ?? cats.revenue_quality?.sub_scores?.recurring_rate?.value ?? 0
  const revenuePerEmp  = metrics?.revenue_per_employee ?? 0
  const headcount      = metrics?.total_headcount ?? 0

  // YoY growth from total_revenue_by_year
  const revByYear  = metrics?.total_revenue_by_year ?? {}
  const years      = Object.keys(revByYear).sort()
  const yoyGrowth  = years.length >= 2
    ? ((revByYear[years[years.length - 1]] - revByYear[years[years.length - 2]]) / revByYear[years[years.length - 2]] * 100)
    : null

  // EBITDA margin (payroll-adjusted — no other opex in dataset)
  const ebitdaMargin   = totalRevenue > 0 ? (ebitda / totalRevenue) * 100 : 0

  // Implied payroll ratio: revenue - EBITDA = payroll (when no other opex tracked)
  const impliedPayroll = totalRevenue - ebitda
  const payrollRatio   = totalRevenue > 0 ? (impliedPayroll / totalRevenue) * 100 : 0

  // Revenue CAGR from sub_scores or metrics
  const cagr = metrics?.cagr_3yr ?? 0

  // Chart data from real monthly_revenue_24m
  const chartData = buildChartData(metrics?.monthly_revenue_24m)

  // Estimated monthly payroll for chart comparison line
  const monthlyPayroll = impliedPayroll / 12

  const chartWithExp = chartData.map(d => ({
    ...d,
    expenses: Math.round(monthlyPayroll),
  }))

  // ── Status helpers ─────────────────────────────────────────────────────────
  const yoyStatus = yoyGrowth == null ? 'adequate'
    : yoyGrowth >= 20 ? 'strong' : yoyGrowth >= 10 ? 'adequate' : yoyGrowth >= 0 ? 'watch' : 'concern'
  const recurringStatus = recurringRate >= 75 ? 'strong' : recurringRate >= 55 ? 'adequate' : recurringRate >= 40 ? 'watch' : 'concern'
  const ebitdaStatus    = ebitdaMargin >= 25 ? 'strong' : ebitdaMargin >= 15 ? 'adequate' : ebitdaMargin >= 8 ? 'watch' : 'concern'
  const payrollStatus   = payrollRatio <= 27 ? 'strong' : payrollRatio <= 33 ? 'adequate' : payrollRatio <= 42 ? 'watch' : 'concern'
  const empStatus       = revenuePerEmp >= 220000 ? 'strong' : revenuePerEmp >= 165000 ? 'adequate' : 'watch'

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader
        title="Business Quality Assessment"
        subtitle="Internal operating truth derived from normalized data — source of record for all advisory analysis"
        action={<span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400">Internal Data · Source of Record</span>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Revenue Growth YoY */}
        <MetricPanel
          label="Revenue Growth (YoY)"
          displayValue={yoyGrowth != null ? `${yoyGrowth.toFixed(1)}%` : '—'}
          benchmark="8% industry median · 18% top quartile"
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
          benchmark="55% median · 75% top quartile"
          percentile={recurringRate >= 75 ? 82 : recurringRate >= 55 ? 58 : 35}
          status={recurringStatus}
          trendDir={recurringRate >= 55 ? 'up' : 'down'}
          trendLabel={recurringRate >= 55 ? 'Above industry median' : 'Below industry median'}
        >
          <div className="space-y-1.5 mt-1">
            <div className="h-2 bg-muted rounded-full">
              <div className="h-2 bg-emerald-500 rounded-full" style={{ width: `${Math.min(recurringRate, 100)}%` }} />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>0%</span><span className="text-amber-400">55% med</span><span className="text-emerald-400">75% UQ</span>
            </div>
          </div>
        </MetricPanel>

        {/* EBITDA Margin */}
        <MetricPanel
          label="EBITDA Margin (Payroll-Adj.)"
          displayValue={ebitdaMargin > 0 ? `${ebitdaMargin.toFixed(1)}%` : '—'}
          benchmark="13% median · 22% top quartile"
          percentile={ebitdaMargin >= 35 ? 92 : ebitdaMargin >= 22 ? 75 : ebitdaMargin >= 13 ? 50 : 30}
          status={ebitdaStatus}
          trendDir="up"
          trendLabel="Payroll-only cost base (COGS not available)"
        >
          <div className="space-y-1.5 mt-1">
            <div className="h-2 bg-muted rounded-full">
              <div className="h-2 bg-emerald-500 rounded-full" style={{ width: `${Math.min((ebitdaMargin / 50) * 100, 100)}%` }} />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>0%</span><span className="text-amber-400">13% med</span><span className="text-emerald-400">22% UQ</span>
            </div>
          </div>
        </MetricPanel>

        {/* Payroll Ratio */}
        <MetricPanel
          label="Payroll Ratio"
          displayValue={payrollRatio > 0 ? `${payrollRatio.toFixed(1)}%` : '—'}
          benchmark="33% median · 27% top quartile"
          percentile={payrollRatio <= 27 ? 80 : payrollRatio <= 33 ? 55 : 35}
          status={payrollStatus}
          trendDir={payrollRatio <= 33 ? 'up' : 'down'}
          trendLabel={payrollRatio > 0 ? `${payrollRatio.toFixed(0)}% of revenue to payroll (${headcount} employees)` : 'No payroll data'}
        >
          <div className="space-y-1.5">
            <div>
              <div className="flex justify-between text-[10px] mb-0.5">
                <span className="text-muted-foreground">This company</span>
                <span className={cn('font-bold', payrollRatio > 33 ? 'text-amber-400' : 'text-emerald-400')}>{payrollRatio.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full">
                <div className={cn('h-1.5 rounded-full', payrollRatio > 40 ? 'bg-red-500' : payrollRatio > 33 ? 'bg-amber-500' : 'bg-emerald-500')}
                  style={{ width: `${Math.min((payrollRatio / 60) * 100, 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] mb-0.5">
                <span className="text-muted-foreground">Market median</span>
                <span className="text-amber-400 font-bold">33%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full">
                <div className="h-1.5 bg-amber-500 rounded-full" style={{ width: `${(33/60)*100}%` }} />
              </div>
            </div>
          </div>
        </MetricPanel>

        {/* Revenue per Employee */}
        <MetricPanel
          label="Revenue per Employee"
          displayValue={revenuePerEmp > 0 ? `$${Math.round(revenuePerEmp / 1000)}K` : '—'}
          benchmark="$165K median · $220K top quartile"
          percentile={revenuePerEmp >= 220000 ? 78 : revenuePerEmp >= 165000 ? 58 : 35}
          status={empStatus}
          trendDir={revenuePerEmp >= 165000 ? 'up' : 'down'}
          trendLabel={`$${Math.round(revenuePerEmp / 1000)}K per employee · ${headcount} headcount`}
        >
          <ResponsiveContainer width="100%" height={60}>
            <BarChart
              data={[
                { n: 'This Co.', v: revenuePerEmp > 0 ? Math.round(revenuePerEmp / 1000) : 0 },
                { n: 'Median',   v: 165 },
                { n: 'UQ',       v: 220 },
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
          benchmark="6% industry median · 15% top quartile"
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
                <div className="flex justify-between text-[10px] mb-0.5">
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

      {/* Revenue chart */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">Revenue vs Payroll — Operating Consistency</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Trailing 12 months · {fmtM(totalRevenue)} TTM · Source: QuickBooks Online + Gusto
            </p>
          </div>
          <span className="text-[9px] font-semibold px-2 py-0.5 rounded border border-border text-muted-foreground">Internal Data</span>
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
              <Area type="monotone" dataKey="expenses" name="Payroll (monthly avg)" stroke="hsl(217,91%,60%)" fill="url(#bqExp)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Loading chart data…</div>
        )}
      </div>
    </div>
  )
}
