import { useState, useEffect } from 'react'
import SectionHeader from '../components/ui/SectionHeader'
import { cn } from '../lib/utils'
import { AlertTriangle, ChevronDown, ChevronRight, Edit2, Check, X, Info } from 'lucide-react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts'
import { Skeleton } from '../components/ui/Skeleton'
import { apiClient } from '../lib/apiClient'

const COMPANY_ID = 1

const DEFAULT_CATEGORY_META = {
  revenue_quality:          { label: 'Revenue Quality',          weight: 25, abbr: 'Revenue' },
  financial_integrity:      { label: 'Financial Integrity',      weight: 20, abbr: 'Financial' },
  operational_independence: { label: 'Operational Independence', weight: 20, abbr: 'Operations' },
  customer_risk:            { label: 'Customer Risk',            weight: 15, abbr: 'Customer' },
  management_team:          { label: 'Management & Team',        weight: 10, abbr: 'Management' },
  growth_drivers:           { label: 'Growth Drivers',          weight: 10, abbr: 'Growth' },
}

// Sub-score weights per Blueprint II
const SUBWEIGHTS = {
  revenue_quality: {
    recurring_rate:  { weight: 30, label: 'Recurring Revenue Rate' },
    concentration:   { weight: 25, label: 'Customer Concentration (HHI)' },
    durability:      { weight: 20, label: 'Contract Durability' },
    consistency:     { weight: 15, label: 'Revenue Consistency (CV)' },
    nrr:             { weight: 10, label: 'Net Revenue Retention' },
  },
  financial_integrity: {
    addback_exposure:      { weight: 35, label: 'Owner Add-Back Exposure' },
    expense_completeness:  { weight: 25, label: 'Expense Categorization' },
    revenue_completeness:  { weight: 20, label: 'Revenue Data Completeness' },
    data_coverage:         { weight: 20, label: 'Historical Data Coverage' },
  },
  operational_independence: {
    owner_comp:        { weight: 35, label: 'Owner Compensation Concentration' },
    key_person:        { weight: 25, label: 'Key Person Dependency' },
    management_depth:  { weight: 25, label: 'Management Layer Depth' },
    staff_stability:   { weight: 15, label: 'Staff Stability' },
    owner_hours:       { weight: 35, label: 'Owner Hours in Operations' },
    sop_documentation: { weight: 30, label: 'SOP Documentation Score' },
    process_automation:{ weight: 15, label: 'Process Automation Level' },
    management_depth_ratio: { weight: 20, label: 'Management Depth Ratio' },
  },
  customer_risk: {
    concentration:   { weight: 35, label: 'Top Customer Concentration' },
    diversification: { weight: 25, label: 'Customer Count & Diversification' },
    churn:           { weight: 25, label: 'Churn / Inactive Rate' },
    tenure:          { weight: 15, label: 'Average Customer Tenure' },
  },
  management_team: {
    completeness:  { weight: 30, label: 'Management Completeness' },
    size:          { weight: 25, label: 'Team Size Adequacy' },
    ownership:     { weight: 25, label: 'Ownership Concentration' },
    role_coverage: { weight: 20, label: 'Key Role Coverage' },
  },
  growth_drivers: {
    revenue_cagr:        { weight: 40, label: 'Revenue CAGR' },
    new_customers:       { weight: 30, label: 'New Customer Acquisition' },
    contract_pipeline:   { weight: 30, label: 'Contract Pipeline Coverage' },
    pipeline_coverage:   { weight: 30, label: 'Pipeline Coverage Ratio' },
    market_positioning:  { weight: 20, label: 'Market Positioning' },
    product_repeatability:{ weight: 15, label: 'Product/Service Repeatability' },
  },
}

