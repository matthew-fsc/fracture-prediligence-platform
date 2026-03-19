import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import SectionHeader from '../components/ui/SectionHeader'
import { cn } from '../lib/utils'
import { fmtM } from '../lib/utils'
import { company, kpis as mockKpis, monthlyRevenue, customerConcentration, valueCreationLevers, marketBenchmarks } from '../lib/mockData'
import { ArrowRight, TrendingUp } from 'lucide-react'

const COMPANY_ID = 1

export default function CompanyWorkspace() {
  const navigate = useNavigate()
  const [liveScores, setLiveScores] = useState(null)

  useEffect(() => {
    fetch(`/api/analytics/scores/${COMPANY_ID}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setLiveScores(d))
      .catch(() => {})
  }, [])

  const kpis = {
    ...mockKpis,
    drs:         liveScores?.drs?.base                    ?? mockKpis.drs,
    ebitda:      liveScores?.enterprise_value?.ebitda_base ?? mockKpis.ebitda,
    currentEV:   liveScores?.enterprise_value?.midpoint    ?? mockKpis.currentEV,
    potentialEV: liveScores?.enterprise_value?.ceiling     ?? mockKpis.potentialEV,
    valueGap:    liveScores
      ? Math.max(0, (liveScores.enterprise_value?.ceiling ?? 0) - (liveScores.enterprise_value?.midpoint ?? 0))
      : mockKpis.valueGap,
    ebitdaMultiple: liveScores?.enterprise_value?.multiple_used ?? mockKpis.ebitdaMultiple,
  }

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
        <div className="mt-4 flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 border border-border">
          <span className="text-[11px] text-muted-foreground">Intelligence summary not generated · click to analyze</span>
          <button className="text-[11px] text-primary font-medium px-2 py-0.5 rounded hover:bg-primary/10 transition-colors">Analyze</button>
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
              <p className="text-[11px] text-muted-foreground">{fmtM(kpis.ttmRevenue)} TTM · <span className="text-emerald-400">+{kpis.revenueGrowthYoY}% YoY</span></p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={monthlyRevenue} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
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

        {/* Customer concentration */}
        <div className="rounded-xl border border-amber-500/20 bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-card-foreground">Customer Concentration</p>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-500/20 bg-amber-500/10 text-amber-400">Watch</span>
          </div>
          <div className="space-y-2.5">
            {customerConcentration.slice(0, 5).map((c) => (
              <div key={c.name}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] text-card-foreground truncate">{c.name}</span>
                  <span className="text-[11px] text-muted-foreground ml-2 flex-shrink-0">{c.revenuePct}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full">
                  <div className={cn('h-1.5 rounded-full', c.revenuePct > 20 ? 'bg-red-500' : c.revenuePct > 10 ? 'bg-amber-500' : 'bg-emerald-500')}
                    style={{ width: `${c.revenuePct * 3}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Diligence blockers */}
        <div className="rounded-xl border border-red-500/20 bg-card p-4">
          <p className="text-xs font-semibold text-card-foreground mb-3">Diligence Blockers</p>
          <div className="space-y-2.5">
            {[
              { label: 'Key Person Risk',       detail: '2 advisors own 71% of closed deals',                      sev: 'critical' },
              { label: 'Missing Contracts',      detail: 'Top 3 customers (44% revenue) have no signed agreements', sev: 'high'     },
              { label: 'Customer Concentration', detail: 'Acme Corp = 22% of revenue, no multi-year contract',      sev: 'watch'    },
            ].map((b) => (
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
          <button onClick={() => navigate('/BuyerLens')}
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
            {valueCreationLevers.map((item) => (
              <div key={item.rank} className="flex items-center gap-4 py-2.5 border-b border-border last:border-0">
                <span className="text-[11px] font-bold text-muted-foreground w-4 flex-shrink-0">{item.rank}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-card-foreground">{item.initiative}</p>
                  <p className="text-[10px] text-muted-foreground">{item.detail}</p>
                </div>
                <span className="text-xs font-semibold text-emerald-400 whitespace-nowrap flex-shrink-0">
                  +{fmtM(item.valueMin)}–{fmtM(item.valueMax)}
                </span>
                <span className="text-[10px] text-muted-foreground w-8 flex-shrink-0">{item.timeline}</span>
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
          <p className="text-[10px] text-muted-foreground mb-3">Source: PitchBook · 248 peers</p>
          <div className="space-y-3">
            {marketBenchmarks.map((b) => {
              const above = b.direction === 'higher_better' ? b.company > b.median : b.company < b.median
              return (
                <div key={b.metric}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-muted-foreground">{b.metric}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">med {b.median}{b.unit}</span>
                      <span className={cn('text-[11px] font-semibold', above ? 'text-emerald-400' : 'text-amber-400')}>
                        {b.company}{b.unit}
                      </span>
                    </div>
                  </div>
                  <div className="h-1 bg-muted rounded-full">
                    <div className={cn('h-1 rounded-full', above ? 'bg-emerald-500' : 'bg-amber-500')}
                      style={{ width: `${Math.min((b.company / (b.median * 2)) * 100, 100)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">
            Overall: <span className="text-foreground font-medium">{kpis.drsPercentile}th percentile</span> vs $5M–$10M prof. services
          </p>
        </div>
      </div>
    </div>
  )
}
