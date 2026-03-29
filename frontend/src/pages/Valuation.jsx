import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import SectionHeader from '../components/ui/SectionHeader'
import { cn, fmtM } from '../lib/utils'
import {
  TrendingUp, DollarSign, Zap, BarChart2, AlertTriangle,
  ExternalLink, Edit2, Check, X, Plus, Trash2, ChevronDown, ChevronRight,
  Scale, ArrowRight, Info,
} from 'lucide-react'
import { apiClient } from '../lib/apiClient'
import { toast } from '../lib/notify'
import { Skeleton } from '../components/ui/Skeleton'
import { useCompanyId } from '../context/CompanyContext'
import { usePageTitle } from '../hooks/usePageTitle'

/** Enterprise value provenance for display (API may return string or, in edge cases, structured data). */
function evCitationText(ev) {
  const raw = ev?.valuation_summary ?? ev?.source_citation
  if (typeof raw === 'string' && raw.trim()) return raw
  const mr = ev?.market_reference
  if (mr && typeof mr === 'object') {
    const seg = mr.segment_label || mr.release_label
    if (seg) return `Market reference: ${seg}`
  }
  return 'DRS-based internal multiple band (no third-party market feed configured).'
}

// ── Challenge badge ────────────────────────────────────────────────────────
const CHALLENGE_META = {
  LOW:             { label: 'Low Challenge',      color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', consMultiplier: 1.0, baseMultiplier: 1.0, aggMultiplier: 1.0 },
  MEDIUM:          { label: 'Medium Challenge',   color: 'text-amber-400',   border: 'border-amber-500/30',   bg: 'bg-amber-500/10',   consMultiplier: 0.0, baseMultiplier: 0.5, aggMultiplier: 1.0 },
  HIGH:            { label: 'High Challenge',     color: 'text-red-400',     border: 'border-red-500/30',     bg: 'bg-red-500/10',     consMultiplier: 0.0, baseMultiplier: 0.0, aggMultiplier: 1.0 },
  NOT_DEFENSIBLE:  { label: 'Not Defensible',     color: 'text-muted-foreground', border: 'border-border', bg: 'bg-muted/30',       consMultiplier: 0.0, baseMultiplier: 0.0, aggMultiplier: 0.0 },
}

function ChallengeBadge({ challenge }) {
  const m = CHALLENGE_META[challenge] ?? CHALLENGE_META.MEDIUM
  return (
    <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded border', m.color, m.border, m.bg)}>
      {m.label}
    </span>
  )
}

// ── Per-scenario addback contribution ─────────────────────────────────────
function ScenarioCell({ amount, multiplier, className }) {
  const val = amount * multiplier
  return (
    <td className={cn('text-right py-2 px-3 font-mono text-xs tabular-nums', className)}>
      {multiplier === 0
        ? <span className="text-muted-foreground/40">—</span>
        : <span className="text-emerald-400">+{fmtM(val)}</span>}
    </td>
  )
}

// ── Inline addback editor ──────────────────────────────────────────────────
function AddbackEditor({ addback, onSave, onDelete, onClose, isNew = false }) {
  const [challenge,  setChallenge]  = useState(addback?.challenge  ?? 'MEDIUM')
  const [amount,     setAmount]     = useState(addback?.amount     ?? '')
  const [description,setDescription]= useState(addback?.description ?? '')
  const [notes,      setNotes]      = useState(addback?.notes      ?? '')
  const [rationale,  setRationale]  = useState(addback?.override_rationale ?? '')
  const [documented, setDocumented] = useState(addback?.documented ?? false)
  const [saving,     setSaving]     = useState(false)

  async function handleSave() {
    if (!rationale.trim()) { alert('Rationale is required'); return }
    if (!description.trim()) { alert('Description is required'); return }
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) { alert('Enter a valid positive amount'); return }
    setSaving(true)
    await onSave({
      description, amount: parsed, challenge,
      notes, rationale, documented,
      category: addback?.category ?? 'other',
      is_custom: addback?.is_custom ?? isNew,
    })
    setSaving(false)
  }

  return (
    <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-3 mt-1">
      {isNew && (
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Description</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Vehicle lease through business"
            className="mt-1 w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-muted-foreground placeholder:text-muted-foreground/45 focus:text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Amount ($)</label>
          <input
            type="number" value={amount} onChange={e => setAmount(e.target.value)}
            className="mt-1 w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-muted-foreground focus:text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Challenge Rate</label>
          <select
            value={challenge} onChange={e => setChallenge(e.target.value)}
            className="mt-1 w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-muted-foreground focus:text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
          >
            <option value="LOW">Low — fully defensible</option>
            <option value="MEDIUM">Medium — conservative none, 50% base, 100% aggressive</option>
            <option value="HIGH">High — aggressive only</option>
            <option value="NOT_DEFENSIBLE">Not Defensible — remove</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox" id="documented" checked={documented}
          onChange={e => setDocumented(e.target.checked)}
          className="rounded border-border"
        />
        <label htmlFor="documented" className="text-[11px] text-muted-foreground">Documented (supporting evidence on file)</label>
      </div>

      <div>
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Notes</label>
        <input
          value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Supporting detail or source reference"
          className="mt-1 w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-muted-foreground placeholder:text-muted-foreground/45 focus:text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
        />
      </div>

      <div>
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Advisor Rationale <span className="text-red-400">*</span>
        </label>
        <textarea
          value={rationale} onChange={e => setRationale(e.target.value)} rows={2}
          placeholder="Why are you overriding this challenge rate? (required for audit trail)"
          className="mt-1 w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-muted-foreground placeholder:text-muted-foreground/45 focus:text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 resize-none"
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave} disabled={saving}
          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded font-medium hover:bg-primary/90 disabled:opacity-60"
        >
          <Check className="w-3 h-3" />{saving ? 'Saving…' : 'Save Override'}
        </button>
        {!isNew && onDelete && (
          <button
            onClick={onDelete}
            className="flex items-center gap-1 text-xs px-3 py-1.5 border border-red-500/30 text-red-400 rounded hover:bg-red-500/10"
          >
            <Trash2 className="w-3 h-3" />Reset to Default
          </button>
        )}
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground px-2">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Single addback row ─────────────────────────────────────────────────────
function AddbackRow({ ab, onRecastUpdate }) {
  const companyId = useCompanyId()
  const [open, setOpen] = useState(false)
  const ch = CHALLENGE_META[ab.challenge] ?? CHALLENGE_META.MEDIUM

  async function handleSave(body) {
    try {
      const data = await apiClient.post(`/api/analytics/addbacks/${companyId}/${ab.addback_key}`, {
        ...body,
        addback_key: ab.addback_key,
      })
      onRecastUpdate(data)
      setOpen(false)
    } catch (e) {
      toast.error(e?.message || 'Could not save addback')
    }
  }

  async function handleDelete() {
    try {
      const data = await apiClient.del(`/api/analytics/addbacks/${companyId}/${ab.addback_key}`)
      onRecastUpdate(data)
      setOpen(false)
    } catch (e) {
      toast.error(e?.message || 'Could not delete addback')
    }
  }

  return (
    <tbody>
      <tr className={cn('border-t border-border/40 group', ab.challenge === 'NOT_DEFENSIBLE' && 'opacity-40')}>
        <td className="py-2.5 pl-2 pr-1 w-5">
          <button onClick={() => setOpen(o => !o)} className="text-muted-foreground hover:text-foreground">
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </td>
        <td className="py-2.5 pr-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-foreground font-medium">{ab.description}</span>
            {ab.overridden && (
              <span className="text-[11px] font-bold px-1 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400">OVERRIDDEN</span>
            )}
            {ab.is_custom && (
              <span className="text-[11px] font-bold px-1 py-0.5 rounded border border-purple-500/30 bg-purple-500/10 text-purple-400">CUSTOM</span>
            )}
            <ChallengeBadge challenge={ab.challenge} />
          </div>
          {ab.notes && <p className="text-[11px] text-muted-foreground mt-0.5">{ab.notes}</p>}
        </td>
        <td className="py-2.5 pr-3 text-right text-xs font-mono font-semibold text-foreground tabular-nums">
          {fmtM(ab.amount)}
        </td>
        <ScenarioCell amount={ab.amount} multiplier={ch.consMultiplier} />
        <ScenarioCell amount={ab.amount} multiplier={ch.baseMultiplier} />
        <ScenarioCell amount={ab.amount} multiplier={ch.aggMultiplier} />
        <td className="py-2.5 pl-2">
          <button
            onClick={() => setOpen(o => !o)}
            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-opacity"
          >
            <Edit2 className="w-3 h-3" /> Edit
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} className="pb-3 px-2">
            <AddbackEditor
              addback={ab}
              onSave={handleSave}
              onDelete={ab.overridden || ab.is_custom ? handleDelete : null}
              onClose={() => setOpen(false)}
            />
          </td>
        </tr>
      )}
    </tbody>
  )
}