function scoreColor(s) {
  if (s >= 75) return 'text-emerald-400'
  if (s >= 55) return 'text-amber-400'
  return 'text-red-400'
}
function barColor(s) {
  if (s >= 75) return 'bg-emerald-500'
  if (s >= 55) return 'bg-amber-500'
  return 'bg-red-500'
}
function tierLabel(s) {
  if (s >= 85) return { label: 'Institutional Grade', color: 'emerald' }
  if (s >= 70) return { label: 'Investment Grade',    color: 'emerald' }
  if (s >= 55) return { label: 'Needs Work',          color: 'amber' }
  if (s >= 40) return { label: 'High Risk',           color: 'red' }
  return       { label: 'Not Saleable',               color: 'red' }
}

// ── Sub-score breakdown card ─────────────────────────────────────────────────
function SubScoreRow({ subKey, sub, meta }) {
  const weight = meta?.weight ?? 0
  const pts = ((sub.score ?? 0) * weight / 100).toFixed(1)
  const source = sub.source ?? 'financial_data'
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0 text-[10px]">
      <div className="w-4 h-4 flex-shrink-0 mt-0.5">
        <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5', sub.score >= 75 ? 'bg-emerald-500' : sub.score >= 55 ? 'bg-amber-500' : 'bg-red-500')} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="font-semibold text-foreground">{meta?.label ?? subKey.replace(/_/g,' ')}</span>
          <span className="text-muted-foreground bg-muted px-1 rounded font-mono">{weight}%</span>
          {source === 'advisor_input' && (
            <span className="text-[8px] font-bold px-1 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400">Advisor Input</span>
          )}
          {source === 'financial_data' && (
            <span className="text-[8px] text-muted-foreground/60">Financial Data</span>
          )}
        </div>
        <p className="text-muted-foreground">{sub.label}</p>
      </div>
      <div className="text-right flex-shrink-0 ml-2">
        <p className={cn('font-bold', scoreColor(sub.score ?? 0))}>{(sub.score ?? 0).toFixed(0)}</p>
        <p className="text-muted-foreground">→ {pts} pts</p>
      </div>
    </div>
  )
}

