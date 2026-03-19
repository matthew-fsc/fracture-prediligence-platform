import { useState } from 'react'
import { cn } from '../lib/utils'
import { fmtM } from '../lib/utils'
import { AlertTriangle, TrendingDown, TrendingUp, Activity, UserMinus, Shield } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { kpis as mockKpis } from '../lib/mockData'

const BASE = {
  revenue:  mockKpis.ttmRevenue,
  ebitda:   mockKpis.ebitda,
  multiple: 6.0,
  ev:       mockKpis.currentEV,
}

const SCENARIOS = [
  {
    id: 'top_customer_loss', label: 'Loss of Top Customer', icon: UserMinus, color: 'red',
    description: 'Top customer (22% of revenue) terminates relationship',
    params: [
      { id: 'customer_pct',    label: 'Customer Revenue Share',    min: 5,  max: 45, step: 1,  default: 22, unit: '%' },
      { id: 'recovery_months', label: 'Recovery Timeline (months)', min: 3,  max: 36, step: 3,  default: 12, unit: 'mo' },
    ],
    compute: (p) => {
      const lost = BASE.revenue * (p.customer_pct / 100)
      const newEbitda = (BASE.revenue - lost) * 0.22
      const mHit = p.customer_pct > 20 ? -0.8 : p.customer_pct > 15 ? -0.4 : -0.2
      const newEV = Math.max(BASE.multiple + mHit, 2.5) * newEbitda
      return { revenueImpact: -lost, ebitdaImpact: newEbitda - BASE.ebitda, multipleImpact: mHit, evImpact: newEV - BASE.ev, newEV, severity: p.customer_pct > 20 ? 'critical' : 'high' }
    },
  },
  {
    id: 'key_employee', label: 'Key Employee Departure', icon: UserMinus, color: 'amber',
    description: 'Senior advisor responsible for 35%+ of deal origination departs',
    params: [
      { id: 'deal_pct',         label: 'Deal Attribution',          min: 10, max: 60, step: 5,  default: 35, unit: '%' },
      { id: 'replacement_cost', label: 'Replacement Cost ($K)',     min: 50, max: 500, step: 25, default: 150, unit: 'K' },
    ],
    compute: (p) => {
      const atRisk = BASE.revenue * (p.deal_pct / 100) * 0.4
      const repCost = p.replacement_cost * 1000
      const ebitdaHit = atRisk * 0.22 + repCost
      const mHit = p.deal_pct > 30 ? -0.5 : -0.2
      const newEV = (BASE.multiple + mHit) * (BASE.ebitda - ebitdaHit)
      return { revenueImpact: -atRisk, ebitdaImpact: -ebitdaHit, multipleImpact: mHit, evImpact: newEV - BASE.ev, newEV, severity: p.deal_pct > 40 ? 'critical' : 'high' }
    },
  },
  {
    id: 'margin_compression', label: 'Margin Compression', icon: TrendingDown, color: 'amber',
    description: 'Pricing pressure or cost inflation reduces margins',
    params: [
      { id: 'margin_reduction', label: 'Margin Reduction (pp)', min: 1, max: 15, step: 0.5, default: 5, unit: 'pp' },
      { id: 'duration_months',  label: 'Duration (months)',    min: 3, max: 24, step: 3,   default: 6, unit: 'mo' },
    ],
    compute: (p) => {
      const eHit = BASE.revenue * (p.margin_reduction / 100)
      const newEbitda = BASE.ebitda - eHit
      const mHit = p.margin_reduction > 8 ? -0.3 : -0.1
      const newEV = (BASE.multiple + mHit) * newEbitda
      return { revenueImpact: 0, ebitdaImpact: -eHit, multipleImpact: mHit, evImpact: newEV - BASE.ev, newEV, severity: p.margin_reduction > 8 ? 'critical' : 'warning' }
    },
  },
  {
    id: 'security_incident', label: 'Security Incident', icon: Shield, color: 'red',
    description: 'Data breach or ransomware during diligence process',
    params: [
      { id: 'breach_severity',   label: 'Incident Severity (1-10)', min: 1, max: 10, step: 1,  default: 6,   unit: ''  },
      { id: 'remediation_cost',  label: 'Remediation Cost ($K)',    min: 25, max: 500, step: 25, default: 100, unit: 'K' },
    ],
    compute: (p) => {
      const remCost = p.remediation_cost * 1000
      const repHit = BASE.revenue * (p.breach_severity / 100) * 0.3
      const eHit = remCost + repHit * 0.22
      const mHit = p.breach_severity > 7 ? -1.0 : p.breach_severity > 4 ? -0.5 : -0.2
      const newEV = (BASE.multiple + mHit) * (BASE.ebitda - eHit)
      return { revenueImpact: -repHit, ebitdaImpact: -eHit, multipleImpact: mHit, evImpact: newEV - BASE.ev, newEV, severity: p.breach_severity > 7 ? 'critical' : 'high' }
    },
  },
  {
    id: 'revenue_growth', label: 'Revenue Growth Change', icon: TrendingUp, color: 'emerald',
    description: 'Model acceleration or deceleration in revenue trajectory',
    params: [
      { id: 'growth_rate', label: 'New Annual Growth Rate', min: -20, max: 50, step: 2, default: 20, unit: '%' },
      { id: 'years',       label: 'Projection Period (years)', min: 1, max: 5, step: 1, default: 2, unit: 'yr' },
    ],
    compute: (p) => {
      const newRev = BASE.revenue * Math.pow(1 + p.growth_rate / 100, p.years)
      const newEbitda = newRev * 0.22
      const mBonus = p.growth_rate > 20 ? 0.5 : p.growth_rate > 10 ? 0.3 : p.growth_rate < 0 ? -0.5 : 0
      const newEV = (BASE.multiple + mBonus) * newEbitda
      return { revenueImpact: newRev - BASE.revenue, ebitdaImpact: newEbitda - BASE.ebitda, multipleImpact: mBonus, evImpact: newEV - BASE.ev, newEV, severity: p.growth_rate < 0 ? 'warning' : 'positive' }
    },
  },
]

