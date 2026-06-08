import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { cn, fmtM } from '../lib/utils'
import {
  TrendingUp, Plus, CheckCircle, Clock, ChevronUp, ChevronDown,
  Calendar, X, ArrowUpRight, Target, Sparkles, AlertTriangle,
} from 'lucide-react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'
import { Skeleton } from '../components/ui/Skeleton'
import { apiClient } from '../lib/apiClient'
import { useCompanyId } from '../context/CompanyContext'
import { usePageTitle } from '../hooks/usePageTitle'

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_STYLE = {
  HIGH_RISK:     { label: 'High Risk',     cls: 'bg-red-500/10    text-red-400    border-red-500/20'     },
  PRE_DILIGENCE: { label: 'Pre-Diligence', cls: 'bg-red-500/10    text-red-400    border-red-500/20'     },
  CONDITIONAL:   { label: 'Conditional',   cls: 'bg-amber-500/10  text-amber-400  border-amber-500/20'   },
  INVESTMENT:    { label: 'Investment',    cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  INSTITUTIONAL: { label: 'Institutional', cls: 'bg-blue-500/10   text-blue-400   border-blue-500/20'    },
}

const STAGE_META = {
  onboarding:      { label: 'Onboarding',         color: 'text-slate-400' },
  data_collection: { label: 'Data Collection',    color: 'text-sky-400'   },
  baseline:        { label: 'Baseline Valuation', color: 'text-purple-400' },
  ebitda_recast:   { label: 'EBITDA Recast',      color: 'text-amber-400' },
  value_gap:       { label: 'Value Gap Analysis', color: 'text-emerald-400' },
  projected_90d:   { label: '90-Day Projection',  color: 'text-cyan-400'  },
  target:          { label: 'Investment Target',  color: 'text-emerald-400' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtX(v) { return v != null ? `${Number(v).toFixed(1)}×` : '—' }
function fmtDRS(v) { return v != null ? Number(v).toFixed(1) : '—' }

function DeltaBadge({ current, prev, formatter, showPct = true }) {
  const fmt = formatter ?? fmtM
  if (prev == null || current == null) return null
  const diff = current - prev
  if (Math.abs(diff) < 0.001) return null
  const pos = diff > 0
  const pct = Math.abs(prev) > 0.001 ? Math.round(Math.abs(diff / prev) * 100) : null
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[11px] font-semibold leading-none',
      pos ? 'text-emerald-400' : 'text-red-400',
    )}>
      {pos ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
      {fmt(Math.abs(diff))}
      {showPct && pct != null ? ` (${pct}%)` : ''}
    </span>
  )
}

// ─── Chart Tooltips ───────────────────────────────────────────────────────────

function EVTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2.5 shadow-xl text-xs space-y-1 min-w-[170px]">
      <p className="font-semibold text-foreground text-[11px]">{label}</p>
      {d?.ev_midpoint != null && (
        <p className="text-emerald-400 font-bold">{fmtM(d.ev_midpoint)} midpoint</p>
      )}
      {d?.ev_floor != null && (
        <p className="text-muted-foreground">{fmtM(d.ev_floor)} – {fmtM(d.ev_ceiling)} range</p>
      )}
      {d?.multiple_floor != null && (
        <p className="text-amber-400">{fmtX(d.multiple_floor)} – {fmtX(d.multiple_ceiling)} multiple</p>
      )}
      {d?.status === 'projected' && (
        <p className="text-[11px] text-muted-foreground/60 italic">Projected</p>
      )}
    </div>
  )
}

function MultipleTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2.5 shadow-xl text-xs space-y-1 min-w-[160px]">
      <p className="font-semibold text-foreground text-[11px]">{label}</p>
      {d?.multiple_floor != null && (
        <p className="text-amber-400 font-bold">{fmtX(d.multiple_floor)} – {fmtX(d.multiple_ceiling)}</p>
      )}
      {d?.drs != null && (
        <p className="text-blue-400">DRS {Number(d.drs).toFixed(1)}</p>
      )}
      {d?.drs_tier && (
        <p className="text-muted-foreground">{TIER_STYLE[d.drs_tier]?.label ?? d.drs_tier}</p>
      )}
      {d?.status === 'projected' && (
        <p className="text-[11px] text-muted-foreground/60 italic">Projected</p>
      )}
    </div>
  )
}

function DRSTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2.5 shadow-xl text-xs space-y-1">
      <p className="font-semibold text-foreground text-[11px]">{label}</p>
      <p className="text-blue-400 font-bold">DRS {Number(payload[0].value).toFixed(1)}</p>
      {d?.drs_tier && (
        <p className="text-muted-foreground">{TIER_STYLE[d.drs_tier]?.label ?? d.drs_tier}</p>
      )}
      {d?.status === 'projected' && (
        <p className="text-[11px] text-muted-foreground/60 italic">Projected</p>
      )}
    </div>
  )
}

// ─── Add Snapshot Modal ───────────────────────────────────────────────────────

const BLANK_SNAP = {
  milestone: '', date: '', stage: 'value_gap', status: 'complete',
  drs: '', drs_tier: '', ebitda: '', ev_floor: '', ev_ceiling: '', ev_midpoint: '',
  multiple_floor: '', multiple_ceiling: '', notes: '',
}

function AddSnapshotModal({ onClose, onAdd }) {
  const [form, setForm] = useState(BLANK_SNAP)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const canSubmit = form.milestone.trim().length > 0 && form.date.trim().length > 0

  async function submit() {
    if (!canSubmit) return
    const parseNum = v => v.toString().trim() ? parseFloat(v.toString().replace(/,/g, '')) : null
    const payload = {
      ...form,
      drs: parseNum(form.drs),
      drs_tier: form.drs_tier || null,
      ebitda: parseNum(form.ebitda),
      ev_floor: parseNum(form.ev_floor),
      ev_ceiling: parseNum(form.ev_ceiling),
      ev_midpoint: parseNum(form.ev_midpoint),
      multiple_floor: parseNum(form.multiple_floor),
      multiple_ceiling: parseNum(form.multiple_ceiling),
    }
    setSaving(true)
    try {
      await onAdd(payload)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground placeholder:text-muted-foreground/45 focus:text-foreground focus:outline-none focus:ring-1 focus:ring-primary'
  const labelCls = 'text-[11px] font-semibold text-muted-foreground uppercase tracking-wider'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-bold text-foreground">Add Engagement Snapshot</h2>
            <p className="text-[11px] text-muted-foreground">Record a new EBITDA / EV checkpoint</p>
          </div>
          <button onClick={onClose} className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[68vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label className={labelCls}>Milestone Name *</label>
              <input value={form.milestone} onChange={e => set('milestone', e.target.value)}
                placeholder="e.g. Q2 Check-in, Post-Initiative Review"
                className={inputCls} />
            </div>

            <div className="space-y-1">
              <label className={labelCls}>Date *</label>
              <input value={form.date} onChange={e => set('date', e.target.value)}
                placeholder="e.g. Jun 15, 2025"
                className={inputCls} />
            </div>

            <div className="space-y-1">
              <label className={labelCls}>Stage</label>
              <select value={form.stage} onChange={e => set('stage', e.target.value)}
                className={inputCls}>
                {Object.entries(STAGE_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className={inputCls}>
                <option value="complete">Complete</option>
                <option value="current">Current</option>
                <option value="projected">Projected</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className={labelCls}>DRS Tier</label>
              <select value={form.drs_tier} onChange={e => set('drs_tier', e.target.value)}
                className={inputCls}>
                <option value="">— None —</option>
                {Object.entries(TIER_STYLE).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className={labelCls}>DRS Score (0–100)</label>
              <input type="number" step="0.1" min="0" max="100"
                value={form.drs} onChange={e => set('drs', e.target.value)}
                placeholder="e.g. 62.5"
                className={inputCls} />
            </div>

            <div className="space-y-1">
              <label className={labelCls}>Defensible EBITDA ($)</label>
              <input value={form.ebitda} onChange={e => set('ebitda', e.target.value)}
                placeholder="e.g. 888578"
                className={inputCls} />
            </div>

            <div className="space-y-1">
              <label className={labelCls}>EV Midpoint ($)</label>
              <input value={form.ev_midpoint} onChange={e => set('ev_midpoint', e.target.value)}
                placeholder="e.g. 2665734"
                className={inputCls} />
            </div>

            <div className="space-y-1">
              <label className={labelCls}>EV Floor ($)</label>
              <input value={form.ev_floor} onChange={e => set('ev_floor', e.target.value)}
                placeholder="e.g. 2221445"
                className={inputCls} />
            </div>

            <div className="space-y-1">
              <label className={labelCls}>EV Ceiling ($)</label>
              <input value={form.ev_ceiling} onChange={e => set('ev_ceiling', e.target.value)}
                placeholder="e.g. 3110023"
                className={inputCls} />
            </div>

            <div className="space-y-1">
              <label className={labelCls}>Multiple Floor (×)</label>
              <input type="number" step="0.1"
                value={form.multiple_floor} onChange={e => set('multiple_floor', e.target.value)}
                placeholder="e.g. 2.5"
                className={inputCls} />
            </div>

            <div className="space-y-1">
              <label className={labelCls}>Multiple Ceiling (×)</label>
              <input type="number" step="0.1"
                value={form.multiple_ceiling} onChange={e => set('multiple_ceiling', e.target.value)}
                placeholder="e.g. 3.5"
                className={inputCls} />
            </div>

            <div className="col-span-2 space-y-1">
              <label className={labelCls}>Advisor Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                rows={3} placeholder="Key developments, risks resolved, next steps..."
                className={cn(inputCls, 'resize-none')} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} type="button"
            className="text-xs px-4 py-2 rounded-lg border border-border text-muted-foreground hover:bg-muted/30 transition-colors">
            Cancel
          </button>
          <button onClick={submit} type="button" disabled={!canSubmit || saving}
            className={cn(
              'text-xs px-4 py-2 rounded-lg font-semibold transition-colors',
              canSubmit && !saving
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed',
            )}>
            {saving ? 'Saving…' : 'Add Snapshot'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Snapshot Timeline Card ───────────────────────────────────────────────────

function SnapshotCard({ snap, prev, isLast }) {
  const stageMeta = STAGE_META[snap.stage] ?? { label: snap.stage, color: 'text-slate-400' }
  const tierMeta = snap.drs_tier ? TIER_STYLE[snap.drs_tier] : null

  // Find previous snapshot that has ev_midpoint for delta comparison
  const prevWithEV = prev?.ev_midpoint != null ? prev : null
  const prevWithDRS = prev?.drs != null ? prev : null

  return (
    <div className="flex gap-4">
      {/* Spine */}
      <div className="flex flex-col items-center flex-shrink-0 w-9">
        <div className={cn(
          'w-9 h-9 rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10',
          snap.status === 'complete'  ? 'border-emerald-500/50 bg-emerald-500/10' :
          snap.status === 'current'   ? 'border-blue-400/60 bg-blue-500/10 ring-2 ring-blue-400/20 ring-offset-1 ring-offset-background' :
                                        'border-border/60 bg-card',
        )}>
          {snap.status === 'complete'  && <CheckCircle className="w-4 h-4 text-emerald-400" />}
          {snap.status === 'current'   && <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />}
          {snap.status === 'projected' && <Clock className="w-3.5 h-3.5 text-muted-foreground/40" />}
        </div>
        {!isLast && (
          <div
            className={cn('w-px flex-1 mt-1', snap.status === 'projected' ? 'border-l border-dashed border-border/40' : 'bg-border/50')}
            style={{ minHeight: 36 }}
          />
        )}
      </div>

      {/* Card */}
      <div className={cn(
        'flex-1 mb-5 rounded-xl border bg-card overflow-hidden transition-colors',
        snap.status === 'current'   ? 'border-blue-500/30'  :
        snap.status === 'projected' ? 'border-border/50'    :
                                      'border-border',
      )}>
        {/* Card header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-secondary/30">
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-[11px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border border-current/20 bg-current/5',
              stageMeta.color,
            )}>
              {stageMeta.label}
            </span>
            {snap.status === 'current' && (
              <span className="text-[11px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border border-blue-400/20 bg-blue-400/5 text-blue-400">
                Current
              </span>
            )}
            {snap.status === 'projected' && (
              <span className="text-[11px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                Projected
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="w-3 h-3 flex-shrink-0" />
            <span>{snap.date}</span>
          </div>
        </div>

        {/* Card body */}
        <div className="px-4 py-3">
          <h3 className="text-sm font-bold text-foreground mb-3">{snap.milestone}</h3>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 mb-3">
            {/* DRS */}
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">DRS Score</p>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <p className="text-lg font-bold text-foreground leading-tight">
                  {snap.drs != null ? fmtDRS(snap.drs) : '—'}
                </p>
                {snap.drs != null && (
                  <DeltaBadge
                    current={snap.drs}
                    prev={prevWithDRS?.drs}
                    formatter={v => `${v.toFixed(1)} pts`}
                    showPct={false}
                  />
                )}
              </div>
              {tierMeta && (
                <span className={cn('text-[11px] font-bold uppercase tracking-wider px-1 py-0.5 rounded border inline-block', tierMeta.cls)}>
                  {tierMeta.label}
                </span>
              )}
            </div>

            {/* EBITDA */}
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Def. EBITDA</p>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <p className="text-lg font-bold text-foreground leading-tight">
                  {snap.ebitda != null ? fmtM(snap.ebitda) : '—'}
                </p>
                {snap.ebitda != null && (
                  <DeltaBadge current={snap.ebitda} prev={prev?.ebitda} />
                )}
              </div>
            </div>

            {/* EV Midpoint */}
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">EV Midpoint</p>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <p className="text-lg font-bold text-emerald-400 leading-tight">
                  {snap.ev_midpoint != null ? fmtM(snap.ev_midpoint) : '—'}
                </p>
                {snap.ev_midpoint != null && (
                  <DeltaBadge current={snap.ev_midpoint} prev={prevWithEV?.ev_midpoint} />
                )}
              </div>
              {snap.ev_floor != null && (
                <p className="text-[11px] text-muted-foreground">
                  {fmtM(snap.ev_floor)} – {fmtM(snap.ev_ceiling)}
                </p>
              )}
            </div>

            {/* Multiple */}
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">EBITDA Multiple</p>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <p className="text-lg font-bold text-amber-400 leading-tight">
                  {snap.multiple_floor != null
                    ? `${fmtX(snap.multiple_floor)} – ${fmtX(snap.multiple_ceiling)}`
                    : '—'}
                </p>
                {snap.multiple_floor != null && prev?.multiple_floor != null && (
                  <DeltaBadge
                    current={snap.multiple_floor}
                    prev={prev.multiple_floor}
                    formatter={v => `${v.toFixed(1)}×`}
                    showPct={false}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          {snap.notes && (
            <p className="text-[11px] text-muted-foreground border-t border-border/60 pt-2.5 mt-1 leading-relaxed">
              {snap.notes}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Helpers: extract live state from analytics ──────────────────────────────

function tierFromDRS(drs) {
  if (drs >= 85) return 'INSTITUTIONAL'
  if (drs >= 70) return 'INVESTMENT'
  if (drs >= 55) return 'CONDITIONAL'
  if (drs >= 40) return 'HIGH_RISK'
  return 'PRE_DILIGENCE'
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function extractLiveState(scores) {
  if (!scores || scores.has_data === false) return null
  const ev = scores.enterprise_value
  const drs = scores.drs
  if (!ev || !drs) return null
  return {
    drs: drs.base,
    drs_tier: tierFromDRS(drs.base),
    ebitda: ev.ebitda_base,
    ev_floor: ev.floor,
    ev_midpoint: ev.midpoint,
    ev_ceiling: ev.ceiling,
    // Use actual applied multiples (blended when market context is available)
    // falling back to DRS-tier multiples if the blended fields aren't present
    multiple_floor: ev.multiple_floor ?? ev.drs_multiple_floor,
    multiple_ceiling: ev.multiple_ceiling ?? ev.drs_multiple_ceiling,
  }
}

function buildSyntheticTimeline(live, gapData) {
  const snaps = []
  if (live) {
    snaps.push({
      id: '__live_baseline',
      milestone: 'Current Baseline',
      date: todayLabel(),
      stage: 'baseline',
      status: 'current',
      synthetic: true,
      ...live,
      notes: 'Auto-generated from current analytics. Add manual snapshots to track progress over time.',
    })
  }
  if (gapData && gapData.potential_ev_midpoint > 0 && live) {
    const potDrs = gapData.potential_drs ?? 70
    const potTier = tierFromDRS(potDrs)
    // Derive target multiples from the backend's potential EV and EBITDA
    // (the backend uses a continuous DRS→multiple interpolation curve, so
    // hardcoded tier thresholds would mismatch and produce negative deltas)
    const potMulMid = live.ebitda > 0 ? gapData.potential_ev_midpoint / live.ebitda : 0
    const currentSpread = (live.multiple_ceiling ?? 0) - (live.multiple_floor ?? 0)
    const potMulFloor = Math.max(0, potMulMid - currentSpread / 2)
    const potMulCeil = potMulMid + currentSpread / 2
    const potFloor = live.ebitda * potMulFloor
    const potCeil = live.ebitda * potMulCeil
    const displayGap = gapData.potential_ev_midpoint - (live.ev_midpoint ?? 0)
    snaps.push({
      id: '__live_target',
      milestone: 'Target: All Gaps Closed',
      date: '—',
      stage: 'target',
      status: 'projected',
      synthetic: true,
      drs: potDrs,
      drs_tier: potTier,
      ebitda: live.ebitda,
      ev_floor: potFloor,
      ev_midpoint: gapData.potential_ev_midpoint,
      ev_ceiling: potCeil,
      multiple_floor: potMulFloor,
      multiple_ceiling: potMulCeil,
      notes: `Projected EV if all ${gapData.gaps?.length ?? 0} value-gap items are resolved. Total value acceleration opportunity: ${fmtM(displayGap)}.`,
    })
  }
  return snaps
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EBITDATimeline() {
  usePageTitle('EBITDA & EV Timeline')
  const companyId = useCompanyId()
  const queryClient = useQueryClient()
  const companyReady = companyId != null && companyId > 0
  const [showModal, setShowModal] = useState(false)

  const timelineQuery = useQuery({
    queryKey: ['analytics-timeline', companyId],
    queryFn: () => apiClient.get(`/api/analytics/timeline/${companyId}`),
    enabled: companyReady,
    staleTime: 30_000,
  })

  const scoresQuery = useQuery({
    queryKey: ['analytics-scores', companyId],
    queryFn: () => apiClient.get(`/api/analytics/scores/${companyId}`),
    enabled: companyReady,
    staleTime: 120_000,
  })

  const gapQuery = useQuery({
    queryKey: ['analytics-value-gap', companyId],
    queryFn: () => apiClient.get(`/api/analytics/value-gap/${companyId}`),
    enabled: companyReady,
    staleTime: 120_000,
  })

  const live = useMemo(() => extractLiveState(scoresQuery.data), [scoresQuery.data])

  const savedSnapshots = useMemo(() => {
    const raw = timelineQuery.data
    return Array.isArray(raw) ? raw : []
  }, [timelineQuery.data])

  const usingSynthetic = savedSnapshots.length === 0 && live != null
  const snapshots = useMemo(() => {
    if (savedSnapshots.length > 0) return savedSnapshots
    return buildSyntheticTimeline(live, gapQuery.data)
  }, [savedSnapshots, live, gapQuery.data])

  async function handleAddSnapshot(payload) {
    if (!companyReady) {
      return
    }
    const saved = await apiClient.post(`/api/analytics/timeline/${companyId}`, payload)
    queryClient.setQueryData(['analytics-timeline', companyId], (old) => {
      const prev = Array.isArray(old) ? old : []
      return [...prev, saved]
    })
  }

  // KPI values — prefer live analytics, fall back to latest saved snapshot
  const currentEV = live ?? (() => {
    const completed = snapshots.filter(s => s.status !== 'projected')
    return completed[completed.length - 1] ?? null
  })()
  const baselineSnap = snapshots.find(s => s.ev_midpoint != null)
  const targetSnap = snapshots.find(s => s.status === 'projected' && s.stage === 'target')

  const evGain = currentEV?.ev_midpoint != null && baselineSnap?.ev_midpoint != null && baselineSnap.id !== '__live_baseline'
    ? currentEV.ev_midpoint - baselineSnap.ev_midpoint : 0
  const evTargetGap = targetSnap?.ev_midpoint != null && currentEV?.ev_midpoint != null
    ? targetSnap.ev_midpoint - currentEV.ev_midpoint : 0
  const multipleGain = currentEV?.multiple_floor != null && baselineSnap?.multiple_floor != null && baselineSnap.id !== '__live_baseline'
    ? currentEV.multiple_floor - baselineSnap.multiple_floor : 0
  const completedCount = snapshots.filter(s => s.status === 'complete').length

  // Chart data — only snapshots that have EV data
  const chartSnapshots = snapshots.filter(s => s.ev_midpoint != null)
  const evChartData = chartSnapshots.map(s => ({
    name: s.milestone.split(' ').slice(0, 3).join(' '),
    fullName: s.milestone,
    date: s.date,
    ev_floor: s.ev_floor,
    ev_ceiling: s.ev_ceiling,
    ev_midpoint: s.ev_midpoint,
    ev_band: (s.ev_ceiling ?? 0) - (s.ev_floor ?? 0),
    multiple_floor: s.multiple_floor,
    multiple_ceiling: s.multiple_ceiling,
    multiple_band: (s.multiple_ceiling ?? 0) - (s.multiple_floor ?? 0),
    drs: s.drs,
    drs_tier: s.drs_tier,
    status: s.status,
  }))

  const drsChartData = snapshots
    .filter(s => s.drs != null)
    .map(s => ({
      name: s.milestone.split(' ').slice(0, 3).join(' '),
      fullName: s.milestone,
      drs: s.drs,
      drs_tier: s.drs_tier,
      status: s.status,
    }))

  // Loading
  const loading = companyReady && (timelineQuery.isPending || scoresQuery.isPending)
  if (!companyReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-muted-foreground gap-2">
        <AlertTriangle className="w-5 h-5" />
        <p className="text-sm">Select a client to view the EBITDA & EV Timeline.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-5 max-w-[1400px]">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-[260px] rounded-xl" />
          <Skeleton className="h-[260px] rounded-xl" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    )
  }

  const noDataAtAll = snapshots.length === 0 && !live

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-0.5">
            Value Creation
          </p>
          <h1 className="text-xl font-bold text-foreground">EBITDA & EV Timeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track improvements in EBITDA multiples and enterprise value throughout the CEPA engagement
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-semibold flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Snapshot
        </button>
      </div>

      {/* Synthetic data notice */}
      {usingSynthetic && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-2.5">
          <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <p className="text-[11px] text-blue-300/90">
            <span className="font-semibold">Auto-generated from live analytics.</span>{' '}
            The timeline below reflects this company's current DRS, EBITDA, and enterprise value.
            Add manual snapshots to record milestones and track value creation over time.
          </p>
        </div>
      )}

      {noDataAtAll ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <TrendingUp className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No analytics data available yet.</p>
          <p className="text-[11px] text-muted-foreground/60 max-w-md">
            Upload financial data via Data Sources and complete the scoring pipeline to see live EBITDA & EV analysis.
            You can also add manual snapshots to start tracking.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-2 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            Add First Snapshot
          </button>
        </div>
      ) : (
        <>
          {/* Summary KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-card p-4 space-y-1">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Current EV Midpoint</p>
              <p className="text-2xl font-bold text-emerald-400">
                {currentEV?.ev_midpoint != null ? fmtM(currentEV.ev_midpoint) : '—'}
              </p>
              {evGain > 0 && (
                <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-0.5">
                  <ChevronUp className="w-3 h-3" />
                  +{fmtM(evGain)} vs baseline
                </p>
              )}
              {currentEV?.ev_floor != null && (
                <p className="text-[11px] text-muted-foreground">
                  {fmtM(currentEV.ev_floor)} – {fmtM(currentEV.ev_ceiling)}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-1">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">EBITDA Multiple</p>
              <p className="text-2xl font-bold text-amber-400">
                {currentEV?.multiple_floor != null
                  ? `${fmtX(currentEV.multiple_floor)} – ${fmtX(currentEV.multiple_ceiling)}`
                  : '—'}
              </p>
              {multipleGain > 0 ? (
                <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-0.5">
                  <ChevronUp className="w-3 h-3" />
                  +{multipleGain.toFixed(1)}× since baseline
                </p>
              ) : currentEV?.drs_tier ? (
                <p className="text-[11px] text-muted-foreground">
                  {TIER_STYLE[currentEV.drs_tier]?.label ?? currentEV.drs_tier} tier
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-1">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Target className="w-3 h-3" />
                Target EV (Gaps Closed)
              </p>
              <p className="text-2xl font-bold text-foreground">
                {targetSnap?.ev_midpoint != null ? fmtM(targetSnap.ev_midpoint) : '—'}
              </p>
              {evTargetGap > 0 && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                  <ArrowUpRight className="w-3 h-3" />
                  {fmtM(evTargetGap)} value acceleration opportunity
                </p>
              )}
              {targetSnap?.multiple_floor != null && (
                <p className="text-[11px] text-muted-foreground">
                  Target: {fmtX(targetSnap.multiple_floor)} – {fmtX(targetSnap.multiple_ceiling)}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-1">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Defensible EBITDA</p>
              <p className="text-2xl font-bold text-foreground">
                {currentEV?.ebitda != null ? fmtM(currentEV.ebitda) : '—'}
              </p>
              {currentEV?.drs != null && (
                <p className="text-[11px] text-muted-foreground">
                  DRS {Number(currentEV.drs).toFixed(1)} / 100
                </p>
              )}
              {savedSnapshots.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {completedCount} / {snapshots.length} milestones
                </p>
              )}
            </div>
          </div>

          {/* Charts row */}
          {evChartData.length > 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* EV Progression */}
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-foreground">Enterprise Value Progression</h3>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="w-5 border-t-2 border-emerald-500 inline-block" />
                      Midpoint
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-5 h-2.5 bg-emerald-500/10 border border-emerald-500/20 inline-block rounded-sm" />
                      Floor–Ceiling
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mb-4">EV floor, midpoint, and ceiling at each engagement milestone</p>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={evChartData} margin={{ top: 10, right: 5, bottom: 0, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,10%,16%)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 9, fill: 'hsl(220,10%,46%)' }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: 'hsl(220,10%,46%)' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `$${(v / 1_000_000).toFixed(1)}M`}
                      width={46}
                    />
                    <Tooltip content={<EVTooltip />} />
                    <Area stackId="ev" type="monotone" dataKey="ev_floor" fill="transparent" stroke="none" legendType="none" />
                    <Area stackId="ev" type="monotone" dataKey="ev_band"  fill="rgba(16,185,129,0.09)" stroke="none" legendType="none" />
                    <Line type="monotone" dataKey="ev_floor"    stroke="rgba(16,185,129,0.30)" strokeDasharray="4 3" strokeWidth={1} dot={false} legendType="none" />
                    <Line type="monotone" dataKey="ev_ceiling"  stroke="rgba(16,185,129,0.30)" strokeDasharray="4 3" strokeWidth={1} dot={false} legendType="none" />
                    <Line
                      type="monotone"
                      dataKey="ev_midpoint"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#10b981', stroke: 'hsl(222,47%,11%)', strokeWidth: 2 }}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Multiple Progression */}
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-foreground">EBITDA Multiple Progression</h3>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="w-5 border-t-2 border-amber-500 inline-block" />
                      Floor
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-5 h-2.5 bg-amber-500/10 border border-amber-500/20 inline-block rounded-sm" />
                      Floor–Ceiling
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mb-4">DRS-adjusted valuation multiples across the engagement lifecycle</p>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={evChartData} margin={{ top: 10, right: 5, bottom: 0, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,10%,16%)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 9, fill: 'hsl(220,10%,46%)' }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: 'hsl(220,10%,46%)' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `${Number(v).toFixed(1)}×`}
                      width={36}
                      domain={[0, 'dataMax + 1']}
                    />
                    <Tooltip content={<MultipleTooltip />} />
                    <Area stackId="mul" type="monotone" dataKey="multiple_floor" fill="transparent" stroke="none" legendType="none" />
                    <Area stackId="mul" type="monotone" dataKey="multiple_band"  fill="rgba(251,191,36,0.09)" stroke="none" legendType="none" />
                    <Line type="monotone" dataKey="multiple_ceiling" stroke="rgba(251,191,36,0.35)" strokeDasharray="4 3" strokeWidth={1} dot={false} legendType="none" />
                    <Line
                      type="monotone"
                      dataKey="multiple_floor"
                      stroke="#fbbf24"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#fbbf24', stroke: 'hsl(222,47%,11%)', strokeWidth: 2 }}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Single-snapshot EV summary (when only 1 data point — chart wouldn't be useful) */}
          {evChartData.length === 1 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Enterprise Value Position</h3>
              <div className="flex items-center gap-6">
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded-full overflow-hidden relative">
                    <div
                      className="h-3 bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"
                      style={{ width: `${Math.min(100, (evChartData[0].ev_midpoint / (targetSnap?.ev_midpoint || evChartData[0].ev_midpoint * 1.5)) * 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Floor: {fmtM(evChartData[0].ev_floor)}</span>
                    <span className="text-emerald-400 font-bold">Midpoint: {fmtM(evChartData[0].ev_midpoint)}</span>
                    <span className="text-muted-foreground">Ceiling: {fmtM(evChartData[0].ev_ceiling)}</span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                Add more snapshots to see EV progression charts over time.
              </p>
            </div>
          )}

          {/* DRS Progression */}
          {drsChartData.length > 1 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-1">Deal Readiness Score (DRS) Progression</h3>
              <p className="text-[11px] text-muted-foreground mb-4">
                Composite 0–100 score across 6 categories.
                Tier thresholds: Pre-Diligence (&lt;40) · High Risk (40–54) · Conditional (55–69) · <span className="text-emerald-400">Investment Grade (70+)</span> · Institutional (85+)
              </p>
              <ResponsiveContainer width="100%" height={150}>
                <ComposedChart data={drsChartData} margin={{ top: 10, right: 40, bottom: 0, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,10%,16%)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9, fill: 'hsl(220,10%,46%)' }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: 'hsl(220,10%,46%)' }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 100]}
                    width={28}
                  />
                  <Tooltip content={<DRSTooltip />} />
                  <ReferenceLine y={70} stroke="rgba(16,185,129,0.45)" strokeDasharray="4 3"
                    label={{ value: 'Investment Grade →', position: 'insideTopRight', fontSize: 8, fill: 'rgba(16,185,129,0.65)' }} />
                  <ReferenceLine y={55} stroke="rgba(251,191,36,0.30)" strokeDasharray="3 3" />
                  <ReferenceLine y={40} stroke="rgba(239,68,68,0.25)" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="drs"
                    stroke="#60a5fa"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#60a5fa', stroke: 'hsl(222,47%,11%)', strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Milestone timeline */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">Engagement Milestones</h2>
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                  Complete
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-400 opacity-80" />
                  Current
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-muted-foreground/50" />
                  Projected
                </span>
              </div>
            </div>

            <div>
              {snapshots.map((snap, i) => (
                <SnapshotCard
                  key={snap.id}
                  snap={snap}
                  prev={i > 0 ? snapshots[i - 1] : null}
                  isLast={i === snapshots.length - 1}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Add Snapshot Modal */}
      {showModal && (
        <AddSnapshotModal
          onClose={() => setShowModal(false)}
          onAdd={handleAddSnapshot}
        />
      )}
    </div>
  )
}
