import { useState, useEffect } from 'react'
import SectionHeader from '../components/ui/SectionHeader'
import { cn, fmtM } from '../lib/utils'
import { TrendingDown, TrendingUp, Activity, UserMinus, Shield, User } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { apiClient } from '../lib/apiClient'

const COMPANY_ID = 1

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
  const [base, setBase] = useState(null)
  const [topCustomer, setTopCustomer] = useState({ name: 'Top Customer', pct: 22 })
  const [ownerHours, setOwnerHours] = useState(40)
  const [activeScenario, setActiveScenario] = useState('top_customer_loss')

  // Per-scenario param state
  const [params, setParams] = useState({
    top_customer_loss_recovery_months: 12,
    top_customer_loss_revenue_pct: 22,
    key_employee_deal_pct: 35,
    key_employee_replacement_cost: 150,
    margin_compression_margin_reduction: 5,
    margin_compression_duration_months: 6,
    security_incident_breach_severity: 6,
    security_incident_remediation_cost: 100,
    revenue_growth_growth_rate: 20,
    revenue_growth_years: 2,
    owner_departure_reduced_hours: 10,
  })

  useEffect(() => {
    Promise.all([
      apiClient.get(`/api/analytics/metrics/${COMPANY_ID}`),
      apiClient.get(`/api/analytics/scores/${COMPANY_ID}`),
    ]).then(([metrics, scores]) => {
      if (!metrics || !scores) return
      const ev = scores.enterprise_value
      const midMultiple = ev?.midpoint && metrics.ebitda_ttm > 0
        ? ev.midpoint / metrics.ebitda_ttm : 6.0
      setBase({
        revenue:  metrics.total_revenue_ttm,
        ebitda:   metrics.ebitda_ttm,
        multiple: parseFloat(midMultiple.toFixed(1)),
        ev:       ev?.midpoint ?? 0,
      })
      // Top customer from customer_risk
      const cr = scores.category_scores?.customer_risk
      if (cr?.top_customer_name && cr?.top_customer_pct != null) {
        setTopCustomer({ name: cr.top_customer_name, pct: cr.top_customer_pct })
        setParams(p => ({ ...p, top_customer_loss_revenue_pct: Math.round(cr.top_customer_pct) }))
      }
      // Owner hours from qualitative if available (default 40)
      const opsSubs = scores.category_scores?.operational_independence?.sub_scores ?? {}
      if (opsSubs.owner_hours?.value != null) {
        const h = Number(opsSubs.owner_hours.value)
        setOwnerHours(h)
        setParams(p => ({ ...p, owner_departure_reduced_hours: Math.max(0, Math.round(h * 0.25)) }))
      }
    }).catch(() => {})
  }, [])

  const liveBase = base ?? { revenue: 0, ebitda: 0, multiple: 6.0, ev: 0 }
  const p = params

  // ── Compute functions ──────────────────────────────────────────────────────

  const computeTopCustomerLoss = () => {
    const pct = p.top_customer_loss_revenue_pct
    const ebitdaMargin = liveBase.ebitda / (liveBase.revenue || 1)
    const lost = liveBase.revenue * (pct / 100)
    const newEbitda = (liveBase.revenue - lost) * ebitdaMargin
    const mHit = pct > 20 ? -0.8 : pct > 15 ? -0.4 : -0.2
    const newEV = Math.max(liveBase.multiple + mHit, 2.5) * newEbitda
    const drsHit = pct > 20 ? -8 : pct > 15 ? -4 : -2
    return { revenueImpact: -lost, ebitdaImpact: newEbitda - liveBase.ebitda, multipleImpact: mHit, evImpact: newEV - liveBase.ev, newEV, drsHit, severity: pct > 20 ? 'critical' : 'high' }
  }

  const computeKeyEmployee = () => {
    const ebitdaMargin = liveBase.ebitda / (liveBase.revenue || 1)
    const atRisk = liveBase.revenue * (p.key_employee_deal_pct / 100) * 0.4
    const repCost = p.key_employee_replacement_cost * 1000
    const ebitdaHit = atRisk * ebitdaMargin + repCost
    const mHit = p.key_employee_deal_pct > 30 ? -0.5 : -0.2
    const newEV = (liveBase.multiple + mHit) * (liveBase.ebitda - ebitdaHit)
    return { revenueImpact: -atRisk, ebitdaImpact: -ebitdaHit, multipleImpact: mHit, evImpact: newEV - liveBase.ev, newEV, drsHit: -3, severity: p.key_employee_deal_pct > 40 ? 'critical' : 'high' }
  }

  const computeMarginCompression = () => {
    const eHit = liveBase.revenue * (p.margin_compression_margin_reduction / 100)
    const newEbitda = liveBase.ebitda - eHit
    const mHit = p.margin_compression_margin_reduction > 8 ? -0.3 : -0.1
    const newEV = (liveBase.multiple + mHit) * newEbitda
    return { revenueImpact: 0, ebitdaImpact: -eHit, multipleImpact: mHit, evImpact: newEV - liveBase.ev, newEV, drsHit: -2, severity: p.margin_compression_margin_reduction > 8 ? 'critical' : 'warning' }
  }

  const computeSecurityIncident = () => {
    const ebitdaMargin = liveBase.ebitda / (liveBase.revenue || 1)
    const remCost = p.security_incident_remediation_cost * 1000
    const repHit = liveBase.revenue * (p.security_incident_breach_severity / 100) * 0.3
    const eHit = remCost + repHit * ebitdaMargin
    const mHit = p.security_incident_breach_severity > 7 ? -1.0 : p.security_incident_breach_severity > 4 ? -0.5 : -0.2
    const newEV = (liveBase.multiple + mHit) * (liveBase.ebitda - eHit)
    return { revenueImpact: -repHit, ebitdaImpact: -eHit, multipleImpact: mHit, evImpact: newEV - liveBase.ev, newEV, drsHit: -4, severity: p.security_incident_breach_severity > 7 ? 'critical' : 'high' }
  }

  const computeRevenueGrowth = () => {
    const ebitdaMargin = liveBase.ebitda / (liveBase.revenue || 1)
    const newRev = liveBase.revenue * Math.pow(1 + p.revenue_growth_growth_rate / 100, p.revenue_growth_years)
    const newEbitda = newRev * ebitdaMargin
    const mBonus = p.revenue_growth_growth_rate > 20 ? 0.5 : p.revenue_growth_growth_rate > 10 ? 0.3 : p.revenue_growth_growth_rate < 0 ? -0.5 : 0
    const newEV = (liveBase.multiple + mBonus) * newEbitda
    return { revenueImpact: newRev - liveBase.revenue, ebitdaImpact: newEbitda - liveBase.ebitda, multipleImpact: mBonus, evImpact: newEV - liveBase.ev, newEV, drsHit: mBonus > 0 ? 3 : -4, severity: p.revenue_growth_growth_rate < 0 ? 'warning' : 'positive' }
  }

  const computeOwnerDeparture = () => {
    const reducedHours = p.owner_departure_reduced_hours
    const currentHours = ownerHours || 40
    // Score at current hours vs reduced hours
    const hourScore = h => h <= 5 ? 90 : h <= 15 ? 75 : h <= 25 ? 55 : h <= 40 ? 35 : 10
    const currentScore = hourScore(currentHours)
    const reducedScore = hourScore(reducedHours)
    const scoreDelta = reducedScore - currentScore  // positive = improvement
    // Operational independence weight in DRS = 20%
    const drsDelta = scoreDelta * 0.20
    // Multiple impact: better ops independence = +multiple
    const mHit = drsDelta > 0 ? Math.min(drsDelta / 20, 0.5) : Math.max(drsDelta / 10, -0.8)
    const newEV = (liveBase.multiple + mHit) * liveBase.ebitda
    return {
      revenueImpact: 0,
      ebitdaImpact: 0,
      multipleImpact: mHit,
      evImpact: newEV - liveBase.ev,
      newEV,
      drsHit: Math.round(drsDelta),
      currentOpsScore: currentScore,
      newOpsScore: reducedScore,
      severity: mHit < -0.3 ? 'critical' : mHit < 0 ? 'high' : 'positive',
    }
  }

  const SCENARIOS = [
    { id: 'top_customer_loss', label: `Loss of Top Customer`, icon: UserMinus, color: 'red',
      description: `${topCustomer.name} (${topCustomer.pct.toFixed(0)}% of revenue) reduces or terminates`,
      compute: computeTopCustomerLoss,
      params: [
        { id: 'revenue_pct', key: 'top_customer_loss_revenue_pct', label: `${topCustomer.name} Revenue Share`, min: 5, max: 60, step: 1, unit: '%' },
        { id: 'recovery_months', key: 'top_customer_loss_recovery_months', label: 'Recovery Timeline', min: 3, max: 36, step: 3, unit: 'mo' },
      ],
    },
    { id: 'owner_departure', label: 'Owner Departure / Transition', icon: User, color: 'red',
      description: `Owner reduces availability from ${ownerHours}hrs/week to modeled level`,
      compute: computeOwnerDeparture,
      params: [
        { id: 'reduced_hours', key: 'owner_departure_reduced_hours', label: 'Owner Available Hours After', min: 0, max: ownerHours || 40, step: 5, unit: 'hrs/wk' },
      ],
    },
    { id: 'key_employee', label: 'Key Employee Departure', icon: UserMinus, color: 'amber',
      description: 'Senior advisor responsible for deal origination departs',
      compute: computeKeyEmployee,
      params: [
        { id: 'deal_pct', key: 'key_employee_deal_pct', label: 'Deal Attribution', min: 10, max: 60, step: 5, unit: '%' },
        { id: 'replacement_cost', key: 'key_employee_replacement_cost', label: 'Replacement Cost ($K)', min: 50, max: 500, step: 25, unit: 'K' },
      ],
    },
    { id: 'margin_compression', label: 'Margin Compression', icon: TrendingDown, color: 'amber',
      description: 'Pricing pressure or cost inflation reduces margins',
      compute: computeMarginCompression,
      params: [
        { id: 'margin_reduction', key: 'margin_compression_margin_reduction', label: 'Margin Reduction (pp)', min: 1, max: 15, step: 0.5, unit: 'pp' },
        { id: 'duration_months', key: 'margin_compression_duration_months', label: 'Duration (months)', min: 3, max: 24, step: 3, unit: 'mo' },
      ],
    },
    { id: 'security_incident', label: 'Security Incident', icon: Shield, color: 'red',
      description: 'Data breach or ransomware during diligence process',
      compute: computeSecurityIncident,
      params: [
        { id: 'breach_severity', key: 'security_incident_breach_severity', label: 'Incident Severity (1–10)', min: 1, max: 10, step: 1, unit: '' },
        { id: 'remediation_cost', key: 'security_incident_remediation_cost', label: 'Remediation Cost ($K)', min: 25, max: 500, step: 25, unit: 'K' },
      ],
    },
    { id: 'revenue_growth', label: 'Revenue Growth Change', icon: TrendingUp, color: 'emerald',
      description: 'Model acceleration or deceleration in revenue trajectory',
      compute: computeRevenueGrowth,
      params: [
        { id: 'growth_rate', key: 'revenue_growth_growth_rate', label: 'New Annual Growth Rate', min: -20, max: 50, step: 2, unit: '%' },
        { id: 'years', key: 'revenue_growth_years', label: 'Projection Period (years)', min: 1, max: 5, step: 1, unit: 'yr' },
      ],
    },
  ]

  const scenario = SCENARIOS.find(s => s.id === activeScenario)
  const result = base ? scenario.compute() : { revenueImpact: 0, ebitdaImpact: 0, multipleImpact: 0, evImpact: 0, newEV: 0, drsHit: 0, severity: 'high' }

  const waterfall = [
    { name: 'Current EV', value: liveBase.ev, fill: 'hsl(217,91%,60%)' },
    { name: 'EBITDA Δ', value: Math.abs(result.ebitdaImpact), fill: result.ebitdaImpact >= 0 ? 'hsl(160,84%,39%)' : 'hsl(0,72%,51%)' },
    { name: 'Multiple Δ', value: Math.abs(result.multipleImpact * liveBase.ebitda), fill: result.multipleImpact >= 0 ? 'hsl(160,84%,39%)' : 'hsl(0,72%,51%)' },
    { name: 'Scenario EV', value: result.newEV, fill: 'hsl(217,91%,60%)' },
  ]

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader
        title="Scenario Simulator"
        subtitle="Advisory Risk Scenarios — Not a Forecast. Model adverse events and quantify their valuation impact in real time."
        action={
          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400">
            {SCENARIOS.length} scenarios
          </span>
        }
      />

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
                const val = params[param.key]
                return (
                  <div key={param.id}>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-muted-foreground">{param.label}</span>
                      <span className="font-bold text-foreground">{val}{param.unit}</span>
                    </div>
                    <input type="range" min={param.min} max={param.max} step={param.step} value={val}
                      onChange={e => setParams(prev => ({ ...prev, [param.key]: Number(e.target.value) }))}
                      className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary" />
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
                { label: 'EBITDA Impact',  val: result.ebitdaImpact,  isPos: result.ebitdaImpact >= 0 },
                { label: 'Multiple Change', val: result.multipleImpact, isPos: result.multipleImpact >= 0, fmt: v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}×` },
                { label: 'DRS Impact', val: result.drsHit ?? 0, isPos: (result.drsHit ?? 0) >= 0, fmt: v => `${v >= 0 ? '+' : ''}${v.toFixed(0)} pts` },
              ].map(c => (
                <div key={c.label} className="p-2.5 rounded-lg border border-border bg-secondary/30">
                  <p className="text-[9px] text-muted-foreground mb-0.5">{c.label}</p>
                  <p className={cn('text-sm font-bold', c.isPos ? 'text-emerald-400' : 'text-red-400')}>
                    {c.fmt ? c.fmt(c.val) : `${c.isPos ? '+' : '-'}${fmtM(Math.abs(c.val))}`}
                  </p>
                </div>
              ))}
            </div>
            {activeScenario === 'owner_departure' && result.currentOpsScore != null && (
              <div className="mb-3 p-2.5 rounded-lg border border-border bg-secondary/30 text-[10px]">
                <p className="text-muted-foreground mb-1">Operational Independence Score</p>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Current ({ownerHours}hrs): <span className="font-bold text-foreground">{result.currentOpsScore}</span></span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-muted-foreground">Scenario ({params.owner_departure_reduced_hours}hrs): <span className={cn('font-bold', result.newOpsScore > result.currentOpsScore ? 'text-emerald-400' : 'text-red-400')}>{result.newOpsScore}</span></span>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/50">
              <div>
                <p className="text-[10px] text-muted-foreground">Scenario Enterprise Value</p>
                <p className="text-xl font-bold text-foreground">{fmtM(result.newEV)}</p>
              </div>
              <div className="text-right">
                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase', sevColor[result.severity])}>{result.severity}</span>
                <p className={cn('text-sm font-bold mt-1', result.evImpact >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {result.evImpact >= 0 ? '+' : '-'}{fmtM(Math.abs(result.evImpact))}
                  {liveBase.ev > 0 && <span className="text-[10px] text-muted-foreground ml-1">({((result.evImpact / liveBase.ev) * 100).toFixed(1)}%)</span>}
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
                { label: 'Revenue',  base: fmtM(liveBase.revenue),  scen: fmtM(liveBase.revenue + result.revenueImpact),  delta: result.revenueImpact },
                { label: 'EBITDA',   base: fmtM(liveBase.ebitda),   scen: fmtM(liveBase.ebitda + result.ebitdaImpact),    delta: result.ebitdaImpact },
                { label: 'Multiple', base: `${liveBase.multiple}×`, scen: `${(liveBase.multiple + result.multipleImpact).toFixed(1)}×`, delta: result.multipleImpact },
                { label: 'EV',       base: fmtM(liveBase.ev),       scen: fmtM(result.newEV),                             delta: result.evImpact },
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

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-[9px] font-bold text-amber-400 uppercase tracking-wider mb-1">Advisory Risk Scenarios — Not a Forecast</p>
            <p className="text-[9px] text-muted-foreground leading-relaxed">These scenarios are modeling tools for advisor-client conversations, not predictions. Multiple adjustments reflect market convention, not guaranteed outcomes.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
