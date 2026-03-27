import { useState, useEffect, useCallback } from 'react'
import SectionHeader from '../components/ui/SectionHeader'
import { cn, fmtM } from '../lib/utils'
import {
  TrendingUp, DollarSign, Zap, BarChart2, AlertTriangle,
  ExternalLink, Edit2, Check, X, Plus, Trash2, ChevronDown, ChevronRight,
} from 'lucide-react'
import { apiUrl } from '../lib/apiClient'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Skeleton } from '../components/ui/Skeleton'
import { useCompanyId } from '../context/CompanyContext'

const MARKET_RATE = 120000

// ── Challenge badge ────────────────────────────────────────────────────────
const CHALLENGE_META = {
  LOW:             { label: 'Low Challenge',      color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', consMultiplier: 1.0, baseMultiplier: 1.0, aggMultiplier: 1.0 },
  MEDIUM:          { label: 'Medium Challenge',   color: 'text-amber-400',   border: 'border-amber-500/30',   bg: 'bg-amber-500/10',   consMultiplier: 0.5, baseMultiplier: 0.5, aggMultiplier: 1.0 },
  HIGH:            { label: 'High Challenge',     color: 'text-red-400',     border: 'border-red-500/30',     bg: 'bg-red-500/10',     consMultiplier: 0.0, baseMultiplier: 0.0, aggMultiplier: 1.0 },
  NOT_DEFENSIBLE:  { label: 'Not Defensible',     color: 'text-muted-foreground', border: 'border-border', bg: 'bg-muted/30',       consMultiplier: 0.0, baseMultiplier: 0.0, aggMultiplier: 0.0 },
}

function ChallengeBadge({ challenge }) {
  const m = CHALLENGE_META[challenge] ?? CHALLENGE_META.MEDIUM
  return (
    <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border', m.color, m.border, m.bg)}>
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
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Description</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Vehicle lease through business"
            className="mt-1 w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Amount ($)</label>
          <input
            type="number" value={amount} onChange={e => setAmount(e.target.value)}
            className="mt-1 w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Challenge Rate</label>
          <select
            value={challenge} onChange={e => setChallenge(e.target.value)}
            className="mt-1 w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
          >
            <option value="LOW">Low — fully defensible</option>
            <option value="MEDIUM">Medium — 50% conservative</option>
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
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Notes</label>
        <input
          value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Supporting detail or source reference"
          className="mt-1 w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Advisor Rationale <span className="text-red-400">*</span>
        </label>
        <textarea
          value={rationale} onChange={e => setRationale(e.target.value)} rows={2}
          placeholder="Why are you overriding this challenge rate? (required for audit trail)"
          className="mt-1 w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary resize-none"
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
    const res = await fetch(apiUrl(`/api/analytics/addbacks/${companyId}/${ab.addback_key}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, addback_key: ab.addback_key }),
    })
    if (res.ok) { onRecastUpdate(await res.json()); setOpen(false) }
  }

  async function handleDelete() {
    const res = await fetch(apiUrl(`/api/analytics/addbacks/${companyId}/${ab.addback_key}`), { method: 'DELETE' })
    if (res.ok) { onRecastUpdate(await res.json()); setOpen(false) }
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
              <span className="text-[8px] font-bold px-1 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400">OVERRIDDEN</span>
            )}
            {ab.is_custom && (
              <span className="text-[8px] font-bold px-1 py-0.5 rounded border border-purple-500/30 bg-purple-500/10 text-purple-400">CUSTOM</span>
            )}
            <ChallengeBadge challenge={ab.challenge} />
          </div>
          {ab.notes && <p className="text-[10px] text-muted-foreground mt-0.5">{ab.notes}</p>}
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
            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-opacity"
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

// ── Main page ──────────────────────────────────────────────────────────────
export default function Valuation() {
  const companyId = useCompanyId()
  const [scores,  setScores]  = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [recast,  setRecast]  = useState(null)
  const [addingCustom, setAddingCustom] = useState(false)

  const loadRecast = useCallback(() =>
    fetch(apiUrl(`/api/analytics/ebitda-recast/${companyId}`))
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setRecast(d) })
      .catch(() => {}), [companyId])

  useEffect(() => {
    fetch(apiUrl(`/api/analytics/scores/${companyId}`))
      .then(r => r.ok ? r.json() : null).then(setScores).catch(() => {})
    fetch(apiUrl(`/api/analytics/metrics/${companyId}`))
      .then(r => r.ok ? r.json() : null).then(setMetrics).catch(() => {})
    loadRecast()
  }, [companyId, loadRecast])

  if (!scores || !metrics || !recast) {
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

  // ── Derived values ──
  const ev             = scores?.enterprise_value ?? {}
  const sourceCitation = ev?.valuation_summary ?? ev?.source_citation ?? 'DRS-based internal multiple band (no third-party market feed configured).'
  const floor          = ev?.floor    ?? 0
  const midpoint       = ev?.midpoint ?? 0
  const ceiling        = ev?.ceiling  ?? 0
  const multipleUsed   = ev?.multiple_used ?? '—'
  const drs            = scores?.drs?.base ?? 0
  const tier           = scores?.drs?.tier ?? '—'

  const totalRevenueTTM = parseFloat(metrics?.total_revenue_ttm ?? 0)
  const grossProfit     = parseFloat(metrics?.gross_profit ?? 0)
  const totalCOGS       = totalRevenueTTM - grossProfit
  const totalOpex       = parseFloat(metrics?.total_opex_ttm ?? 0)
  const reportedEBITDA  = recast.reported_ebitda
  const grossMargin     = parseFloat(metrics?.gross_margin_pct ?? 0)
  const ebitdaMargin    = totalRevenueTTM > 0 ? (reportedEBITDA / totalRevenueTTM) * 100 : 0

  const consEBITDA = recast.conservative_ebitda
  const baseEBITDA = recast.base_ebitda
  const aggEBITDA  = recast.aggressive_ebitda

  const midMultiple   = reportedEBITDA > 0 && midpoint > 0 ? midpoint / reportedEBITDA : 3.0
  const floorMultiple = floor    > 0 && reportedEBITDA > 0 ? floor    / reportedEBITDA : 2.5
  const ceilMultiple  = ceiling  > 0 && reportedEBITDA > 0 ? ceiling  / reportedEBITDA : 3.5

  const multiples      = [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5]
  const ebitdaVariants = [-15, -10, -5, 0, 5, 10, 15].map(pct => ({
    label: `${pct >= 0 ? '+' : ''}${pct}%`,
    value: baseEBITDA * (1 + pct / 100),
  }))

  async function handleCustomSave(body) {
    const key = `custom_${Date.now()}`
    const res = await fetch(apiUrl(`/api/analytics/addbacks/${companyId}/${key}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, is_custom: true }),
    })
    if (res.ok) { setRecast(await res.json()); setAddingCustom(false) }
  }

  const colorMap = {
    blue:    { border: 'border-blue-500/20',    bg: 'bg-blue-500/5',    text: 'text-blue-400',    icon: 'text-blue-400/60'    },
    purple:  { border: 'border-purple-500/20',  bg: 'bg-purple-500/5',  text: 'text-purple-400',  icon: 'text-purple-400/60'  },
    emerald: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', text: 'text-emerald-400', icon: 'text-emerald-400/60' },
    amber:   { border: 'border-amber-500/20',   bg: 'bg-amber-500/5',   text: 'text-amber-400',   icon: 'text-amber-400/60'   },
  }

  const headlines = [
    { label: 'Gross Profit',         value: fmtM(grossProfit), sub: `${grossMargin.toFixed(1)}% gross margin`,      color: 'blue',    icon: DollarSign },
    { label: 'Reported EBITDA (TTM)',value: fmtM(reportedEBITDA), sub: `${ebitdaMargin.toFixed(1)}% margin · pre-addback`, color: 'purple',  icon: BarChart2  },
    { label: 'Defensible EBITDA',    value: fmtM(baseEBITDA),  sub: `Base case · ${fmtM(recast.total_addbacks)} total addbacks`, color: 'emerald', icon: Zap        },
    { label: 'Indicated EV (Mid)',   value: fmtM(midpoint),    sub: `${multipleUsed}× EBITDA · ${tier}`,             color: 'amber',   icon: TrendingUp },
  ]

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader
        title="EBITDA / EV Calculation Engine"
        subtitle="Reported EBITDA → Addback Schedule → Defensible EBITDA → Enterprise Value"
        action={
          <div className="flex items-center gap-2">
            {recast.has_overrides && (
              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400">
                Advisor Overrides Active
              </span>
            )}
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
              DRS {drs.toFixed(1)} · {tier}
            </span>
          </div>
        }
      />

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {headlines.map(c => {
          const cl = colorMap[c.color]; const Icon = c.icon
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

      {/* P&L → Reported EBITDA bridge */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">P&amp;L → Reported EBITDA</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Revenue walk before addbacks — QuickBooks P&amp;L data</p>
          </div>
          <span className="text-[9px] font-semibold px-2 py-0.5 rounded border border-border text-muted-foreground">QuickBooks P&amp;L</span>
        </div>
        <div className="space-y-0 font-mono text-xs">
          {[
            { label: 'TTM Revenue',                 value: totalRevenueTTM,  sign: null,     bold: false },
            { label: '− Cost of Revenue (COGS)',    value: totalCOGS,        sign: 'neg',    indent: true },
            { label: '= Gross Profit',              value: grossProfit,      sign: 'pos',    bold: true, sub: `${grossMargin.toFixed(1)}%` },
            { label: '− Operating Expenses (OpEx)', value: totalOpex,        sign: 'neg',    indent: true },
            { label: '= Reported EBITDA (TTM)',     value: reportedEBITDA,   sign: 'ebitda', bold: true, sub: `${ebitdaMargin.toFixed(1)}%` },
          ].map(row => (
            <div key={row.label} className={cn(
              'flex items-center justify-between py-2 border-b border-border/50 last:border-0',
              row.bold && 'font-semibold',
            )}>
              <span className={cn('text-muted-foreground', row.indent && 'pl-4', row.bold && 'text-foreground')}>{row.label}</span>
              <div className="text-right">
                <span className={cn('font-semibold',
                  row.sign === 'neg'   ? 'text-red-400' :
                  row.sign === 'pos'   ? 'text-blue-400' :
                  row.sign === 'ebitda'? 'text-emerald-400' : 'text-foreground'
                )}>
                  {row.sign === 'neg' ? `(${fmtM(row.value)})` : fmtM(row.value)}
                </span>
                {row.sub && <span className="text-muted-foreground ml-2">{row.sub}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Addback Schedule */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">Addback Schedule</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Each addback shows how it flows into Conservative / Base / Aggressive EBITDA scenarios.
              Click any row to override the challenge rate or amount.
            </p>
          </div>
          {recast.has_overrides && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400">
              Advisor Overrides Applied
            </span>
          )}
        </div>

        {recast.addback_schedule.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-4 text-center">No addbacks detected from financial data.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-5" />
                  <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-2 pr-3">Addback Item</th>
                  <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-2 pr-3">Amount</th>
                  <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-2 px-3">Conservative</th>
                  <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-2 px-3">Base</th>
                  <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-2 px-3">Aggressive</th>
                  <th className="w-16" />
                </tr>
              </thead>
              {recast.addback_schedule.map(ab => (
                <AddbackRow key={ab.addback_key} ab={ab} onRecastUpdate={setRecast} />
              ))}
              {/* Totals */}
              <tbody>
                <tr className="border-t-2 border-border bg-muted/20">
                  <td /><td className="py-3 pr-3 text-xs font-bold text-foreground">Total Addbacks</td>
                  <td className="py-3 pr-3 text-right text-xs font-bold font-mono text-foreground">{fmtM(recast.total_addbacks)}</td>
                  <td className="py-3 px-3 text-right text-xs font-bold font-mono text-emerald-400">+{fmtM(consEBITDA - reportedEBITDA)}</td>
                  <td className="py-3 px-3 text-right text-xs font-bold font-mono text-emerald-400">+{fmtM(baseEBITDA - reportedEBITDA)}</td>
                  <td className="py-3 px-3 text-right text-xs font-bold font-mono text-emerald-400">+{fmtM(aggEBITDA - reportedEBITDA)}</td>
                  <td />
                </tr>
                <tr className="border-t border-border/50">
                  <td /><td className="py-3 pr-3 text-xs font-bold text-foreground">= Defensible EBITDA</td>
                  <td />
                  <td className="py-3 px-3 text-right text-sm font-bold font-mono text-red-400">{fmtM(consEBITDA)}</td>
                  <td className="py-3 px-3 text-right text-sm font-bold font-mono text-blue-400">{fmtM(baseEBITDA)}</td>
                  <td className="py-3 px-3 text-right text-sm font-bold font-mono text-emerald-400">{fmtM(aggEBITDA)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Challenge rate legend */}
        <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap gap-4 text-[10px] text-muted-foreground">
          {Object.entries(CHALLENGE_META).map(([k, m]) => (
            <span key={k} className="flex items-center gap-1">
              <span className={cn('font-bold', m.color)}>{m.label}:</span>
              <span>
                {k === 'LOW'           && 'full amount in all scenarios'}
                {k === 'MEDIUM'        && '50% conservative · 100% aggressive'}
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
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">New Custom Addback</p>
            <AddbackEditor
              addback={null}
              isNew
              onSave={handleCustomSave}
              onDelete={null}
              onClose={() => setAddingCustom(false)}
            />
          </div>
        )}

        {/* Data notes */}
        <div className="mt-4 pt-4 border-t border-border/50 space-y-1">
          {recast.data_notes.map((n, i) => (
            <p key={i} className="text-[10px] text-muted-foreground/60 flex gap-1.5">
              <span className="text-muted-foreground/40">·</span>{n}
            </p>
          ))}
        </div>
      </div>

      {/* EV Range — uses base EBITDA from recast */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">Enterprise Value Range</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Floor · Midpoint · Ceiling based on defensible EBITDA and DRS-adjusted multiple</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">{multipleUsed}×</span>
            <span className="flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded border border-blue-500/20 bg-blue-500/5 text-blue-400">
              <ExternalLink className="w-2.5 h-2.5" />{sourceCitation}
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={[
            { name: 'Floor',     value: floor    },
            { name: 'Midpoint',  value: midpoint },
            { name: 'Ceiling',   value: ceiling  },
          ]} margin={{ top: 5, right: 20, bottom: 0, left: 20 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(220,10%,50%)' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={({ active, payload }) => active && payload?.length ? (
              <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs">
                <p className="font-bold text-foreground">{fmtM(payload[0].value)}</p>
              </div>
            ) : null} />
            <Bar dataKey="value" radius={[6,6,0,0]} barSize={80}>
              <Cell fill="hsl(0,72%,51%)" fillOpacity={0.7} />
              <Cell fill="hsl(160,84%,39%)" fillOpacity={1} />
              <Cell fill="hsl(160,84%,39%)" fillOpacity={0.7} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-3 gap-4 mt-2 pt-4 border-t border-border">
          {[
            { label: 'Conservative Floor', value: floor,    mult: floorMultiple, color: 'text-red-400'     },
            { label: 'Base Case',          value: midpoint, mult: midMultiple,   color: 'text-blue-400'    },
            { label: 'Optimistic Ceiling', value: ceiling,  mult: ceilMultiple,  color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="text-[10px] text-muted-foreground mb-1">{s.label}</p>
              <p className={cn('text-lg font-bold', s.color)}>{fmtM(s.value)}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{s.mult.toFixed(1)}× EBITDA</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sensitivity Matrix */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-card-foreground">Sensitivity Matrix — EBITDA × Multiple</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Based on defensible EBITDA (base case)</p>
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
                    const isBase = e.label === '+0%' && Math.abs(m - Math.round(midMultiple * 2) / 2) < 0.01
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

      {/* Assumptions footnote */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-[11px] text-muted-foreground leading-relaxed">
          <span className="font-semibold text-amber-400">Platform Assumptions: </span>
          EV range: <span className="text-foreground font-medium">{sourceCitation}</span>
          Owner compensation market rate set at <span className="text-foreground font-medium">${MARKET_RATE.toLocaleString()}/yr (BLS OES 2024)</span>.
          Challenge rates determine addback inclusion: Low = 100% all scenarios; Medium = 50% conservative, 100% aggressive; High = aggressive only.
          These are advisory estimates, not a formal valuation opinion.
        </div>
      </div>
    </div>
  )
}