// ── P&L line item row with propose-addback hover ──────────────────────────
const CATEGORY_LABEL = {
  COGS: null,
  OPEX: null,
  OWNER: 'Owner',
  PERSONAL: 'Personal',
  ONE_TIME: 'One-Time',
  RELATED_PARTY: 'Related Party',
}
const CATEGORY_FLAG = { OWNER: true, PERSONAL: true, ONE_TIME: true, RELATED_PARTY: true }

function LineItemRow({ line, onPropose }) {
  const catLabel = CATEGORY_LABEL[line.category]
  const flagged  = CATEGORY_FLAG[line.category] ?? false
  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-1.5 group transition-colors hover:bg-muted/30',
        flagged ? 'bg-amber-500/5' : '',
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-muted-foreground/60 pl-4">·</span>
        <span className={cn('text-[11px] truncate max-w-[260px]', flagged ? 'text-amber-400' : 'text-muted-foreground')}>
          {line.description}
        </span>
        {catLabel && (
          <span className={cn(
            'text-[10px] font-bold px-1 py-0.5 rounded border',
            flagged
              ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
              : 'text-muted-foreground border-border bg-muted/20',
          )}>
            {catLabel}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={onPropose}
          className={cn(
            'flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 border border-primary/30 rounded px-1.5 py-0.5 bg-primary/5 hover:bg-primary/10 transition-all',
            flagged ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          <Plus className="w-2.5 h-2.5" /> Propose Addback
        </button>
        <span className="text-[11px] font-semibold text-red-400 tabular-nums">({fmtM(line.amount)})</span>
      </div>
    </div>
  )
}

// ── EBITDA basis (D&A, market rate, disclosure lines) ───────────────────────
function EbitdaBasisPanel({ companyId, metrics, onSaved }) {
  const [mr, setMr] = useState('')
  const [da, setDa] = useState('')
  const [interest, setInterest] = useState('')
  const [tax, setTax] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!metrics) return
    setMr(metrics.market_rate_replacement_annual != null ? String(metrics.market_rate_replacement_annual) : '120000')
    setDa(metrics.depreciation_amortization_ttm != null ? String(metrics.depreciation_amortization_ttm) : '')
    setInterest(metrics.interest_expense_ttm != null ? String(metrics.interest_expense_ttm) : '')
    setTax(metrics.income_tax_expense_ttm != null ? String(metrics.income_tax_expense_ttm) : '')
  }, [metrics])

  async function save() {
    setSaving(true)
    try {
      await apiClient.patch(`/api/analytics/company-financial/${companyId}`, {
        market_rate_replacement_annual: mr.trim() === '' ? null : parseFloat(mr),
        depreciation_amortization_ttm: da.trim() === '' ? null : parseFloat(da),
        interest_expense_ttm: interest.trim() === '' ? null : parseFloat(interest),
        income_tax_expense_ttm: tax.trim() === '' ? null : parseFloat(tax),
      })
      toast.success('EBITDA basis saved')
      onSaved()
    } catch (e) {
      toast.error(e?.message || 'Could not save')
    }
    setSaving(false)
  }

  const inputCls = 'mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground placeholder:text-muted-foreground/40 focus:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition-colors'

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-card-foreground">EBITDA Basis & Normalization</h3>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
      <div className="px-5 py-4 space-y-4">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {metrics?.ebitda_basis_note ?? 'Ontology proxy (revenue − COGS − OpEx) plus advisor-entered D&A. Interest and tax are for disclosure only.'}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Owner market rate ($/yr)</label>
            <input type="number" value={mr} onChange={e => setMr(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Depreciation & Amort. ($)</label>
            <input type="number" value={da} onChange={e => setDa(e.target.value)} placeholder="0" className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Interest expense ($)</label>
            <input type="number" value={interest} onChange={e => setInterest(e.target.value)} placeholder="Disclosure only" className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Income tax ($)</label>
            <input type="number" value={tax} onChange={e => setTax(e.target.value)} placeholder="Disclosure only" className={inputCls} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Valuation() {
  usePageTitle('Valuation')
  const companyId = useCompanyId()
  const queryClient = useQueryClient()
  const [addingCustom, setAddingCustom] = useState(false)
  const [prefillAddback, setPrefillAddback] = useState(null)
  const [cogsExpanded, setCogsExpanded] = useState(false)
  const [opexExpanded, setOpexExpanded] = useState(false)

  const companyReady = companyId != null && companyId > 0

  const scoresQuery = useQuery({
    queryKey: ['analytics-scores', companyId],
    queryFn: () => apiClient.get(`/api/analytics/scores/${companyId}`),
    enabled: companyReady,
  })
  const metricsQuery = useQuery({
    queryKey: ['analytics-metrics', companyId],
    queryFn: () => apiClient.get(`/api/analytics/metrics/${companyId}`),
    enabled: companyReady,
  })
  const recastQuery = useQuery({
    queryKey: ['ebitda-recast', companyId],
    queryFn: () => apiClient.get(`/api/analytics/ebitda-recast/${companyId}`),
    enabled: companyReady,
  })
  const profileQuery = useQuery({
    queryKey: ['engagement-profile', companyId],
    queryFn: () => apiClient.get(`/api/analytics/engagement-profile/${companyId}`).catch(() => null),
    enabled: companyReady,
  })

  const scores = scoresQuery.data
  const metrics = metricsQuery.data
  const recast = recastQuery.data

  const loading = scoresQuery.isPending || metricsQuery.isPending || recastQuery.isPending
  const pageError =
    scoresQuery.isError && scoresQuery.error?.message
      ? scoresQuery.error.message
      : metricsQuery.isError && metricsQuery.error?.message
        ? metricsQuery.error.message
          : recastQuery.isError && recastQuery.error?.message
          ? recastQuery.error.message
          : null

  if (!companyReady) {
    return (
      <div className="space-y-5 max-w-[1400px]">
        <SectionHeader
          title="EBITDA / EV Calculation Engine"
          subtitle="Reported EBITDA → Addback Schedule → Defensible EBITDA → Enterprise Value"
        />
        <p className="text-sm text-muted-foreground">
          Select or create a client in the header to load valuation data.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-5 max-w-[1400px]">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0,1,2,3].map(i => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <Skeleton className="h-2 w-20" /><Skeleton className="h-7 w-28" /><Skeleton className="h-2 w-32" />
            </div>
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!scores || !metrics || !recast) {
    return (
      <div className="space-y-5 max-w-[1400px]">
        {pageError && (
          <div
            className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400 flex items-center gap-2"
            role="alert"
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {pageError}
          </div>
        )}
        <p className="text-sm text-muted-foreground">Valuation data could not be loaded.</p>
      </div>
    )
  }

  // ── Derived values ──
  const ev             = scores?.enterprise_value ?? {}
  const sourceCitation = evCitationText(ev)
  const floor          = Number(ev?.floor) || 0
  const midpoint       = Number(ev?.midpoint) || 0
  const ceiling        = Number(ev?.ceiling) || 0
  const multipleUsed   = ev?.multiple_used ?? '—'
  const drs            = Number(scores?.drs?.base)
  const drsSafe        = Number.isFinite(drs) ? drs : 0
  const tier           = scores?.drs?.tier ?? '—'

  const totalRevenueTTM = parseFloat(metrics?.total_revenue_ttm ?? 0)
  const grossProfit     = parseFloat(metrics?.gross_profit ?? 0)
  const totalCOGS       = totalRevenueTTM - grossProfit
  const totalOpex       = parseFloat(metrics?.total_opex_ttm ?? 0)
  const reportedEBITDA  = Number(recast.reported_ebitda)
  const reportedSafe    = Number.isFinite(reportedEBITDA) ? reportedEBITDA : 0
  const grossMargin     = parseFloat(metrics?.gross_margin_pct ?? 0)
  const ebitdaMargin    = totalRevenueTTM > 0 ? (reportedSafe / totalRevenueTTM) * 100 : 0

  const expenseLines    = recast.expense_line_items ?? []
  const cogsLines       = expenseLines.filter(e => e.category === 'COGS')
  const opexLines       = expenseLines.filter(e => e.category !== 'COGS')

  const consEBITDA = Number(recast.conservative_ebitda)
  const baseEBITDA = Number(recast.base_ebitda)
  const aggEBITDA  = Number(recast.aggressive_ebitda)
  const consSafe   = Number.isFinite(consEBITDA) ? consEBITDA : reportedSafe
  const baseSafe   = Number.isFinite(baseEBITDA) ? baseEBITDA : reportedSafe
  const aggSafe    = Number.isFinite(aggEBITDA) ? aggEBITDA : reportedSafe

  const midMultiple   = reportedSafe > 0 && midpoint > 0 ? midpoint / reportedSafe : 3.0
  const floorMultiple = floor    > 0 && reportedSafe > 0 ? floor    / reportedSafe : 2.5
  const ceilMultiple  = ceiling  > 0 && reportedSafe > 0 ? ceiling  / reportedSafe : 3.5

  // Build multiples array centered on the actual midpoint multiple
  const midMultRounded = Math.round(midMultiple * 2) / 2  // nearest 0.5
  const multiples = Array.from({ length: 7 }, (_, i) => midMultRounded - 1.5 + i * 0.5)
    .filter(m => m > 0)

  const ebitdaVariants = [-15, -10, -5, 0, 5, 10, 15].map(pct => ({
    label: `${pct >= 0 ? '+' : ''}${pct}%`,
    value: baseSafe * (1 + pct / 100),
  }))

  const addbackSchedule = Array.isArray(recast.addback_schedule) ? recast.addback_schedule : []
  const dataNotes = Array.isArray(recast.data_notes) ? recast.data_notes : []
  const totalAddbacksNum = Number(recast.total_addbacks)
  const totalAddbacksSafe = Number.isFinite(totalAddbacksNum) ? totalAddbacksNum : 0

  async function handleCustomSave(body) {
    const key = `custom_${Date.now()}`
    try {
      const data = await apiClient.post(`/api/analytics/addbacks/${companyId}/${key}`, { ...body, is_custom: true })
      queryClient.setQueryData(['ebitda-recast', companyId], data)
      setAddingCustom(false)
      setPrefillAddback(null)
    } catch (e) {
      toast.error(e?.message || 'Could not add addback')
    }
  }

  function proposeLineAsAddback(line) {
    setPrefillAddback({ description: line.description, amount: line.amount })
    setAddingCustom(true)
    setTimeout(() => {
      document.getElementById('addback-schedule-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  function updateRecastCache(data) {
    queryClient.setQueryData(['ebitda-recast', companyId], data)
  }

  function invalidateValuationQueries() {
    queryClient.invalidateQueries({ queryKey: ['analytics-metrics', companyId] })
    queryClient.invalidateQueries({ queryKey: ['ebitda-recast', companyId] })
    queryClient.invalidateQueries({ queryKey: ['analytics-scores', companyId] })
    queryClient.invalidateQueries({ queryKey: ['advisory-workflow', companyId] })
  }

  const tierBadge = drsSafe >= 70
    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
    : drsSafe >= 55
    ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
    : 'border-red-500/20 bg-red-500/10 text-red-400'

  return (
    <div className="space-y-6 max-w-[1400px]">
      <SectionHeader
        title="EBITDA / EV Calculation Engine"
        subtitle="Reported EBITDA → Addback Schedule → Defensible EBITDA → Enterprise Value"
        action={
          <div className="flex items-center gap-2">
            {recast.has_overrides && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400">
                Advisor Overrides Active
              </span>
            )}
            <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border', tierBadge)}>
              DRS {drsSafe.toFixed(1)} · {tier.replace(/_/g, ' ')}
            </span>
          </div>
        }
      />

      {/* Valuation pipeline — visual flow */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
          {[
            { label: 'Gross Profit',      value: fmtM(grossProfit),   sub: `${grossMargin.toFixed(1)}% margin`,                         Icon: DollarSign, accent: 'blue'    },
            { label: 'Reported EBITDA',    value: fmtM(reportedSafe),  sub: `${ebitdaMargin.toFixed(1)}% of revenue`,                    Icon: BarChart2,  accent: 'purple'  },
            { label: 'Defensible EBITDA',  value: fmtM(baseSafe),      sub: `+${fmtM(totalAddbacksSafe)} addbacks`,                      Icon: Zap,        accent: 'emerald' },
            { label: 'Enterprise Value',   value: fmtM(midpoint),      sub: `${multipleUsed}× · ${tier.replace(/_/g,' ')}`,             Icon: TrendingUp, accent: 'amber'   },
          ].map((c, i, arr) => {
            const accentMap = {
              blue:    { text: 'text-blue-400',    bg: 'bg-blue-500/10',    icon: 'text-blue-400/50'    },
              purple:  { text: 'text-purple-400',  bg: 'bg-purple-500/10',  icon: 'text-purple-400/50'  },
              emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: 'text-emerald-400/50' },
              amber:   { text: 'text-amber-400',   bg: 'bg-amber-500/10',   icon: 'text-amber-400/50'   },
            }
            const a = accentMap[c.accent]
            return (
              <div key={c.label} className="flex items-center">
                <div className="flex-1 text-center py-3 px-2">
                  <div className={cn('w-9 h-9 rounded-full mx-auto mb-2 flex items-center justify-center', a.bg)}>
                    <c.Icon className={cn('w-4 h-4', a.icon)} />
                  </div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{c.label}</p>
                  <p className={cn('text-lg font-bold leading-tight', a.text)}>{c.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</p>
                </div>
                {i < arr.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-border flex-shrink-0 hidden md:block" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <EbitdaBasisPanel companyId={companyId} metrics={metrics} onSaved={invalidateValuationQueries} />

      {/* P&L → Reported EBITDA bridge */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-muted-foreground" />
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">P&L → Reported EBITDA</h3>
              <p className="text-[10px] text-muted-foreground">Click sections to expand · hover any line to propose as addback</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground uppercase tracking-wider">QuickBooks P&L</span>
        </div>

        <div className="px-5 py-1 font-mono text-xs">
          {/* Revenue */}
          <div className="flex items-center justify-between py-3 border-b border-border/40">
            <span className="text-foreground font-semibold">TTM Revenue</span>
            <span className="font-bold text-foreground text-sm">{fmtM(totalRevenueTTM)}</span>
          </div>

          {/* COGS section */}
          <button
            type="button"
            onClick={() => setCogsExpanded(x => !x)}
            className="w-full flex items-center justify-between py-2.5 border-b border-border/40 hover:bg-muted/20 rounded transition-colors"
          >
            <span className="flex items-center gap-1.5 text-muted-foreground pl-3">
              {cogsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span>− Cost of Revenue (COGS)</span>
              {cogsLines.length > 0 && (
                <span className="text-[10px] text-muted-foreground/50 font-sans">{cogsLines.length} items</span>
              )}
            </span>
            <span className="font-semibold text-red-400">({fmtM(totalCOGS)})</span>
          </button>
          {cogsExpanded && cogsLines.length > 0 && (
            <div className="bg-muted/10 border-b border-border/30">
              {cogsLines.map((line, i) => (
                <LineItemRow key={i} line={line} onPropose={() => proposeLineAsAddback(line)} />
              ))}
            </div>
          )}
          {cogsExpanded && cogsLines.length === 0 && (
            <div className="px-8 py-2.5 text-[11px] text-muted-foreground/50 italic border-b border-border/30 font-sans">
              No individual COGS lines available — upload a detailed P&L export
            </div>
          )}

          {/* Gross Profit */}
          <div className="flex items-center justify-between py-3 border-b border-border/40">
            <span className="text-foreground font-semibold">= Gross Profit</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-sans">{grossMargin.toFixed(1)}% margin</span>
              <span className="text-blue-400 font-bold text-sm">{fmtM(grossProfit)}</span>
            </div>
          </div>

          {/* OpEx section */}
          <button
            type="button"
            onClick={() => setOpexExpanded(x => !x)}
            className="w-full flex items-center justify-between py-2.5 border-b border-border/40 hover:bg-muted/20 rounded transition-colors"
          >
            <span className="flex items-center gap-1.5 text-muted-foreground pl-3">
              {opexExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span>− Operating Expenses (OpEx)</span>
              {opexLines.length > 0 && (
                <span className="text-[10px] text-muted-foreground/50 font-sans">{opexLines.length} items</span>
              )}
            </span>
            <span className="font-semibold text-red-400">({fmtM(totalOpex)})</span>
          </button>
          {opexExpanded && opexLines.length > 0 && (
            <div className="bg-muted/10 border-b border-border/30">
              {opexLines.map((line, i) => (
                <LineItemRow key={i} line={line} onPropose={() => proposeLineAsAddback(line)} />
              ))}
            </div>
          )}
          {opexExpanded && opexLines.length === 0 && (
            <div className="px-8 py-2.5 text-[11px] text-muted-foreground/50 italic border-b border-border/30 font-sans">
              No individual OpEx lines available — upload a detailed P&L export
            </div>
          )}

          {/* Reported EBITDA */}
          <div className="flex items-center justify-between py-3 bg-emerald-500/5 -mx-5 px-5 rounded-b-xl">
            <span className="text-foreground font-bold">= Reported EBITDA (TTM)</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-sans">{ebitdaMargin.toFixed(1)}% of revenue</span>
              <span className="text-emerald-400 font-bold text-sm">{fmtM(reportedSafe)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Addback Schedule */}
      <div id="addback-schedule-section" className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-muted-foreground" />
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">Addback Schedule</h3>
              <p className="text-[10px] text-muted-foreground">Click any row to override challenge rate or amount</p>
            </div>
          </div>
          {recast.has_overrides && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400">
              Overrides Applied
            </span>
          )}
        </div>
        <div className="p-5">

        {addbackSchedule.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-4 text-center">No addbacks detected from financial data.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-5" />
                  <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-2 pr-3">Addback Item</th>
                  <th className="text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-2 pr-3">Amount</th>
                  <th className="text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-2 px-3">Conservative</th>
                  <th className="text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-2 px-3">Base</th>
                  <th className="text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-2 px-3">Aggressive</th>
                  <th className="w-16" />
                </tr>
              </thead>
              {addbackSchedule.map(ab => (
                <AddbackRow key={ab.addback_key} ab={ab} onRecastUpdate={updateRecastCache} />
              ))}
              {/* Totals */}
              <tbody>
                <tr className="border-t-2 border-border bg-muted/20">
                  <td /><td className="py-3 pr-3 text-xs font-bold text-foreground">Total Addbacks</td>
                  <td className="py-3 pr-3 text-right text-xs font-bold font-mono text-foreground">{fmtM(totalAddbacksSafe)}</td>
                  <td className="py-3 px-3 text-right text-xs font-bold font-mono text-emerald-400">+{fmtM(consSafe - reportedSafe)}</td>
                  <td className="py-3 px-3 text-right text-xs font-bold font-mono text-emerald-400">+{fmtM(baseSafe - reportedSafe)}</td>
                  <td className="py-3 px-3 text-right text-xs font-bold font-mono text-emerald-400">+{fmtM(aggSafe - reportedSafe)}</td>
                  <td />
                </tr>
                <tr className="border-t border-border/50">
                  <td /><td className="py-3 pr-3 text-xs font-bold text-foreground">= Defensible EBITDA</td>
                  <td />
                  <td className="py-3 px-3 text-right text-sm font-bold font-mono text-red-400">{fmtM(consSafe)}</td>
                  <td className="py-3 px-3 text-right text-sm font-bold font-mono text-blue-400">{fmtM(baseSafe)}</td>
                  <td className="py-3 px-3 text-right text-sm font-bold font-mono text-emerald-400">{fmtM(aggSafe)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Challenge rate legend */}
        <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
          {Object.entries(CHALLENGE_META).map(([k, m]) => (
            <span key={k} className="flex items-center gap-1">
              <span className={cn('font-bold', m.color)}>{m.label}:</span>
              <span>
                {k === 'LOW'           && 'full amount in all scenarios'}
                {k === 'MEDIUM'        && 'excluded conservative · 50% base · 100% aggressive'}
                {k === 'HIGH'          && 'excluded from conservative · aggressive only'}
                {k === 'NOT_DEFENSIBLE'&& 'excluded from all scenarios'}
              </span>
            </span>
          ))}
        </div>

        {/* Add custom addback */}
        {!addingCustom ? (
          <button
            onClick={() => setAddingCustom(true)}
            className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-primary rounded-lg px-3 py-2 w-full justify-center transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Custom Addback
          </button>
        ) : (
          <div className="mt-4">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {prefillAddback ? `Propose Addback — ${prefillAddback.description}` : 'New Custom Addback'}
            </p>
            <AddbackEditor
              addback={prefillAddback}
              isNew
              onSave={handleCustomSave}
              onDelete={null}
              onClose={() => { setAddingCustom(false); setPrefillAddback(null) }}
            />
          </div>
        )}

        {/* Data notes */}
        {dataNotes.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/40 space-y-1">
            {dataNotes.map((n, i) => (
              <p key={i} className="text-[10px] text-muted-foreground/50 flex gap-1.5">
                <span className="text-muted-foreground/30">·</span>{n}
              </p>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* EV Range — uses base EBITDA from recast */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">Enterprise Value Range</h3>
              <p className="text-[10px] text-muted-foreground">Floor · Midpoint · Ceiling from defensible EBITDA × DRS-adjusted multiple</p>
            </div>
          </div>
          <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border', tierBadge)}>
            {multipleUsed}× EBITDA
          </span>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Horizontal range bar */}
          {ceiling > 0 && (() => {
            const rangeMin = floor * 0.85
            const rangeMax = ceiling * 1.08
            const span = rangeMax - rangeMin || 1
            const floorPct = ((floor - rangeMin) / span) * 100
            const ceilPct = ((ceiling - rangeMin) / span) * 100
            const midPct = ((midpoint - rangeMin) / span) * 100
            return (
              <div className="space-y-2">
                {/* Bar */}
                <div className="relative h-8 rounded-lg bg-muted/30">
                  <div
                    className="absolute top-0 bottom-0 bg-gradient-to-r from-red-500/15 via-emerald-500/20 to-emerald-500/10 rounded-lg"
                    style={{ left: `${floorPct}%`, width: `${ceilPct - floorPct}%` }}
                  />
                  <div className="absolute top-0 bottom-0 w-0.5 bg-red-400/60" style={{ left: `${floorPct}%` }} />
                  <div className="absolute top-0 bottom-0 w-0.5 bg-emerald-400/40" style={{ left: `${ceilPct}%` }} />
                  <div
                    className="absolute top-1 bottom-1 w-1 bg-emerald-400 rounded-full shadow-lg shadow-emerald-500/30"
                    style={{ left: `calc(${midPct}% - 2px)` }}
                  />
                </div>
                {/* Labels below bar */}
                <div className="relative h-5">
                  <div className="absolute text-[11px] font-bold text-red-400 -translate-x-1/2" style={{ left: `${floorPct}%` }}>
                    {fmtM(floor)}
                  </div>
                  <div className="absolute text-[11px] font-bold text-emerald-400 -translate-x-1/2" style={{ left: `${midPct}%` }}>
                    {fmtM(midpoint)}
                  </div>
                  <div className="absolute text-[11px] font-bold text-emerald-400/70 -translate-x-1/2" style={{ left: `${ceilPct}%` }}>
                    {fmtM(ceiling)}
                  </div>
                </div>
                {/* Sub-labels */}
                <div className="relative h-4">
                  <div className="absolute text-[10px] text-muted-foreground -translate-x-1/2" style={{ left: `${floorPct}%` }}>
                    Floor · {floorMultiple.toFixed(1)}×
                  </div>
                  <div className="absolute text-[10px] text-muted-foreground -translate-x-1/2" style={{ left: `${midPct}%` }}>
                    Midpoint · {midMultiple.toFixed(1)}×
                  </div>
                  <div className="absolute text-[10px] text-muted-foreground -translate-x-1/2" style={{ left: `${ceilPct}%` }}>
                    Ceiling · {ceilMultiple.toFixed(1)}×
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Three EV scenarios */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Floor', value: floor, mult: floorMultiple, color: 'red', desc: 'Conservative' },
              { label: 'Midpoint', value: midpoint, mult: midMultiple, color: 'emerald', desc: 'Base case' },
              { label: 'Ceiling', value: ceiling, mult: ceilMultiple, color: 'emerald', desc: 'Optimistic' },
            ].map(s => {
              const isGreen = s.color === 'emerald'
              return (
                <div key={s.label} className={cn(
                  'rounded-lg border p-3 text-center',
                  isGreen ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5',
                )}>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{s.desc}</p>
                  <p className={cn('text-xl font-bold', isGreen ? 'text-emerald-400' : 'text-red-400')}>{fmtM(s.value)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{s.mult.toFixed(1)}× EBITDA</p>
                </div>
              )
            })}
          </div>

          {/* Source citation */}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 group/cite relative">
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
            {sourceCitation.length > 40 ? (
              <span className="cursor-help border-b border-dotted border-muted-foreground/30">
                {sourceCitation.slice(0, 40)}…
                <span className="invisible group-hover/cite:visible absolute bottom-full left-0 mb-1.5 z-20 max-w-sm px-3 py-2 rounded-lg border border-border bg-card text-[11px] text-foreground shadow-lg whitespace-normal">
                  {sourceCitation}
                </span>
              </span>
            ) : (
              <span>{sourceCitation}</span>
            )}
          </div>
        </div>
      </div>

      {/* Owner Financial Target vs. Current EV */}
      {(() => {
        const ep = profileQuery.data
        const ownerTarget = ep?.target_valuation != null ? Number(ep.target_valuation) : null
        const financialGap = ep?.personal_financial_gap != null ? Number(ep.personal_financial_gap) : null
        const evGap = ownerTarget && midpoint ? Math.max(0, ownerTarget - midpoint) : null
        if (!ownerTarget && !financialGap) return null
        return (
          <div className="rounded-xl border border-amber-500/20 bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-amber-500/5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-card-foreground">Owner Financial Gap</h3>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              {ownerTarget != null && (
                <div className="text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Owner Target</p>
                  <p className="text-lg font-bold text-amber-400">{fmtM(ownerTarget)}</p>
                </div>
              )}
              <div className="text-center">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Current EV Midpoint</p>
                <p className="text-lg font-bold text-blue-400">{fmtM(midpoint)}</p>
              </div>
              {evGap != null && evGap > 0 && (
                <div className="text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">EV Shortfall</p>
                  <p className="text-lg font-bold text-red-400">{fmtM(evGap)}</p>
                </div>
              )}
              {financialGap != null && (
                <div className="text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Personal Fin. Gap</p>
                  <p className="text-lg font-bold text-red-400">{fmtM(financialGap)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">from engagement intake</p>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Sensitivity Matrix */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-muted-foreground" />
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">Sensitivity Matrix</h3>
              <p className="text-[10px] text-muted-foreground">Enterprise value at different EBITDA levels × multiple assumptions</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-muted-foreground px-2 py-0.5 rounded-full border border-border bg-muted">
            Base: {fmtM(baseSafe)} × {midMultiple.toFixed(1)}×
          </span>
        </div>
        <div className="px-5 py-4 overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr>
                <th className="text-left text-[10px] text-muted-foreground py-2 pr-4 font-bold uppercase tracking-wider">EBITDA scenario</th>
                {multiples.map(m => (
                  <th key={m} className={cn(
                    'text-center py-2 px-2 font-bold',
                    Math.abs(m - Math.round(midMultiple * 2) / 2) < 0.01 ? 'text-primary' : 'text-muted-foreground',
                  )}>
                    {m}×
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ebitdaVariants.map(e => {
                const isBaseRow = e.label === '+0%'
                return (
                  <tr key={e.label} className={cn(
                    'border-t border-border/30 transition-colors',
                    isBaseRow ? 'bg-primary/5' : 'hover:bg-muted/20',
                  )}>
                    <td className={cn('py-2 pr-4 font-semibold whitespace-nowrap', isBaseRow ? 'text-foreground' : 'text-muted-foreground')}>
                      <span className="inline-block w-8">{e.label}</span>
                      <span className="text-muted-foreground/50 ml-1">({fmtM(e.value)})</span>
                    </td>
                    {multiples.map(m => {
                      const val = e.value * m
                      const isBase = isBaseRow && Math.abs(m - Math.round(midMultiple * 2) / 2) < 0.01
                      const isAboveCeiling = val >= ceiling
                      const isBelowFloor = val <= floor
                      return (
                        <td key={m} className={cn(
                          'text-center py-2 px-2 font-medium tabular-nums',
                          isBase
                            ? 'font-bold text-primary bg-primary/10 rounded'
                            : isAboveCeiling ? 'text-emerald-400'
                            : isBelowFloor ? 'text-red-400/70'
                            : 'text-foreground/80',
                        )}>
                          {fmtM(val)}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30 text-[10px] text-muted-foreground/50">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary/30" /> Current base case</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/30" /> Above ceiling ({fmtM(ceiling)})</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/30" /> Below floor ({fmtM(floor)})</span>
          </div>
        </div>
      </div>

      {/* Assumptions footnote */}
      <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4 flex gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-400/60 flex-shrink-0 mt-0.5" />
        <div className="text-[11px] text-muted-foreground/80 leading-relaxed space-y-1">
          <p className="font-semibold text-amber-400 text-xs">Important Assumptions</p>
          <p>
            EV multiples: <span className="text-foreground/70">{sourceCitation}</span>
          </p>
          <p>
            Owner compensation market rate: <span className="text-foreground/70">${Number(recast.market_rate ?? 120000).toLocaleString()}/yr</span> (editable in the EBITDA basis panel above).
          </p>
          <p>
            Challenge rates: <span className="text-emerald-400/70">Low</span> = 100% all scenarios · <span className="text-amber-400/70">Medium</span> = 0% conservative, 50% base, 100% aggressive · <span className="text-red-400/70">High</span> = aggressive only.
          </p>
          <p className="text-muted-foreground/50 text-[10px]">
            These are advisory estimates for pre-diligence planning. This is not a formal valuation opinion or fairness assessment.
          </p>
        </div>
      </div>
    </div>
  )
}