const colorMap = {
  red: 'border-red-500/30 bg-red-500/5', amber: 'border-amber-500/30 bg-amber-500/5', emerald: 'border-emerald-500/30 bg-emerald-500/5',
}
const iconColor = { red: 'text-red-400', amber: 'text-amber-400', emerald: 'text-emerald-400' }
const sevColor = {
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  high: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  positive: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
}

export default function ScenarioSimulator() {
  const [activeScenario, setActiveScenario] = useState(SCENARIOS[0].id)
  const [params, setParams] = useState(() => {
    const p = {}
    SCENARIOS.forEach(s => s.params.forEach(param => { p[`${s.id}_${param.id}`] = param.default }))
    return p
  })

  const scenario = SCENARIOS.find(s => s.id === activeScenario)
  const scenarioParams = {}
  scenario.params.forEach(p => { scenarioParams[p.id] = params[`${activeScenario}_${p.id}`] })
  const result = scenario.compute(scenarioParams)

  const waterfall = [
    { name: 'Current EV',  value: BASE.ev,       fill: 'hsl(217,91%,60%)' },
    { name: 'EBITDA Δ',    value: Math.abs(result.ebitdaImpact), fill: result.ebitdaImpact >= 0 ? 'hsl(160,84%,39%)' : 'hsl(0,72%,51%)' },
    { name: 'Multiple Δ',  value: Math.abs(result.multipleImpact * BASE.ebitda), fill: result.multipleImpact >= 0 ? 'hsl(160,84%,39%)' : 'hsl(0,72%,51%)' },
    { name: 'Scenario EV', value: result.newEV,   fill: 'hsl(217,91%,60%)' },
  ]

  return (
    <div className="space-y-4 max-w-[1400px]">
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-0.5">Intelligence</p>
        <h1 className="text-xl font-bold text-foreground">Scenario Simulator</h1>
        <p className="text-sm text-muted-foreground">Model adverse events and quantify their valuation impact in real time</p>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Scenario selector */}
        <div className="col-span-12 lg:col-span-3 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Select Scenario</p>
          {SCENARIOS.map(s => {
            const Icon = s.icon
            const active = activeScenario === s.id
            return (
              <button key={s.id} onClick={() => setActiveScenario(s.id)}
                className={cn('w-full text-left rounded-xl border p-3 transition-all',
                  active ? colorMap[s.color] : 'border-border bg-card hover:bg-muted/30')}>
                <div className="flex items-center gap-2 mb-0.5">
                  <Icon className={cn('w-3.5 h-3.5', active ? iconColor[s.color] : 'text-muted-foreground')} />
                  <p className={cn('text-xs font-semibold', active ? 'text-foreground' : 'text-muted-foreground')}>{s.label}</p>
                </div>
                <p className="text-[9px] text-muted-foreground leading-snug pl-5">{s.description}</p>
              </button>
            )
          })}
        </div>

        {/* Parameters + results */}
        <div className="col-span-12 lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-primary" /> Scenario Parameters
            </p>
            <div className="space-y-5">
              {scenario.params.map(param => {
                const key = `${activeScenario}_${param.id}`
                const val = params[key]
                return (
                  <div key={param.id}>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-muted-foreground">{param.label}</span>
                      <span className="font-bold text-foreground">{val}{param.unit}</span>
                    </div>
                    <input
                      type="range" min={param.min} max={param.max} step={param.step} value={val}
                      onChange={e => setParams(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                      className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                      <span>{param.min}{param.unit}</span><span>{param.max}{param.unit}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold text-foreground mb-3">Simulation Output</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              {[
                { label: 'Revenue Impact', val: result.revenueImpact, isPos: result.revenueImpact >= 0 },
                { label: 'EBITDA Impact',  val: result.ebitdaImpact,  isPos: result.ebitdaImpact >= 0  },
                { label: 'Multiple Change', val: result.multipleImpact, isPos: result.multipleImpact >= 0, fmt: v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}x` },
                { label: 'EV Impact',      val: result.evImpact,      isPos: result.evImpact >= 0      },
              ].map(c => (
                <div key={c.label} className="p-2.5 rounded-lg border border-border bg-secondary/30">
                  <p className="text-[9px] text-muted-foreground mb-0.5">{c.label}</p>
                  <p className={cn('text-sm font-bold', c.isPos ? 'text-emerald-400' : 'text-red-400')}>
                    {c.fmt ? c.fmt(c.val) : `${c.isPos ? '+' : '-'}${fmtM(Math.abs(c.val))}`}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/50">
              <div>
                <p className="text-[10px] text-muted-foreground">Scenario Enterprise Value</p>
                <p className="text-xl font-bold text-foreground">{fmtM(result.newEV)}</p>
              </div>
              <div className="text-right">
                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase', sevColor[result.severity])}>{result.severity}</span>
                <p className={cn('text-sm font-bold mt-1', result.evImpact >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {result.evImpact >= 0 ? '+' : '-'}{fmtM(Math.abs(result.evImpact))}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Visualization */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold text-foreground mb-3">Enterprise Value Impact</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={waterfall} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={({ active, payload }) => active && payload?.length ? (
                  <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs">
                    <p className="font-semibold text-foreground mb-1">{payload[0].payload.name}</p>
                    <p className="font-bold" style={{ color: payload[0].payload.fill }}>{fmtM(payload[0].value)}</p>
                  </div>
                ) : null} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={48}>
                  {waterfall.map((e, i) => <Cell key={i} fill={e.fill} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold text-foreground mb-2">Baseline vs Scenario</p>
            <div className="space-y-2">
              {[
                { label: 'Revenue',  base: fmtM(BASE.revenue),  scen: fmtM(BASE.revenue + result.revenueImpact),   delta: result.revenueImpact  },
                { label: 'EBITDA',   base: fmtM(BASE.ebitda),   scen: fmtM(BASE.ebitda + result.ebitdaImpact),     delta: result.ebitdaImpact   },
                { label: 'Multiple', base: `${BASE.multiple}×`, scen: `${(BASE.multiple + result.multipleImpact).toFixed(1)}×`, delta: result.multipleImpact },
                { label: 'EV',       base: fmtM(BASE.ev),       scen: fmtM(result.newEV),                          delta: result.evImpact       },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between text-[10px] py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-muted-foreground">{r.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground/50">{r.base}</span>
                    <span className={cn('font-bold', r.delta >= 0 ? 'text-emerald-400' : 'text-red-400')}>{r.scen}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
