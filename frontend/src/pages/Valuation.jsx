import { useState, useEffect } from 'react'
import SectionHeader from '../components/ui/SectionHeader'
import { cn, fmtM } from '../lib/utils'
import { TrendingUp, DollarSign, Zap, BarChart2, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Skeleton } from '../components/ui/Skeleton'

const COMPANY_ID = 1

export default function Valuation() {
  const [data, setData] = useState(null)
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    fetch(`/api/analytics/scores/${COMPANY_ID}`)
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
    fetch(`/api/analytics/metrics/${COMPANY_ID}`)
      .then(r => r.ok ? r.json() : null)
      .then(setMetrics)
      .catch(() => {})
  }, [])

  if (data === null || metrics === null) {
    return (
      <div className="space-y-5 max-w-[1400px]">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <Skeleton className="h-2 w-20" />
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-2 w-32" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-5 rounded-xl border border-border bg-card p-5 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
          </div>
          <div className="col-span-12 lg:col-span-7 rounded-xl border border-border bg-card p-5">
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    )
  }

  const ev = data?.enterprise_value
  const ebitda = ev?.ebitda_base ?? 0
  const floor = ev?.floor ?? 0
  const midpoint = ev?.midpoint ?? 0
  const ceiling = ev?.ceiling ?? 0
  const multipleUsed = ev?.multiple_used ?? '—'
  const drs = data?.drs?.base ?? 0
  const tier = data?.drs?.tier ?? '—'

  // Real metrics from /api/analytics/metrics/1
  const normalizedEBITDA = metrics?.ebitda_ttm ?? ebitda
  const totalRevenueTTM  = metrics?.total_revenue_ttm ?? 0
  const impliedPayroll   = totalRevenueTTM > 0 ? totalRevenueTTM - normalizedEBITDA : 0
  const ebitdaMarginReal = totalRevenueTTM > 0 ? (normalizedEBITDA / totalRevenueTTM) * 100 : 0

  // Estimated figures — no D&A/interest/tax data in dataset
  const reportedEBITDA = ebitda * 0.75   // estimated Operating Income (adj.)
  const taxNetIncome   = ebitda * 0.45   // estimated Net Income

  const headlines = [
    { label: 'Net Income (est.)',       value: fmtM(taxNetIncome),     sub: 'Estimated · Tax/interest not in dataset', color: 'blue',    icon: DollarSign },
    { label: 'Operating Income (adj.)', value: fmtM(reportedEBITDA),   sub: 'Estimated · D&A not in dataset',          color: 'purple',  icon: BarChart2  },
    { label: 'Normalized EBITDA',       value: fmtM(normalizedEBITDA), sub: 'After owner addbacks · Real from payroll', color: 'emerald', icon: Zap        },
    { label: 'Indicated EV (Midpoint)', value: fmtM(midpoint),         sub: `${multipleUsed}× EBITDA`,                 color: 'amber',   icon: TrendingUp },
  ]

  const colorMap = {
    blue:    { border: 'border-blue-500/20',    bg: 'bg-blue-500/5',    text: 'text-blue-400',    icon: 'text-blue-400/60'    },
    purple:  { border: 'border-purple-500/20',  bg: 'bg-purple-500/5',  text: 'text-purple-400',  icon: 'text-purple-400/60'  },
    emerald: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', text: 'text-emerald-400', icon: 'text-emerald-400/60' },
    amber:   { border: 'border-amber-500/20',   bg: 'bg-amber-500/5',   text: 'text-amber-400',   icon: 'text-amber-400/60'   },
  }

  const evScenarios = [
    { label: 'Conservative Floor', value: floor,    multiple: 5.0, note: 'Conservative addbacks, low multiple',  color: 'text-red-400'     },
    { label: 'Base Case',          value: midpoint,  multiple: 6.0, note: 'Normalized EBITDA × DRS multiple',     color: 'text-blue-400'    },
    { label: 'Optimistic Ceiling', value: ceiling,  multiple: 7.0, note: 'All addbacks defensible, top quartile', color: 'text-emerald-400' },
  ]

  const multiples = [4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5]
  // Use real normalizedEBITDA as base for sensitivity variants
  const ebitdaVariants = [-15, -10, -5, 0, 5, 10, 15].map(pct => ({
    label: `${pct >= 0 ? '+' : ''}${pct}%`,
    value: normalizedEBITDA * (1 + pct / 100),
  }))

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader
        title="EBITDA / EV Calculation Engine"
        subtitle="Tax Net Income → Reported EBITDA → Normalized EBITDA → Enterprise Value"
        action={
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
            DRS {drs.toFixed(1)} · {tier}
          </span>
        }
      />

      {/* Headline metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {headlines.map(c => {
          const cl = colorMap[c.color]
          const Icon = c.icon
          return (
            <div key={c.label} className={cn('rounded-xl border p-4 relative', cl.border, cl.bg)}>
              <Icon className={cn('w-4 h-4 absolute top-3 right-3', cl.icon)} />
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 pr-6 leading-tight">{c.label}</p>
              <p className={cn('text-xl font-bold leading-tight', cl.text)}>{c.value}</p>
              <p className="text-[11px] text-muted-foreground mt-1 leading-tight">{c.sub}</p>
            </div>
          )
        })}
      </div>

      {/* EBITDA Bridge */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">EBITDA Bridge</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Normalization walk from TTM revenue to defensible EBITDA — real values from Gusto payroll data</p>
          </div>
          <span className="text-[9px] font-semibold px-2 py-0.5 rounded border border-border text-muted-foreground">Payroll Data</span>
        </div>

        <div className="space-y-2 font-mono text-xs mb-4">
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-muted-foreground">TTM Revenue</span>
            <span className="font-semibold text-foreground">{totalRevenueTTM > 0 ? fmtM(totalRevenueTTM) : '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-muted-foreground">− Implied Payroll</span>
            <span className="font-semibold text-red-400">
              {impliedPayroll > 0 ? `(${fmtM(impliedPayroll)})` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="font-semibold text-foreground">= Defensible EBITDA</span>
            <span className="font-bold text-emerald-400">{normalizedEBITDA > 0 ? fmtM(normalizedEBITDA) : '—'}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 pl-4">
            <span className="text-muted-foreground">EBITDA Margin</span>
            <span className="font-semibold text-emerald-400">
              {ebitdaMarginReal > 0 ? `${ebitdaMarginReal.toFixed(1)}%` : '—'}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-[11px] text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Data limitation:</strong> COGS, rent, software, and professional fees are not available in the current dataset. EBITDA margin reflects a payroll-only cost structure. True margin will be lower once full operating expenses are ingested.
          </span>
        </div>
      </div>

      {/* EV Range bar */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">Enterprise Value Range</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Floor · Midpoint · Ceiling based on EBITDA scenarios and DRS-adjusted multiple</p>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">{multipleUsed}× range</span>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={[
            { name: 'Floor',    value: floor    },
            { name: 'Midpoint', value: midpoint },
            { name: 'Ceiling',  value: ceiling  },
          ]} margin={{ top: 5, right: 20, bottom: 0, left: 20 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(220,10%,50%)' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={({ active, payload }) => active && payload?.length ? (
              <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs">
                <p className="font-bold text-foreground">{fmtM(payload[0].value)}</p>
              </div>
            ) : null} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={80}>
              <Cell fill="hsl(0,72%,51%)" fillOpacity={0.7} />
              <Cell fill="hsl(160,84%,39%)" fillOpacity={1} />
              <Cell fill="hsl(160,84%,39%)" fillOpacity={0.7} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-3 gap-4 mt-2 pt-4 border-t border-border">
          {evScenarios.map(s => (
            <div key={s.label} className="text-center">
              <p className="text-[10px] text-muted-foreground mb-1">{s.label}</p>
              <p className={cn('text-lg font-bold', s.color)}>{fmtM(s.value)}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{s.multiple}× · {s.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sensitivity Matrix */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-card-foreground">Sensitivity Matrix — EBITDA × Multiple</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Enterprise value at each EBITDA scenario and multiple combination · Base EBITDA from real payroll data</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr>
                <th className="text-left text-muted-foreground py-2 pr-4 font-semibold uppercase tracking-wider">EBITDA</th>
                {multiples.map(m => <th key={m} className="text-center text-muted-foreground py-2 px-2 font-semibold">{m}×</th>)}
              </tr>
            </thead>
            <tbody>
              {ebitdaVariants.map(e => (
                <tr key={e.label} className="border-t border-border/50">
                  <td className="py-2 pr-4 font-semibold text-muted-foreground">{e.label} ({fmtM(e.value)})</td>
                  {multiples.map(m => {
                    const val = e.value * m
                    const isBase = e.label === '+0%' && (m === 6.0)
                    const color = val >= ceiling ? 'text-emerald-400' : val <= floor ? 'text-red-400' : 'text-foreground'
                    return (
                      <td key={m} className={cn('text-center py-2 px-2 font-medium', color, isBase && 'font-bold bg-primary/10 rounded')}>
                        {fmtM(val)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
