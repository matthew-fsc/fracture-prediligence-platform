import { useState, useEffect } from 'react'
import SectionHeader from '../components/ui/SectionHeader'
import { cn } from '../lib/utils'
import { fmtM } from '../lib/utils'
import { Target, ChevronDown, ChevronRight, Clock } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { valueCreationLevers, kpis as mockKpis } from '../lib/mockData'

const COMPANY_ID = 1

const catColors = {
  operations:    { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/20'     },
  revenue:       { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/20'    },
  margin:        { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  documentation: { bg: 'bg-purple-500/10', text: 'text-purple-400',  border: 'border-purple-500/20'  },
  customer:      { bg: 'bg-amber-500/10',  text: 'text-amber-400',   border: 'border-amber-500/20'   },
}

function DriverCard({ d, rank }) {
  const [open, setOpen] = useState(false)
  const cat = catColors[d.category] || catColors.revenue
  return (
    <div className={cn('rounded-xl border bg-card transition-all', cat.border)}>
      <button className="w-full text-left p-4" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-3">
          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold', cat.bg, cat.text)}>
            {rank}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-card-foreground">{d.initiative || d.label}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{d.detail || d.description}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold text-emerald-400">
              {d.valueMin != null ? `${fmtM(d.valueMin)}–${fmtM(d.valueMax)}` : `+${fmtM(d.ev_uplift)}`}
            </p>
            <p className="text-[10px] text-muted-foreground">{d.timeline || d.months + 'mo'} timeline</p>
          </div>
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-border pt-4 space-y-3">
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div className="rounded-lg bg-secondary/50 p-3">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Current State</p>
              <p className="text-card-foreground">{d.detail || d.description || '—'}</p>
            </div>
            <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Target State</p>
              <p className="text-card-foreground">{d.target || 'Resolve identified risk'}</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Value Range</p>
              <p className="text-emerald-400 font-bold">
                {d.valueMin != null ? `${fmtM(d.valueMin)} – ${fmtM(d.valueMax)}` : `+${fmtM(d.ev_uplift)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{d.timeline || d.months + 'mo'} to realize</span>
            {d.severity && <span className={cn('font-medium px-1.5 py-0.5 rounded text-[9px] border uppercase',
              d.severity === 'critical' ? 'border-red-500/20 bg-red-500/10 text-red-400' :
              d.severity === 'high' ? 'border-amber-500/20 bg-amber-500/10 text-amber-400' :
              'border-border bg-muted text-muted-foreground')}>{d.severity}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ValueGap() {
  const [liveData, setLiveData] = useState(null)
  const [gapData, setGapData] = useState(null)

  useEffect(() => {
    fetch(`/api/analytics/scores/${COMPANY_ID}`)
      .then(r => r.ok ? r.json() : null)
      .then(setLiveData)
      .catch(() => {})
    fetch(`/api/analytics/value-gap/${COMPANY_ID}`)
      .then(r => r.ok ? r.json() : null)
      .then(setGapData)
      .catch(() => {})
  }, [])

  const ev = liveData?.enterprise_value
  const currentEV = ev?.midpoint ?? mockKpis.currentEV
  const ceilingEV = ev?.ceiling ?? mockKpis.potentialEV
  const floorEV = ev?.floor ?? (mockKpis.currentEV * 0.83)
  const valueGap = Math.max(0, ceilingEV - currentEV)
  const ebitda = ev?.ebitda_base ?? mockKpis.ebitda

  // Use live gap data if available, fall back to mock valueCreationLevers
  const drivers = gapData?.gaps
    ? gapData.gaps.map((g, i) => ({
        initiative: g.label,
        detail: `Score ${g.current_score} → ${g.target_score}`,
        valueMin: g.ev_uplift * 0.7,
        valueMax: g.ev_uplift,
        ev_uplift: g.ev_uplift,
        timeline: '9mo',
        severity: g.priority <= 1 ? 'critical' : g.priority <= 2 ? 'high' : 'medium',
        category: i === 0 ? 'operations' : i === 1 ? 'revenue' : i === 2 ? 'margin' : 'documentation',
        months: 9,
      }))
    : valueCreationLevers.map(d => ({
        ...d,
        category: d.rank <= 2 ? 'operations' : d.rank === 3 ? 'margin' : d.rank === 4 ? 'revenue' : 'documentation',
        months: parseInt(d.timeline) || 9,
      }))

  const waterfallData = [
    { name: 'Current EV', value: currentEV, type: 'base' },
    ...drivers.slice(0, 4).map(d => ({
      name: (d.initiative || '').split(' ').slice(0, 2).join(' '),
      value: d.valueMax || d.ev_uplift || 0,
      type: 'add',
    })),
    { name: 'Potential EV', value: ceilingEV, type: 'total' },
  ]

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader
        title="Value Gap Analysis"
        subtitle="The difference between what the business is worth today and what it could be worth with targeted improvements"
        action={
          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
            <Target className="w-3 h-3" />+{fmtM(valueGap)} opportunity
          </span>
        }
      />

      {/* EV bridge cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 space-y-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Current Enterprise Value</p>
          <p className="text-3xl font-bold text-blue-400">{fmtM(currentEV)}</p>
          <div className="space-y-1.5 text-xs border-t border-border pt-3">
            <div className="flex justify-between"><span className="text-muted-foreground">EBITDA (TTM)</span><span className="font-bold text-card-foreground">{fmtM(ebitda)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Implied Multiple</span><span className="font-bold text-blue-400">{ev?.multiple_used ?? '6.0×'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">DRS Tier</span><span className="text-muted-foreground text-[10px]">{liveData?.drs?.tier ?? 'Investment Grade'}</span></div>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 flex flex-col items-center justify-center gap-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Value Gap</p>
          <p className="text-4xl font-bold text-emerald-400">+{fmtM(valueGap)}</p>
          <p className="text-xs text-muted-foreground text-center">realizable through targeted operational improvements</p>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-blue-400">{fmtM(currentEV)}</span>
            <span className="text-muted-foreground">→</span>
            <span className="text-emerald-400 font-bold">{fmtM(ceilingEV)}</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full mt-1">
            <div className="h-1.5 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full" style={{ width: '72%' }} />
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Potential Enterprise Value</p>
          <p className="text-3xl font-bold text-emerald-400">{fmtM(ceilingEV)}</p>
          <div className="space-y-1.5 text-xs border-t border-border pt-3">
            <div className="flex justify-between"><span className="text-muted-foreground">Target EBITDA</span><span className="font-bold text-card-foreground">{fmtM(ebitda * 1.15)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Target Multiple</span><span className="font-bold text-emerald-400">7.0×</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">All initiatives complete</span><span className="text-muted-foreground text-[10px]">18–24 months</span></div>
          </div>
        </div>
      </div>

      {/* Bridge chart */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-card-foreground mb-4">Value Creation Bridge</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={waterfallData} margin={{ top: 5, right: 5, bottom: 0, left: 10 }}>
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000000).toFixed(1)}M`} width={46} />
            <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
              <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs">
                <p className="font-semibold text-foreground mb-1">{label}</p>
                <p className="font-bold text-emerald-400">{fmtM(payload[0].value)}</p>
              </div>
            ) : null} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={60}>
              {waterfallData.map((e, i) => (
                <Cell key={i}
                  fill={e.type === 'base' ? 'hsl(217,91%,60%)' : e.type === 'total' ? 'hsl(160,84%,39%)' : 'hsl(160,84%,39%)'}
                  fillOpacity={e.type === 'add' ? 0.7 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Driver cards */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Value Gap Drivers — Ranked by Impact</h3>
        <div className="space-y-3">
          {drivers.map((d, i) => <DriverCard key={d.initiative || i} d={d} rank={i + 1} />)}
        </div>
      </div>
    </div>
  )
}
