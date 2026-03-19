import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/ui/PageHeader'
import KpiCard from '../components/ui/KpiCard'
import StatusBadge from '../components/ui/StatusBadge'
import SectionDivider from '../components/ui/SectionDivider'
import ProgressBar from '../components/ui/ProgressBar'
import { company, kpis as mockKpis, monthlyRevenue, customerConcentration, valueCreationLevers, marketBenchmarks } from '../lib/mockData'
import { fmtM } from '../lib/utils'

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

  // Overlay live data on mock KPIs when available
  const kpis = {
    ...mockKpis,
    drs:         liveScores?.drs?.base            ?? mockKpis.drs,
    currentEV:   liveScores?.enterprise_value?.midpoint ?? mockKpis.currentEV,
    potentialEV: liveScores?.enterprise_value?.ceiling  ?? mockKpis.potentialEV,
    valueGap:    liveScores
      ? (liveScores.enterprise_value?.ceiling - liveScores.enterprise_value?.midpoint)
      : mockKpis.valueGap,
    ebitdaMultiple: liveScores?.enterprise_value
      ? liveScores.enterprise_value.multiple_used?.split('–')?.[0] ?? mockKpis.ebitdaMultiple
      : mockKpis.ebitdaMultiple,
  }

  return (
    <div>
      {/* Company Header */}
      <div className="bg-card border border-border rounded-lg p-5 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg flex-shrink-0">
            {company.initials}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-card-foreground">{company.name}</h1>
              <StatusBadge variant="adequate">Active Engagement</StatusBadge>
              <StatusBadge variant="medium">Pre-Diligence</StatusBadge>
            </div>
            <p className="text-sm text-muted-foreground">
              {company.employees} employees · Founded {company.founded} · {company.industry}
            </p>
            <div className="flex items-center gap-6 mt-2">
              <span className="text-xs text-muted-foreground">Readiness <span className="text-card-foreground font-semibold">{kpis.drs}/100</span></span>
              <span className="text-xs text-muted-foreground">Est. EV <span className="text-primary font-semibold">{fmtM(kpis.currentEV)}</span></span>
            </div>
          </div>
        </div>

        {/* AI Summary Bar */}
        <div className="mt-4 flex items-center justify-between px-3 py-2 rounded-md bg-muted/50 border border-border">
          <span className="text-[11px] text-muted-foreground">Intelligence summary not generated · click to analyze</span>
          <button className="text-[11px] text-primary font-medium px-2 py-0.5 rounded hover:bg-primary/10 transition-colors">
            Analyze
          </button>
        </div>
      </div>

      {/* Intelligence Cards */}
      <div className="grid grid-cols-6 gap-3 mb-4">
        <KpiCard label="EBITDA"                  value={fmtM(kpis.ebitda)}          sublabel="Defensible (base)" />
        <KpiCard label="EBITDA Multiple"          value={`${kpis.ebitdaMultiple}x`}  sublabel="DRS-adjusted" />
        <KpiCard label="Current EV"               value={fmtM(kpis.currentEV)}       sublabel="Floor estimate" />
        <KpiCard label="Value Gap"                value={`+${fmtM(kpis.valueGap)}`}  sublabel="Addressable upside" />
        <KpiCard label="Potential EV"             value={fmtM(kpis.potentialEV)}     sublabel="At target DRS" />
        <KpiCard label="Diligence Readiness"      value={`${kpis.drs}/100`}          sublabel={`${kpis.drsPercentile}th percentile vs peers`} />
      </div>

      {/* 3-Column Content Grid */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Revenue Chart */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-card-foreground">Revenue vs Expenses T12M</p>
              <p className="text-[11px] text-muted-foreground">{fmtM(kpis.ttmRevenue)} TTM · <span className="text-primary">+{kpis.revenueGrowthYoY}% YoY</span></p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <ComposedChart data={monthlyRevenue} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'hsl(220 10% 46%)' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: 'hsl(220 18% 10%)', border: '1px solid hsl(220 18% 16%)', borderRadius: 6, fontSize: 11 }}
                formatter={(v) => fmtM(v)}
              />
              <Bar dataKey="revenue"  fill="hsl(160 84% 39% / 0.7)" radius={[2,2,0,0]} />
              <Bar dataKey="expenses" fill="hsl(220 18% 20%)"       radius={[2,2,0,0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Customer Concentration */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-card-foreground">Customer Concentration</p>
            <StatusBadge variant="watch">Watch</StatusBadge>
          </div>
          <div className="space-y-2">
            {customerConcentration.slice(0, 5).map((c) => (
              <div key={c.name}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] text-card-foreground truncate">{c.name}</span>
                  <span className="text-[11px] text-muted-foreground ml-2">{c.revenuePct}%</span>
                </div>
                <ProgressBar value={c.revenuePct * 3} />
              </div>
            ))}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Others (243)</span>
              <span className="text-[11px] text-muted-foreground">41%</span>
            </div>
          </div>
        </div>

        {/* Diligence Blockers */}
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-semibold text-card-foreground mb-3">Diligence Blockers</p>
          <div className="space-y-2.5">
            {[
              { label: 'Key Person Risk',        detail: '2 advisors own 71% of closed deals', sev: 'critical' },
              { label: 'Missing Contracts',       detail: 'Top 3 customers (44% revenue) have no signed agreements', sev: 'high' },
              { label: 'Customer Concentration',  detail: 'Acme Corp = 22% of revenue, no multi-year contract', sev: 'watch' },
            ].map((b) => (
              <div key={b.label} className="flex gap-2">
                <StatusBadge variant={b.sev}>{b.sev}</StatusBadge>
                <div>
                  <p className="text-[11px] font-medium text-card-foreground">{b.label}</p>
                  <p className="text-[10px] text-muted-foreground">{b.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/BuyerLens')}
            className="mt-3 text-[11px] text-primary font-medium"
          >
            Full risk profile →
          </button>
        </div>
      </div>

      {/* Value Creation Levers + Market Position */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-card border border-border rounded-lg p-4">
          <SectionDivider label="Value Creation Levers" />
          <div className="space-y-0">
            {valueCreationLevers.map((item) => (
              <div key={item.rank} className="flex items-center gap-4 py-2.5 border-b border-border last:border-0">
                <span className="text-[11px] font-bold text-muted-foreground w-4">{item.rank}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-card-foreground">{item.initiative}</p>
                  <p className="text-[10px] text-muted-foreground">{item.detail}</p>
                </div>
                <span className="text-xs font-semibold text-primary whitespace-nowrap">
                  +{fmtM(item.valueMin)}–{fmtM(item.valueMax)}
                </span>
                <span className="text-[10px] text-muted-foreground w-8">{item.timeline}</span>
                <StatusBadge variant={item.severity}>{item.severity}</StatusBadge>
              </div>
            ))}
          </div>
        </div>

        {/* Market Position */}
        <div className="bg-card border border-border rounded-lg p-4">
          <SectionDivider label="Market Position" />
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
                      <span className={`text-[11px] font-semibold ${above ? 'text-primary' : 'text-warning'}`}>
                        {b.company}{b.unit}
                      </span>
                      <span className={`text-[10px] ${above ? 'text-primary' : 'text-warning'}`}>
                        {above ? 'above' : 'watch'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">
            Overall: <span className="text-card-foreground font-medium">{kpis.drsPercentile}th percentile</span> vs $5M–$10M prof. services
          </p>
        </div>
      </div>
    </div>
  )
}
