import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import SectionHeader from '../components/ui/SectionHeader'
import { cn, fmtM } from '../lib/utils'
import { ChevronDown, ChevronRight, Edit2, Check, X, Info, Shield, AlertTriangle, Users } from 'lucide-react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine,
} from 'recharts'
import { Skeleton } from '../components/ui/Skeleton'
import { apiClient } from '../lib/apiClient'
import { useCompanyId } from '../context/CompanyContext'
import { getDrsCategoryStyle } from '../lib/drsCategoryColors'

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
  },
  operational_independence_qualitative: {
    owner_hours:            { weight: 35, label: 'Owner Hours in Operations' },
    sop_documentation:      { weight: 30, label: 'SOP Documentation Score' },
    process_automation:     { weight: 15, label: 'Process Automation Level' },
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

const OPS_FIN_KEYS = new Set(['owner_comp', 'key_person', 'management_depth', 'staff_stability'])
const OPS_QUAL_KEYS = new Set(['owner_hours', 'sop_documentation', 'process_automation', 'management_depth_ratio'])

function scoreColor(s) {
  if (s >= 70) return 'text-emerald-400'
  if (s >= 55) return 'text-amber-400'
  return 'text-red-400'
}
function barColor(s) {
  if (s >= 70) return 'bg-emerald-500'
  if (s >= 55) return 'bg-amber-500'
  return 'bg-red-500'
}
/** Matches backend DRSTier + SCORING_RULES.drs_tier_thresholds (a9_drs_composite / scoring_rules). */
function tierLabel(s) {
  if (s >= 85) return { label: 'Institutional Grade',      color: 'emerald' }
  if (s >= 70) return { label: 'Investment Grade',         color: 'emerald' }
  if (s >= 55) return { label: 'Conditional',               color: 'amber' }
  if (s >= 40) return { label: 'High Risk',                 color: 'amber' }
  return       { label: 'Pre-Diligence Required',        color: 'red' }
}

// ── Source rows drill-down ───────────────────────────────────────────────────
function SourceRowsDisclosure({ rows, subKey }) {
  const [open, setOpen] = useState(false)
  if (!rows || rows.length === 0) return null

  const isCustomers = rows[0] && 'pct' in rows[0] && 'name' in rows[0]
  const isRevenueTypes = rows[0] && 'type' in rows[0]
  const isAddbacks = rows[0] && 'category' in rows[0] && 'description' in rows[0]

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {open ? 'Hide' : 'Show'} source data ({rows.length} rows)
      </button>
      {open && (
        <div className="mt-1.5 rounded-lg border border-border/60 bg-muted/20 overflow-hidden">
          {isCustomers && (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground">
                  <th className="text-left px-3 py-1.5 font-semibold">Customer</th>
                  <th className="text-right px-3 py-1.5 font-semibold">TTM Revenue</th>
                  <th className="text-right px-3 py-1.5 font-semibold">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-border/20 last:border-0">
                    <td className="px-3 py-1.5 text-foreground font-medium truncate max-w-[160px]">{r.name}</td>
                    <td className="px-3 py-1.5 text-right text-foreground font-mono">{fmtM(r.revenue)}</td>
                    <td className={cn('px-3 py-1.5 text-right font-bold tabular-nums', r.pct >= 30 ? 'text-red-400' : r.pct >= 20 ? 'text-amber-400' : 'text-emerald-400')}>
                      {r.pct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {isRevenueTypes && (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground">
                  <th className="text-left px-3 py-1.5 font-semibold">Revenue Type</th>
                  <th className="text-right px-3 py-1.5 font-semibold">TTM Revenue</th>
                  <th className="text-right px-3 py-1.5 font-semibold">% of Total</th>
                  <th className="text-right px-3 py-1.5 font-semibold">Recurring?</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-border/20 last:border-0">
                    <td className="px-3 py-1.5 text-foreground font-medium">{r.type}</td>
                    <td className="px-3 py-1.5 text-right text-foreground font-mono">{fmtM(r.revenue)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{r.pct.toFixed(1)}%</td>
                    <td className="px-3 py-1.5 text-right">
                      <span className={cn('font-bold text-[10px] px-1 py-0.5 rounded', r.recurring ? 'text-emerald-400 bg-emerald-500/10' : 'text-muted-foreground bg-muted/30')}>
                        {r.recurring ? 'Yes' : 'No'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {isAddbacks && (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground">
                  <th className="text-left px-3 py-1.5 font-semibold">Description</th>
                  <th className="text-left px-3 py-1.5 font-semibold">Category</th>
                  <th className="text-right px-3 py-1.5 font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-border/20 last:border-0">
                    <td className="px-3 py-1.5 text-foreground truncate max-w-[160px]">{r.description}</td>
                    <td className="px-3 py-1.5 text-amber-400 font-medium uppercase text-[10px]">{r.category}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-foreground">{fmtM(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-score breakdown card ─────────────────────────────────────────────────
function SubScoreRow({ subKey, sub, meta }) {
  const weight = meta?.weight ?? 0
  const pts = ((sub.score ?? 0) * weight / 100).toFixed(1)
  const source = sub.source ?? 'financial_data'
  const sourceRows = sub.source_rows ?? []
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0 text-[11px]">
      <div className="w-4 h-4 flex-shrink-0 mt-0.5">
        <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5', sub.score >= 70 ? 'bg-emerald-500' : sub.score >= 55 ? 'bg-amber-500' : 'bg-red-500')} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="font-semibold text-foreground">{meta?.label ?? subKey.replace(/_/g,' ')}</span>
          <span className="text-muted-foreground bg-muted px-1 rounded font-mono">{weight}%</span>
          {source === 'advisor_input' && (
            <span className="text-[11px] font-bold px-1 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400">Advisor Input</span>
          )}
          {source === 'financial_data' && (
            <span className="text-[11px] text-muted-foreground/60">Financial Data</span>
          )}
        </div>
        <p className="text-muted-foreground">
          {sub.label}
          {subKey === 'concentration' && sub.value != null && (
            <span className="text-muted-foreground/80"> — index {Number(sub.value).toLocaleString()}</span>
          )}
        </p>
        <SourceRowsDisclosure rows={sourceRows} subKey={subKey} />
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
  const companyId = useCompanyId()
  const [editing, setEditing] = useState(false)
  const [adj, setAdj]         = useState(override?.adjustment ?? 0)
  const [rationale, setRationale] = useState(override?.rationale ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!rationale.trim()) return
    setSaving(true)
    try {
      await apiClient.post(`/api/analytics/overrides/${companyId}/${catKey}`, { adjustment: adj, rationale })
      onSave()
      setEditing(false)
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    await apiClient.del(`/api/analytics/overrides/${companyId}/${catKey}`)
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
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Advisor Adjustment</span>
          {hasOverride && (
            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400">
              {override.adjustment > 0 ? '+' : ''}{override.adjustment} pts applied
            </span>
          )}
        </div>
        {!editing && (
          <button onClick={() => { setAdj(override?.adjustment ?? 0); setRationale(override?.rationale ?? ''); setEditing(true) }}
            className="text-[11px] text-primary hover:underline">
            {hasOverride ? 'Edit' : 'Add adjustment'}
          </button>
        )}
      </div>

      {!editing && hasOverride && (
        <div className="text-[11px] space-y-1">
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
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">
                Adjustment (−20 to +20) — Computed: {rawScore.toFixed(0)} → Final: {Math.max(0, Math.min(100, rawScore + adj)).toFixed(0)}
              </label>
              <input type="range" min={-20} max={20} step={1} value={adj}
                onChange={e => setAdj(Number(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary" />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-0.5">
                <span>−20</span>
                <span className={cn('font-bold', adj > 0 ? 'text-emerald-400' : adj < 0 ? 'text-red-400' : 'text-muted-foreground')}>
                  {adj > 0 ? '+' : ''}{adj}
                </span>
                <span>+20</span>
              </div>
            </div>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">
              Rationale (required) *
            </label>
            <textarea value={rationale} onChange={e => setRationale(e.target.value)} rows={2}
              placeholder="e.g. Reviewed SOPs in VDR — documentation stronger than data suggests"
              className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-muted-foreground placeholder:text-muted-foreground/45 focus:text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/40" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSave} disabled={!rationale.trim() || saving}
              className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded bg-primary text-primary-foreground disabled:opacity-40">
              <Check className="w-3 h-3" />{saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-border text-muted-foreground hover:bg-muted/30">
              <X className="w-3 h-3" />Cancel
            </button>
            {hasOverride && (
              <button onClick={handleDelete}
                className="text-[11px] text-red-400 hover:underline ml-auto">
                Remove adjustment
              </button>
            )}
          </div>
        </div>
      )}

      {!editing && !hasOverride && (
        <p className="text-[11px] text-muted-foreground/60">
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
  const subWeightsFin = SUBWEIGHTS[item.key] ?? {}
  const subWeightsQual = item.key === 'operational_independence'
    ? SUBWEIGHTS.operational_independence_qualitative
    : {}
  const hasAdj = override && override.adjustment !== 0
  const qualComplete = catData?.qualitative_complete
  const catPalette = getDrsCategoryStyle(item.key)

  return (
    <div className={cn(
      'rounded-xl border bg-card transition-all border-l-2',
      catPalette.accentLine,
      hasAdj ? 'border-blue-500/30' : 'border-border',
    )}>
      <button className="w-full text-left p-4" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm font-medium text-foreground">{item.label}</span>
              <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">{item.weight}%</span>
              {hasAdj && (
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400">
                  Adj {override.adjustment > 0 ? '+' : ''}{override.adjustment}
                </span>
              )}
              {qualComplete && (
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-400">
                  Qualitative Input
                </span>
              )}
              {catData?.data_confidence === 'LOW' && !qualComplete && (
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400">
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
              {hasAdj && <span className="text-[11px] text-muted-foreground line-through">{(catData?.raw_composite ?? item.score).toFixed(0)}</span>}
              <span className={cn('text-lg font-bold', scoreColor(item.score))}>{item.score.toFixed(0)}</span>
            </div>
            <span className="text-[11px] text-muted-foreground">→ {item.weighted.toFixed(1)} pts</span>
          </div>
          {open
            ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sub-Score Breakdown</p>
          {item.key === 'operational_independence' ? (
            <>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">From financial data (weights sum to 100%)</p>
              {Object.entries(subScores).filter(([k]) => OPS_FIN_KEYS.has(k)).map(([k, sub]) => (
                <SubScoreRow key={k} subKey={k} sub={sub} meta={subWeightsFin[k]} />
              ))}
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-3 mb-1">Qualitative inputs (weights sum to 100%)</p>
              {Object.entries(subScores).filter(([k]) => OPS_QUAL_KEYS.has(k)).map(([k, sub]) => (
                <SubScoreRow key={k} subKey={k} sub={sub} meta={subWeightsQual[k]} />
              ))}
            </>
          ) : (
            Object.entries(subScores).map(([k, sub]) => (
              <SubScoreRow key={k} subKey={k} sub={sub} meta={subWeightsFin[k]} />
            ))
          )}
          {Object.keys(subScores).length === 0 && (
            <p className="text-[11px] text-muted-foreground italic">No sub-score detail available for this category.</p>
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

const BUYER_PROFILES = [
  { key: null,         label: 'Default',    abbr: 'Default'  },
  { key: 'pe',        label: 'Private Equity', abbr: 'PE'  },
  { key: 'strategic', label: 'Strategic',   abbr: 'Strategic' },
  { key: 'financial', label: 'Financial',   abbr: 'Financial' },
]

export default function Readiness() {
  const companyId = useCompanyId()
  const queryClient = useQueryClient()
  const [data, setData] = useState(null)
  const [overrides, setOverrides] = useState({})
  const [refresh, setRefresh] = useState(0)
  const [methodologyOpen, setMethodologyOpen] = useState(false)
  const [snapshots, setSnapshots] = useState([])
  const [buyerProfile, setBuyerProfile] = useState(null) // null | 'pe' | 'strategic' | 'financial'

  const reload = () => {
    setRefresh(r => r + 1)
    // Bust the shared react-query cache so ValueGap, Valuation, Home, etc.
    // immediately reflect the updated score after an advisor override change.
    queryClient.invalidateQueries({ queryKey: ['analytics-scores', companyId] })
    queryClient.invalidateQueries({ queryKey: ['analytics-value-gap', companyId] })
    queryClient.invalidateQueries({ queryKey: ['analytics-buyer-questions', companyId] })
    queryClient.invalidateQueries({ queryKey: ['advisory-workflow', companyId] })
  }

  useEffect(() => {
    const profileParam = buyerProfile ? `?buyer_profile=${buyerProfile}` : ''
    apiClient.get(`/api/analytics/scores/${companyId}${profileParam}`)
      .then(setData)
      .catch(() => {})
    apiClient.get(`/api/analytics/overrides/${companyId}`)
      .then(d => {
        if (!d) return
        const map = {}
        d.overrides.forEach(o => { map[o.category] = o })
        setOverrides(map)
      })
      .catch(() => {})
    apiClient.get(`/api/analytics/scores/${companyId}/history`)
      .then(d => setSnapshots(d.snapshots ?? []))
      .catch(() => {})
  }, [refresh, companyId, buyerProfile])

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
  const arcStroke   = drs >= 70 ? 'hsl(160,84%,39%)' : drs >= 55 ? 'hsl(43,96%,56%)' : 'hsl(0,72%,51%)'
  const scoreBadge  = drs >= 70
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
  const meth = data?.methodology

  return (
    <div className="space-y-5 max-w-[1400px]">
      {drs < 40 && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-4 flex items-start gap-3" role="alert">
          <Shield className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-400">Pre-Diligence Required — Company Not Market-Ready</p>
            <p className="text-xs text-red-300/80 mt-1">
              A DRS below 40 indicates fundamental gaps that a buyer's diligence team will identify immediately.
              Do not proceed to market outreach. Prioritize the Value Gap initiatives to reach a minimum of 55 (Conditional) before engaging any buyers.
            </p>
          </div>
        </div>
      )}

      <SectionHeader
        title="Diligence Readiness Score"
        subtitle="Weighted scoring framework — Revenue Quality · Financial Integrity · Operational Independence · Customer Risk · Management · Growth"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Buyer lens toggle */}
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/20 p-0.5">
              <Users className="w-3 h-3 text-muted-foreground ml-1.5" />
              {BUYER_PROFILES.map(p => (
                <button
                  key={p.key ?? 'default'}
                  onClick={() => setBuyerProfile(p.key)}
                  className={cn(
                    'text-[11px] px-2 py-0.5 rounded font-semibold transition-all',
                    buyerProfile === p.key
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {p.abbr}
                </button>
              ))}
            </div>
            {hasOverrides && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400">
                Advisor Adjustments Active
              </span>
            )}
            {!qualComplete && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400">
                Qualitative Inputs Incomplete
              </span>
            )}
            {qualComplete && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                Qualitative Inputs Complete
              </span>
            )}
            <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border', scoreBadge)}>
              DRS: {drs.toFixed(1)} / 100
            </span>
          </div>
        }
      />

      {/* Buyer profile active banner */}
      {buyerProfile && data?.buyer_profile && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-start gap-3">
          <Users className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground mb-0.5">
              Viewing DRS as a <span className="text-primary">{data.buyer_profile.label}</span> would weight it
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{data.buyer_profile.rationale}</p>
            {Object.keys(data.buyer_profile.weight_deltas ?? {}).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {Object.entries(data.buyer_profile.weight_deltas).map(([cat, delta]) => {
                  if (delta === 0) return null
                  const label = DEFAULT_CATEGORY_META[cat]?.label ?? cat
                  return (
                    <span key={cat} className={cn(
                      'text-[10px] font-semibold px-1.5 py-0.5 rounded border',
                      delta > 0 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-400',
                    )}>
                      {label} {delta > 0 ? '+' : ''}{delta}pp
                    </span>
                  )
                })}
              </div>
            )}
          </div>
          <button onClick={() => setBuyerProfile(null)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setMethodologyOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/20 transition-colors"
        >
          <span className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Info className="w-4 h-4 text-muted-foreground" />
            How the Diligence Readiness Score works
          </span>
          {methodologyOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </button>
        {methodologyOpen && (
          <div className="px-4 pb-5 border-t border-border pt-4 space-y-5 text-xs text-muted-foreground">
            {/* Overview */}
            <div className="space-y-2">
              <p className="text-sm text-foreground/90 leading-relaxed">
                The DRS is a <span className="font-semibold text-foreground">0–100 weighted composite</span> that
                predicts how a company will perform under buyer due diligence. It synthesizes financial data
                from your uploaded sources with optional qualitative inputs from the advisor interview.
                A higher score means fewer surprises in diligence and a stronger negotiating position.
              </p>
              <p className="leading-relaxed">
                The score is used to determine the <span className="text-foreground font-medium">EBITDA multiple band</span> applied
                to enterprise valuation, to generate the <span className="text-foreground font-medium">buyer risk questions</span> on
                the Buyer Risk Profile, and to quantify the <span className="text-foreground font-medium">value gap</span> between
                current and achievable enterprise value. Every module in the platform traces back to these six category scores.
              </p>
            </div>

            {/* How it's calculated */}
            <div>
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-2">How it's calculated</p>
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">1</span>
                  <span className="text-foreground/80"><span className="font-medium text-foreground">Sub-scores</span> are computed from individual metrics (e.g. recurring revenue rate, HHI concentration, owner hours). Each sub-score is 0–100.</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">2</span>
                  <span className="text-foreground/80"><span className="font-medium text-foreground">Category scores</span> are the weighted average of their sub-scores. Click any category below to see exact weights.</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">3</span>
                  <span className="text-foreground/80"><span className="font-medium text-foreground">DRS</span> = weighted sum of category scores using the weights below. Advisor adjustments (±20 pts per category) layer on top.</span>
                </div>
              </div>
            </div>

            {/* Category weights */}
            <div>
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-2">Category weights</p>
              <p className="mb-2 text-[11px]">
                Weights reflect buyer priority — revenue quality and financial integrity carry the most
                weight because they drive the EBITDA multiple and are the first areas scrutinized in diligence.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {breakdown.map(b => (
                  <div key={b.key} className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/10 px-2.5 py-1.5">
                    <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', getDrsCategoryStyle(b.key).dot)} />
                    <span className={cn('text-sm font-bold tabular-nums w-8', scoreColor(b.score))}>{b.weight}%</span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-foreground truncate">{b.label}</p>
                      <p className="text-[10px] text-muted-foreground">Current: {b.score.toFixed(0)}/100 → {b.weighted.toFixed(1)} pts</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Data sources */}
            <div>
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-2">Where the data comes from</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-[11px]">
                <div className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                  <span><span className="font-medium text-foreground">Financial data</span> — QuickBooks P&L, A/R aging, CRM exports, payroll, and contracts uploaded via Data Sources. Drives revenue quality, financial integrity, customer risk, and management team scores.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  <span><span className="font-medium text-foreground">Qualitative inputs</span> — Advisor interview data entered on the Engagement Intake page (owner hours, SOP coverage, automation, pipeline value, market positioning). Blended with financial data for Operational Independence and Growth Drivers.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />
                  <span><span className="font-medium text-foreground">Advisor adjustments</span> — You can override any category score ±20 points with documented rationale. Use when you have context the data can't capture (e.g. reviewed VDR docs that confirm stronger controls).</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                  <span><span className="font-medium text-foreground">Low-confidence estimates</span> — Categories with sparse data are flagged "Estimated" and scored conservatively{meth ? ` (×${meth.low_confidence_category_multiplier})` : ''}. Adding more source data or qualitative inputs improves confidence and typically raises scores.</span>
                </div>
              </div>
            </div>

            {/* What the tiers mean — names align with DRSTier enum in scoring */}
            <div>
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-2">What the tiers mean for a deal</p>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-start gap-2">
                  <span className="font-mono text-emerald-400 w-12 flex-shrink-0 text-right">85–100</span>
                  <span><span className="font-semibold text-emerald-400">Institutional Grade</span> — Competitive process readiness. Diligence is routine; buyers compete on terms. Expect premium multiples and cleaner close timelines.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono text-emerald-400 w-12 flex-shrink-0 text-right">70–84</span>
                  <span><span className="font-semibold text-emerald-400">Investment Grade</span> — Standard sell-side bar. Typical issues are addressable in diligence. Market-rate multiples achievable with orderly preparation.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono text-amber-400 w-12 flex-shrink-0 text-right">55–69</span>
                  <span><span className="font-semibold text-amber-400">Conditional</span> — Material gaps will surface; expect heavier diligence, potential price adjustments or structure. Value acceleration before a broad process is usually warranted.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono text-amber-400 w-12 flex-shrink-0 text-right">40–54</span>
                  <span><span className="font-semibold text-amber-400">High Risk</span> — Many institutional buyers will pass or seek steep discounts / heavy structure. A longer runway to remediate issues is typically required for a credible process.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono text-red-400 w-12 flex-shrink-0 text-right">&lt; 40</span>
                  <span><span className="font-semibold text-red-400">Pre-Diligence Required</span> — Not ready for institutional marketing. Prioritize data quality, documentation, and operating fixes before expecting credible bids.</span>
                </div>
              </div>
            </div>

            {meth && (
              <p className="text-[10px] text-muted-foreground/50 pt-1 border-t border-border/40">
                Scoring rules v{meth.version ?? data?.rules?.version ?? '—'} · Value-gap target score: {meth.value_gap_target_score}/100
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Score card */}
        <div className="col-span-12 lg:col-span-3">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest text-center">Overall Score</p>
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
                  <span className="text-[11px] text-muted-foreground">/ 100</span>
                </div>
              </div>
              <span className={cn('text-sm font-bold', tier.color === 'emerald' ? 'text-emerald-400' : tier.color === 'amber' ? 'text-amber-400' : 'text-red-400')}>
                {tier.label}
              </span>
            </div>
            <div className="w-full space-y-1.5 pt-3 border-t border-border">
              {breakdown.map(b => (
                <div key={b.key} className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground truncate flex items-center gap-1.5 min-w-0">
                    <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', getDrsCategoryStyle(b.key).dot)} />
                    {b.abbr}
                  </span>
                  <div className="flex items-center gap-1">
                    {overrides[b.key] && overrides[b.key].adjustment !== 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" title="Advisor adjustment active" />
                    )}
                    <span className={cn('font-bold', scoreColor(b.score))}>{b.score.toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-border" />

            {/* Radar */}
            <div className="pt-4 border-t border-border">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 text-center">Dimension Radar</p>
              <ResponsiveContainer width="100%" height={180}>
                <RadarChart data={radarData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                  <PolarGrid stroke="hsl(220,18%,20%)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: 'hsl(220,10%,50%)' }} />
                  <Radar name="Score" dataKey="score" stroke="hsl(217,91%,60%)" fill="hsl(217,91%,60%)" fillOpacity={0.18} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-2.5 gap-y-1 mt-2 px-1">
                {breakdown.map(b => (
                  <span key={b.key} className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    <span className={cn('w-1.5 h-1.5 rounded-full', getDrsCategoryStyle(b.key).dot)} />
                    {b.abbr}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown cards */}
        <div className="col-span-12 lg:col-span-9 space-y-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
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

        </div>
      </div>

      {/* DRS Tier reference */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">DRS Tier Classification</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { range: '85–100',   tier: 'Institutional Grade',      color: 'emerald', note: 'Competitive process, minimal friction' },
            { range: '70–84',    tier: 'Investment Grade',          color: 'emerald', note: 'Standard diligence, closes on schedule' },
            { range: '55–69',    tier: 'Conditional',               color: 'amber',   note: 'Material weaknesses, focused value work needed' },
            { range: '40–54',    tier: 'High Risk',                 color: 'amber',   note: 'Structural gaps — extended preparation typical' },
            { range: 'Below 40', tier: 'Pre-Diligence Required',    color: 'red',     note: 'Not marketable to institutional buyers until fixed' },
          ].map(t => {
            const isActive = (t.range === '70–84' && drs >= 70 && drs < 85) || (t.range === '85–100' && drs >= 85) ||
              (t.range === '55–69' && drs >= 55 && drs < 70) || (t.range === '40–54' && drs >= 40 && drs < 55) || (t.range === 'Below 40' && drs < 40)
            const c = t.color === 'emerald' ? 'border-emerald-500/20 bg-emerald-500/5' : t.color === 'amber' ? 'border-amber-500/20 bg-amber-500/5' : 'border-red-500/20 bg-red-500/5'
            const tc = t.color === 'emerald' ? 'text-emerald-400' : t.color === 'amber' ? 'text-amber-400' : 'text-red-400'
            return (
              <div key={t.range} className={cn('rounded-lg border p-3 space-y-1 transition-all', isActive ? `${c} ring-1 ring-offset-0` : 'border-border bg-muted/20')}>
                <p className="text-[11px] font-mono text-muted-foreground">{t.range}</p>
                <p className={cn('text-xs font-bold', isActive ? tc : 'text-muted-foreground')}>{t.tier}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{t.note}</p>
                {isActive && <span className="text-[11px] font-bold text-primary">← Current</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Owner PRE Score */}
      {data?.owner_readiness && (() => {
        const pre = data.owner_readiness
        const tierColor =
          pre.tier === 'Aligned'       ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' :
          pre.tier === 'Mostly Ready'  ? 'border-blue-500/20 bg-blue-500/5 text-blue-400'    :
          pre.tier === 'Moderate Gap'  ? 'border-amber-500/20 bg-amber-500/5 text-amber-400'  :
                                         'border-red-500/20 bg-red-500/5 text-red-400'
        const barColor =
          pre.tier === 'Aligned'       ? 'bg-emerald-500' :
          pre.tier === 'Mostly Ready'  ? 'bg-blue-500'    :
          pre.tier === 'Moderate Gap'  ? 'bg-amber-500'   : 'bg-red-500'
        return (
          <div className={cn('rounded-xl border p-5', tierColor)}>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Owner Personal Readiness (PRE) Score
            </p>
            <div className="flex items-end gap-6 mb-4">
              <div className="flex-shrink-0">
                <p className="text-4xl font-black">{pre.pre_score.toFixed(0)}<span className="text-sm font-semibold text-muted-foreground">/100</span></p>
                <p className="text-sm font-bold mt-0.5">{pre.tier}</p>
              </div>
              <div className="flex-1 pb-1">
                <div className="h-2.5 rounded-full bg-muted/30 overflow-hidden">
                  <div className={cn('h-full rounded-full', barColor)} style={{ width: `${pre.pre_score}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-snug">{pre.summary}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {pre.dimensions.map(d => (
                <div key={d.name} className="rounded-lg bg-background/30 border border-border/40 px-3 py-2.5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{d.name}</p>
                  <p className="text-lg font-bold mt-1">{d.score.toFixed(0)}<span className="text-xs text-muted-foreground">/100</span></p>
                  <p className="text-[10px] font-semibold mt-0.5">{d.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{d.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* DRS Industry Benchmarks */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">DRS Industry Benchmarks</p>
        <p className="text-[11px] text-muted-foreground mb-4">Reference percentile distribution across SMB sell-side engagements (n ≈ 2,400+)</p>
        <div className="space-y-2.5">
          {[
            { label: 'P90 — Top Performers',   score: 84, pct: '90th',  note: 'Institutional-grade, competitive process',      color: 'emerald' },
            { label: 'P75 — Investment Grade',  score: 73, pct: '75th',  note: 'Standard diligence, limited friction',           color: 'emerald' },
            { label: 'P50 — Median Engagement', score: 58, pct: '50th',  note: 'Conditional tier — meaningful prep before process', color: 'amber'   },
            { label: 'P25 — High Risk',         score: 44, pct: '25th',  note: 'High Risk tier — discounts or structure likely',    color: 'amber'   },
            { label: 'P10 — Pre-Diligence',     score: 31, pct: '10th',  note: 'Pre-Diligence Required — heavy value creation first', color: 'red'     },
          ].map(b => {
            const isAbove = drs >= b.score
            const colorCls = b.color === 'emerald' ? 'text-emerald-400' : b.color === 'amber' ? 'text-amber-400' : 'text-red-400'
            const barCls   = b.color === 'emerald' ? 'bg-emerald-500/40' : b.color === 'amber' ? 'bg-amber-500/40' : 'bg-red-500/40'
            return (
              <div key={b.pct} className={cn('flex items-center gap-3', isAbove ? 'opacity-100' : 'opacity-50')}>
                <span className="text-[11px] font-mono text-muted-foreground w-8 flex-shrink-0">{b.pct}</span>
                <div className="relative h-5 rounded flex-1 bg-muted/20 overflow-hidden">
                  <div className={cn('absolute left-0 top-0 h-full rounded', barCls)} style={{ width: `${b.score}%` }} />
                  {isAbove && (
                    <div className="absolute left-0 top-0 h-full rounded bg-primary/20" style={{ width: `${drs}%` }} />
                  )}
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">{b.score}</span>
                </div>
                <div className="w-48 flex-shrink-0">
                  <p className={cn('text-[11px] font-semibold', isAbove ? colorCls : 'text-muted-foreground')}>{b.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{b.note}</p>
                </div>
                {isAbove && <span className="text-[10px] font-bold text-primary flex-shrink-0">✓</span>}
              </div>
            )
          })}
          <div className="flex items-center gap-3 pt-1 border-t border-border/40 mt-1">
            <span className="text-[11px] font-mono text-muted-foreground w-8 flex-shrink-0">YOU</span>
            <div className="relative h-5 rounded flex-1 bg-muted/20 overflow-hidden">
              <div className="absolute left-0 top-0 h-full rounded bg-primary/50" style={{ width: `${drs}%` }} />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold">{drs.toFixed(1)}</span>
            </div>
            <div className="w-48 flex-shrink-0">
              <p className="text-[11px] font-bold text-primary">Current Score</p>
            </div>
          </div>
        </div>
      </div>

      {/* DRS Score History sparkline */}
      {snapshots.length >= 2 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">DRS Score History</p>
            <span className="text-[11px] text-muted-foreground">{snapshots.length} captures</span>
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={snapshots} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="created_at" hide />
              <YAxis domain={[0, 100]} hide />
              <Tooltip
                contentStyle={{ background: 'hsl(220,20%,10%)', border: '1px solid hsl(220,18%,20%)', borderRadius: 8, fontSize: 11 }}
                formatter={(v) => [v.toFixed(1), 'DRS']}
                labelFormatter={(l) => new Date(l).toLocaleDateString()}
              />
              <ReferenceLine y={85} stroke="hsl(160,84%,39%)" strokeDasharray="3 3" strokeOpacity={0.4} />
              <ReferenceLine y={70} stroke="hsl(43,96%,56%)" strokeDasharray="3 3" strokeOpacity={0.4} />
              <Line
                type="monotone" dataKey="drs_score"
                stroke="hsl(217,91%,60%)" strokeWidth={2} dot={false}
                activeDot={{ r: 4, fill: 'hsl(217,91%,60%)' }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-1.5 text-[11px] text-muted-foreground/60">
            <span className="flex items-center gap-1"><span className="inline-block w-4 h-px bg-emerald-500/60" /> 85 · Institutional Grade</span>
            <span className="flex items-center gap-1"><span className="inline-block w-4 h-px bg-amber-500/60" /> 70 · Investment Grade</span>
          </div>
        </div>
      )}
    </div>
  )
}