// ── Override panel ───────────────────────────────────────────────────────────
function OverridePanel({ catKey, rawScore, adjScore, override, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [adj, setAdj]         = useState(override?.adjustment ?? 0)
  const [rationale, setRationale] = useState(override?.rationale ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!rationale.trim()) return
    setSaving(true)
    try {
      await apiClient.post(`/api/analytics/overrides/${COMPANY_ID}/${catKey}`, { adjustment: adj, rationale })
      onSave()
      setEditing(false)
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    await apiClient.del(`/api/analytics/overrides/${COMPANY_ID}/${catKey}`)
    onDelete()
    setEditing(false)
    setAdj(0)
    setRationale('')
  }

  const hasOverride = override && override.adjustment !== 0

  return (
    <div className={cn('mt-3 rounded-lg border p-3', hasOverride ? 'border-blue-500/30 bg-blue-500/5' : 'border-border bg-muted/20')}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Edit2 className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Advisor Adjustment</span>
          {hasOverride && (
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400">
              {override.adjustment > 0 ? '+' : ''}{override.adjustment} pts applied
            </span>
          )}
        </div>
        {!editing && (
          <button onClick={() => { setAdj(override?.adjustment ?? 0); setRationale(override?.rationale ?? ''); setEditing(true) }}
            className="text-[10px] text-primary hover:underline">
            {hasOverride ? 'Edit' : 'Add adjustment'}
          </button>
        )}
      </div>

      {!editing && hasOverride && (
        <div className="text-[10px] space-y-1">
          <div className="flex gap-4">
            <span className="text-muted-foreground">Computed: <span className="font-bold text-foreground">{rawScore.toFixed(0)}</span></span>
            <span className="text-muted-foreground">Adjustment: <span className={cn('font-bold', override.adjustment > 0 ? 'text-emerald-400' : 'text-red-400')}>{override.adjustment > 0 ? '+' : ''}{override.adjustment}</span></span>
            <span className="text-muted-foreground">Final: <span className="font-bold text-blue-400">{adjScore.toFixed(0)}</span></span>
          </div>
          <p className="text-muted-foreground italic">"{override.rationale}"</p>
        </div>
      )}

      {editing && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-1">
                Adjustment (−20 to +20) — Computed: {rawScore.toFixed(0)} → Final: {Math.max(0, Math.min(100, rawScore + adj)).toFixed(0)}
              </label>
              <input type="range" min={-20} max={20} step={1} value={adj}
                onChange={e => setAdj(Number(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary" />
              <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                <span>−20</span>
                <span className={cn('font-bold', adj > 0 ? 'text-emerald-400' : adj < 0 ? 'text-red-400' : 'text-muted-foreground')}>
                  {adj > 0 ? '+' : ''}{adj}
                </span>
                <span>+20</span>
              </div>
            </div>
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-1">
              Rationale (required) *
            </label>
            <textarea value={rationale} onChange={e => setRationale(e.target.value)} rows={2}
              placeholder="e.g. Reviewed SOPs in VDR — documentation stronger than data suggests"
              className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground placeholder:text-muted-foreground/50 resize-none" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSave} disabled={!rationale.trim() || saving}
              className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded bg-primary text-primary-foreground disabled:opacity-40">
              <Check className="w-3 h-3" />{saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:bg-muted/30">
              <X className="w-3 h-3" />Cancel
            </button>
            {hasOverride && (
              <button onClick={handleDelete}
                className="text-[10px] text-red-400 hover:underline ml-auto">
                Remove adjustment
              </button>
            )}
          </div>
        </div>
      )}

      {!editing && !hasOverride && (
        <p className="text-[10px] text-muted-foreground/60">
          No adjustment applied. Add one to reflect qualitative context the data cannot capture.
        </p>
      )}
    </div>
  )
}

// ── Category card with expandable sub-scores ─────────────────────────────────
function CategoryCard({ item, catData, override, onOverrideSaved }) {
  const [open, setOpen] = useState(false)
  const subScores = catData?.sub_scores ?? {}
  const subWeights = SUBWEIGHTS[item.key] ?? {}
  const hasAdj = override && override.adjustment !== 0
  const qualComplete = catData?.qualitative_complete

  return (
    <div className={cn('rounded-xl border bg-card transition-all', hasAdj ? 'border-blue-500/30' : 'border-border')}>
      <button className="w-full text-left p-4" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm font-medium text-foreground">{item.label}</span>
              <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">{item.weight}%</span>
              {hasAdj && (
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400">
                  Adj {override.adjustment > 0 ? '+' : ''}{override.adjustment}
                </span>
              )}
              {qualComplete && (
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-400">
                  Qualitative Input
                </span>
              )}
              {catData?.data_confidence === 'LOW' && !qualComplete && (
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400">
                  Estimated — input needed
                </span>
              )}
            </div>
            <div className="h-2 bg-muted rounded-full">
              <div className={cn('h-2 rounded-full transition-all', barColor(item.score))} style={{ width: `${item.score}%` }} />
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-3">
            <div className="flex items-center gap-1.5">
              {hasAdj && <span className="text-[10px] text-muted-foreground line-through">{(catData?.raw_composite ?? item.score).toFixed(0)}</span>}
              <span className={cn('text-lg font-bold', scoreColor(item.score))}>{item.score.toFixed(0)}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">→ {item.weighted.toFixed(1)} pts</span>
          </div>
          {open
            ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-1">
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sub-Score Breakdown</p>
          {Object.entries(subScores).map(([k, sub]) => (
            <SubScoreRow key={k} subKey={k} sub={sub} meta={subWeights[k]} />
          ))}
          {Object.keys(subScores).length === 0 && (
            <p className="text-[10px] text-muted-foreground italic">No sub-score detail available for this category.</p>
          )}
          <OverridePanel
            catKey={item.key}
            rawScore={catData?.raw_composite ?? item.score}
            adjScore={item.score}
            override={override}
            onSave={onOverrideSaved}
            onDelete={onOverrideSaved}
          />
        </div>
      )}
    </div>
  )
}

export default function Readiness() {
  const [data, setData] = useState(null)
  const [overrides, setOverrides] = useState({})
  const [refresh, setRefresh] = useState(0)

  const reload = () => setRefresh(r => r + 1)

  useEffect(() => {
    apiClient.get(`/api/analytics/scores/${COMPANY_ID}`)
      .then(setData)
      .catch(() => {})
    apiClient.get(`/api/analytics/overrides/${COMPANY_ID}`)
      .then(d => {
        if (!d) return
        const map = {}
        d.overrides.forEach(o => { map[o.category] = o })
        setOverrides(map)
      })
      .catch(() => {})
  }, [refresh])

  if (data === null) {
    return (
      <div className="space-y-5 max-w-[1400px]">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-3">
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <Skeleton className="h-3 w-24 mx-auto" />
              <Skeleton className="h-32 w-32 rounded-full mx-auto" />
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-3 w-full" />)}
            </div>
          </div>
          <div className="col-span-12 lg:col-span-9 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        </div>
      </div>
    )
  }

  const drs = data?.drs?.base ?? 0
  const tier = tierLabel(drs)
  const cats = data?.category_scores ?? {}
  const qualComplete = data?.drs?.qualitative_complete
  const hasOverrides = data?.drs?.has_overrides

  // Dynamic colors for overall score display
  const arcStroke   = drs >= 75 ? 'hsl(160,84%,39%)' : drs >= 55 ? 'hsl(43,96%,56%)' : 'hsl(0,72%,51%)'
  const scoreBadge  = drs >= 75
    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
    : drs >= 55
    ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
    : 'border-red-500/20 bg-red-500/10 text-red-400'

  const rulesWeights = data?.rules?.category_weights ?? {}
  const categoryMeta = Object.fromEntries(
    Object.entries(DEFAULT_CATEGORY_META).map(([key, meta]) => [
      key,
      { ...meta, weight: Math.round((rulesWeights[key] ?? meta.weight / 100) * 100) },
    ]),
  )
  const breakdown = Object.entries(categoryMeta).map(([key, meta]) => {
    const score = cats[key]?.composite ?? 0
    const weighted = score * meta.weight / 100
    return { key, ...meta, score, weighted }
  })

  const radarData = breakdown.map(b => ({ subject: b.abbr, score: b.score, fullMark: 100 }))

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader
        title="Diligence Readiness Score"
        subtitle="Weighted scoring framework — Revenue Quality · Financial Integrity · Operational Independence · Customer Risk · Management · Growth"
        action={
          <div className="flex items-center gap-2">
            {hasOverrides && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400">
                Advisor Adjustments Active
              </span>
            )}
            {!qualComplete && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400">
                Qualitative Inputs Incomplete
              </span>
            )}
            {qualComplete && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                Qualitative Inputs Complete
              </span>
            )}
            <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border', scoreBadge)}>
              DRS: {drs.toFixed(1)} / 100
            </span>
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-4">
        {/* Score card */}
        <div className="col-span-12 lg:col-span-3">
          <div className={cn('rounded-xl border bg-card p-6 space-y-4', drs >= 75 ? 'border-emerald-500/20' : drs >= 55 ? 'border-amber-500/20' : 'border-red-500/20')}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest text-center">Overall Score</p>
            <div className="flex flex-col items-center gap-2">
              <div className="relative w-32 h-32">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(220,18%,15%)" strokeWidth="10" />
                  <circle cx="60" cy="60" r="50" fill="none" stroke={arcStroke} strokeWidth="10"
                    strokeDasharray={`${2 * Math.PI * 50 * drs / 100} ${2 * Math.PI * 50 * (1 - drs / 100)}`}
                    strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={cn('text-3xl font-bold', scoreColor(drs))}>{Math.round(drs)}</span>
                  <span className="text-[10px] text-muted-foreground">/ 100</span>
                </div>
              </div>
              <span className={cn('text-sm font-bold', tier.color === 'emerald' ? 'text-emerald-400' : tier.color === 'amber' ? 'text-amber-400' : 'text-red-400')}>
                {tier.label}
              </span>
            </div>
            <div className="w-full space-y-1.5 pt-3 border-t border-border">
              {breakdown.map(b => (
                <div key={b.key} className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground truncate">{b.abbr}</span>
                  <div className="flex items-center gap-1">
                    {overrides[b.key] && overrides[b.key].adjustment !== 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" title="Advisor adjustment active" />
                    )}
                    <span className={cn('font-bold', scoreColor(b.score))}>{b.score.toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-border space-y-1 text-[9px] text-muted-foreground">
              <p className="flex items-center gap-1"><Info className="w-3 h-3" /> Click any category to see sub-score breakdown and add an advisor adjustment.</p>
            </div>
          </div>
        </div>

        {/* Breakdown cards */}
        <div className="col-span-12 lg:col-span-9 space-y-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            DRS Composition — click any row to expand sub-scores and adjust
          </p>
          {breakdown.map(item => (
            <CategoryCard
              key={item.key}
              item={item}
              catData={cats[item.key]}
              override={overrides[item.key]}
              onOverrideSaved={reload}
            />
          ))}
          <div className="pt-2 border-t border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Weighted Total</span>
            <div className="flex items-center gap-1.5">
              <span className={cn('text-2xl font-bold', scoreColor(drs))}>{drs.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">/ 100</span>
            </div>
          </div>

          {Object.entries(cats).some(([, v]) => v.data_confidence === 'LOW') && (
            <div className="rounded-xl border border-amber-500/20 bg-card p-4">
              <p className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Data Gaps May Affect Score
              </p>
              <div className="space-y-1">
                {Object.entries(cats)
                  .filter(([, v]) => v.data_confidence === 'LOW')
                  .map(([key]) => (
                    <p key={key} className="text-[11px] text-muted-foreground">
                      · {key.replace(/_/g, ' ')} — LOW confidence; score may improve with fuller data or qualitative inputs
                    </p>
                  ))}
              </div>
            </div>
          )}

          {/* Radar */}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Dimension Radar</p>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke="hsl(220,18%,20%)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'hsl(220,10%,50%)' }} />
                <Radar name="Score" dataKey="score" stroke="hsl(160,84%,39%)" fill="hsl(160,84%,39%)" fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* DRS Tier reference */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">DRS Tier Classification</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { range: '85–100', tier: 'Institutional Grade', color: 'emerald', note: 'Competitive process, minimal friction' },
            { range: '70–84',  tier: 'Investment Grade',    color: 'emerald', note: 'Standard diligence, closes on schedule' },
            { range: '55–69',  tier: 'Needs Work',          color: 'amber',   note: 'Material weaknesses, possible earnout' },
            { range: '40–54',  tier: 'High Risk',           color: 'red',     note: 'Significant structural problems' },
            { range: 'Below 40', tier: 'Not Saleable',      color: 'red',     note: 'No institutional bid viable' },
          ].map(t => {
            const isActive = (t.range === '70–84' && drs >= 70 && drs < 85) || (t.range === '85–100' && drs >= 85) ||
              (t.range === '55–69' && drs >= 55 && drs < 70) || (t.range === '40–54' && drs >= 40 && drs < 55) || (t.range === 'Below 40' && drs < 40)
            const c = t.color === 'emerald' ? 'border-emerald-500/20 bg-emerald-500/5' : t.color === 'amber' ? 'border-amber-500/20 bg-amber-500/5' : 'border-red-500/20 bg-red-500/5'
            const tc = t.color === 'emerald' ? 'text-emerald-400' : t.color === 'amber' ? 'text-amber-400' : 'text-red-400'
            return (
              <div key={t.range} className={cn('rounded-lg border p-3 space-y-1 transition-all', isActive ? `${c} ring-1 ring-offset-0` : 'border-border bg-muted/20')}>
                <p className="text-[10px] font-mono text-muted-foreground">{t.range}</p>
                <p className={cn('text-xs font-bold', isActive ? tc : 'text-muted-foreground')}>{t.tier}</p>
                <p className="text-[9px] text-muted-foreground leading-tight">{t.note}</p>
                {isActive && <span className="text-[9px] font-bold text-primary">← Current</span>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
