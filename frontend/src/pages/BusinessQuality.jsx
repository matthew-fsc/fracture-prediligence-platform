import { useState, useEffect } from 'react'
import SectionHeader from '../components/ui/SectionHeader'
import { cn } from '../lib/utils'
import { fmtM } from '../lib/utils'
import { monthlyRevenue, kpis as mockKpis } from '../lib/mockData'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'

const COMPANY_ID = 1

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
        {percentile && <span className={cn('font-bold', c.value)}>{percentile}th pctile</span>}
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

  useEffect(() => {
    fetch(`/api/analytics/scores/${COMPANY_ID}`)
      .then(r => r.ok ? r.json() : null)
      .then(setScores)
      .catch(() => {})
  }, [])

  const cats = scores?.category_scores ?? {}
  const recurringRate = cats.revenue_quality?.sub_scores?.recurring_rate?.value ?? mockKpis.recurringRevenuePct
  const revenuePerEmp = cats.management_team?.sub_scores?.size?.value ?? mockKpis.ttmRevenue / 13

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader
        title="Business Quality Assessment"
        subtitle="Internal operating truth derived from normalized data — source of record for all advisory analysis"
        action={<span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400">Internal Data · Source of Record</span>}
      />

      {/* Metric panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricPanel
          label="Revenue Growth (YoY)"
          displayValue={`${mockKpis.revenueGrowthYoY}%`}
          benchmark="8% industry median · 18% top quartile"
          percentile={62}
          status="adequate"
          trendDir="up"
          trendLabel="+12.7% trailing 12 months"
        >
          <ResponsiveContainer width="100%" height={60}>
            <AreaChart data={monthlyRevenue} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
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

        <MetricPanel
          label="Recurring Revenue %"
          displayValue={`${recurringRate.toFixed(0)}%`}
          benchmark="55% median · 75% top quartile"
          percentile={58}
          status={recurringRate >= 75 ? 'strong' : recurringRate >= 55 ? 'adequate' : recurringRate >= 40 ? 'watch' : 'concern'}
          trendDir="up"
          trendLabel="Above industry median"
        >
          <div className="space-y-1.5 mt-1">
            <div className="h-2 bg-muted rounded-full">
              <div className="h-2 bg-emerald-500 rounded-full" style={{ width: `${recurringRate}%` }} />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>0%</span><span className="text-amber-400">55% med</span><span className="text-emerald-400">75% UQ</span>
            </div>
          </div>
        </MetricPanel>

        <MetricPanel
          label="Gross Margin"
          displayValue={`${mockKpis.grossMargin}%`}
          benchmark="38% median · 52% top quartile"
          percentile={55}
          status={mockKpis.grossMargin >= 52 ? 'strong' : mockKpis.grossMargin >= 38 ? 'adequate' : 'watch'}
          trendDir="up"
          trendLabel="Above median for professional services"
        >
          <div className="space-y-1.5 mt-1">
            <div className="h-2 bg-muted rounded-full">
              <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${(mockKpis.grossMargin / 70) * 100}%` }} />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>0%</span><span className="text-amber-400">38% med</span><span className="text-emerald-400">52% UQ</span>
            </div>
          </div>
        </MetricPanel>

        <MetricPanel
          label="Payroll Ratio"
          displayValue={`${mockKpis.payrollRatio}%`}
          benchmark="33% median · 27% top quartile"
          percentile={35}
          status="watch"
          trendDir="down"
          trendLabel="500bps above 33% benchmark"
        >
          <div className="space-y-1.5 mt-1">
            <div>
              <div className="flex justify-between text-[10px] mb-0.5">
                <span className="text-muted-foreground">This company</span>
                <span className="text-red-400 font-bold">{mockKpis.payrollRatio}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full"><div className="h-1.5 bg-red-500 rounded-full" style={{ width: '76%' }} /></div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] mb-0.5">
                <span className="text-muted-foreground">Market median</span>
                <span className="text-amber-400 font-bold">33%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full"><div className="h-1.5 bg-amber-500 rounded-full" style={{ width: '66%' }} /></div>
            </div>
          </div>
        </MetricPanel>

        <MetricPanel
          label="Revenue per Employee"
          displayValue={fmtM(revenuePerEmp)}
          benchmark="$165K median · $220K top quartile"
          percentile={48}
          status={revenuePerEmp >= 220000 ? 'strong' : revenuePerEmp >= 165000 ? 'adequate' : 'watch'}
          trendDir="up"
          trendLabel={`$${Math.round(revenuePerEmp/1000)}K per employee`}
        >
          <ResponsiveContainer width="100%" height={60}>
            <BarChart data={[{ n: 'This Co.', v: revenuePerEmp/1000 }, { n: 'Median', v: 165 }, { n: 'UQ', v: 220 }]} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="n" tick={{ fontSize: 9, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} />
              <Bar dataKey="v" radius={[3, 3, 0, 0]} barSize={20}>
                <Cell fill="hsl(217,91%,60%)" />
                <Cell fill="hsl(220,18%,25%)" />
                <Cell fill="hsl(220,18%,25%)" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </MetricPanel>

        <MetricPanel
          label="EBITDA Margin"
          displayValue={scores ? `${((scores.enterprise_value.ebitda_base / (scores.enterprise_value.ebitda_base / 0.22)) * 100).toFixed(1)}%` : `${mockKpis.ebitda ? ((mockKpis.ebitda / mockKpis.ttmRevenue) * 100).toFixed(1) : '22.0'}%`}
          benchmark="13% median · 22% top quartile"
          percentile={68}
          status="strong"
          trendDir="up"
          trendLabel="Above top quartile"
        >
          <div className="space-y-1.5 mt-1">
            <div className="h-2 bg-muted rounded-full">
              <div className="h-2 bg-emerald-500 rounded-full" style={{ width: '75%' }} />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>0%</span><span className="text-amber-400">13% med</span><span className="text-emerald-400">22% UQ</span>
            </div>
          </div>
        </MetricPanel>
      </div>

      {/* Revenue vs Expense chart */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">Revenue vs Expenses — Operating Consistency</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Trailing 12 months · Source: QuickBooks Online</p>
          </div>
          <span className="text-[9px] font-semibold px-2 py-0.5 rounded border border-border text-muted-foreground">Internal Data</span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={monthlyRevenue} margin={{ top: 5, right: 5, bottom: 0, left: 10 }}>
            <defs>
              <linearGradient id="bqRev2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(160,84%,39%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(160,84%,39%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="bqExp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(0,72%,51%)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(0,72%,51%)" stopOpacity={0} />
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
            <Area type="monotone" dataKey="expenses" name="Expenses" stroke="hsl(0,72%,51%)" fill="url(#bqExp)" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
