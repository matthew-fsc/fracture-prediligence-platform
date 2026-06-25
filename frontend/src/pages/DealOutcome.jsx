import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient, ApiError } from '@/lib/apiClient'
import { useCompanyId } from '@/context/CompanyContext'
import { toast } from '@/lib/notify'
import SectionHeader from '@/components/ui/SectionHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import {
  CheckCircle2, Clock, XCircle, PauseCircle,
  TrendingUp, DollarSign, Users, Calendar, Target,
  BarChart3, ArrowRight, Info, Save, ChevronDown,
} from 'lucide-react'

// ─── Constants ──────────────────────────────────────────────────────────────

const DEAL_STATUSES = [
  { value: 'in_process',    label: 'In Process',     icon: Clock,         color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
  { value: 'closed',        label: 'Closed',         icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  { value: 'on_hold',       label: 'On Hold',        icon: PauseCircle,   color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20' },
  { value: 'fallen_through',label: 'Fallen Through', icon: XCircle,       color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
]

const BUYER_TYPES = [
  { value: 'pe',           label: 'Private Equity' },
  { value: 'strategic',    label: 'Strategic Acquirer' },
  { value: 'financial',    label: 'Financial Buyer' },
  { value: 'family_office',label: 'Family Office' },
  { value: 'mbo',          label: 'Management Buyout' },
  { value: 'esop',         label: 'ESOP' },
]

const DEAL_STRUCTURES = [
  { value: 'asset_sale',      label: 'Asset Sale' },
  { value: 'stock_sale',      label: 'Stock Sale' },
  { value: 'merger',          label: 'Merger' },
  { value: 'recapitalization',label: 'Recapitalization' },
  { value: 'partial_sale',    label: 'Partial Sale' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt$(v) {
  if (!v && v !== 0) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
}

function fmtX(v) {
  if (!v && v !== 0) return '—'
  return `${parseFloat(v).toFixed(1)}x`
}

function predictionAccuracy(outcome) {
  if (!outcome.actual_ev || !outcome.predicted_ev_floor || !outcome.predicted_ev_ceiling) return null
  const inRange = outcome.actual_ev >= outcome.predicted_ev_floor && outcome.actual_ev <= outcome.predicted_ev_ceiling
  const mid = (outcome.predicted_ev_floor + outcome.predicted_ev_ceiling) / 2
  const errPct = mid > 0 ? Math.abs(((outcome.actual_ev - mid) / mid) * 100) : null
  return { inRange, errPct, mid }
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const meta = DEAL_STATUSES.find(d => d.value === status) ?? DEAL_STATUSES[0]
  const Icon = meta.icon
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold', meta.bg, meta.color)}>
      <Icon className="w-3.5 h-3.5" />
      {meta.label}
    </span>
  )
}

function FieldGroup({ label, children, hint }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/60">{hint}</p>}
    </div>
  )
}

function Input({ value, onChange, type = 'text', placeholder, prefix }) {
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{prefix}</span>
      )}
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-md border border-border bg-background text-sm text-foreground',
          'px-3 py-2 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring',
          prefix && 'pl-7',
        )}
      />
    </div>
  )
}

function Select({ value, onChange, options, placeholder = 'Select…' }) {
  return (
    <div className="relative">
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : e.target.value)}
        className={cn(
          'w-full appearance-none rounded-md border border-border bg-background text-sm',
          'px-3 py-2 pr-8 text-foreground focus:outline-none focus:ring-1 focus:ring-ring',
          !value && 'text-muted-foreground/40',
        )}
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
    </div>
  )
}

function AccuracyCard({ outcome }) {
  const acc = predictionAccuracy(outcome)
  if (!acc) return null

  return (
    <div className={cn(
      'rounded-lg border p-4 space-y-3',
      acc.inRange ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5',
    )}>
      <div className="flex items-center gap-2">
        <Target className={cn('w-4 h-4', acc.inRange ? 'text-emerald-400' : 'text-amber-400')} />
        <p className="text-sm font-semibold text-foreground">Prediction Accuracy</p>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[11px] text-muted-foreground mb-0.5">Predicted Range</p>
          <p className="text-xs font-mono font-semibold text-foreground">
            {fmt$(outcome.predicted_ev_floor)} – {fmt$(outcome.predicted_ev_ceiling)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground mb-0.5">Actual EV</p>
          <p className="text-sm font-mono font-bold text-foreground">{fmt$(outcome.actual_ev)}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground mb-0.5">Error vs Midpoint</p>
          <p className={cn('text-sm font-bold', acc.inRange ? 'text-emerald-400' : 'text-amber-400')}>
            {acc.errPct != null ? `${acc.errPct.toFixed(1)}%` : '—'}
          </p>
        </div>
      </div>
      <p className={cn('text-xs', acc.inRange ? 'text-emerald-400' : 'text-amber-400')}>
        {acc.inRange
          ? 'Actual EV landed within the predicted range.'
          : 'Actual EV fell outside the predicted range — this data helps calibrate future predictions.'}
      </p>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DealOutcome() {
  const companyId = useCompanyId()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(null)
  const [dirty, setDirty] = useState(false)

  // Fetch existing outcome
  const { data: outcome, isLoading, error } = useQuery({
    queryKey: ['deal-outcome', companyId],
    queryFn: () => apiClient.get(`/api/deal-outcomes/${companyId}`),
    enabled: !!companyId,
    retry: (count, err) => err?.status !== 404 && count < 2,
  })

  // Initialise form from fetched data or blank defaults
  useEffect(() => {
    if (outcome && !dirty) {
      setForm({ ...outcome })
    } else if (!outcome && !isLoading && !form) {
      setForm({
        deal_status: 'in_process',
        close_date: null,
        sale_price: null,
        actual_ev: null,
        ebitda_at_close: null,
        ev_multiple: null,
        buyer_type: null,
        buyer_name: null,
        deal_structure: null,
        drs_at_close: null,
        predicted_ev_floor: null,
        predicted_ev_ceiling: null,
        days_to_close: null,
        advisor_notes: null,
        is_benchmark_eligible: true,
      })
    }
  }, [outcome, isLoading])

  const set = (field) => (value) => {
    setForm(f => ({ ...f, [field]: value }))
    setDirty(true)
  }

  // Save mutation — upserts (POST handles both create and update idempotently)
  const saveMut = useMutation({
    mutationFn: async (payload) => {
      // Coerce numeric string inputs to numbers
      const coerce = (v) => (v === '' || v === null || v === undefined) ? null : parseFloat(v)
      const cleaned = {
        ...payload,
        sale_price:           coerce(payload.sale_price),
        actual_ev:            coerce(payload.actual_ev),
        ebitda_at_close:      coerce(payload.ebitda_at_close),
        ev_multiple:          coerce(payload.ev_multiple),
        predicted_ev_floor:   coerce(payload.predicted_ev_floor),
        predicted_ev_ceiling: coerce(payload.predicted_ev_ceiling),
        days_to_close:        payload.days_to_close ? parseInt(payload.days_to_close) : null,
        drs_at_close:         coerce(payload.drs_at_close),
      }
      return apiClient.post(`/api/deal-outcomes/${companyId}`, cleaned)
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['deal-outcome', companyId], data)
      queryClient.invalidateQueries({ queryKey: ['deal-outcomes-aggregate'] })
      setForm({ ...data })
      setDirty(false)
      toast.success('Deal outcome saved')
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : 'Failed to save deal outcome')
    },
  })

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      </div>
    )
  }

  if (!form) return null

  const statusMeta = DEAL_STATUSES.find(d => d.value === form.deal_status) ?? DEAL_STATUSES[0]
  const isClosed = form.deal_status === 'closed'

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionHeader
            title="Deal Outcome"
            subtitle="Record the actual sale economics to calibrate DRS predictions and build your firm's proprietary benchmark dataset."
          />
        </div>
        <button
          onClick={() => saveMut.mutate(form)}
          disabled={saveMut.isPending || !dirty}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all',
            dirty
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50',
          )}
        >
          <Save className="w-4 h-4" />
          {saveMut.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Status selector */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deal Status</p>
        <div className="flex flex-wrap gap-2">
          {DEAL_STATUSES.map(s => {
            const Icon = s.icon
            const active = form.deal_status === s.value
            return (
              <button
                key={s.value}
                onClick={() => set('deal_status')(s.value)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all',
                  active ? cn(s.bg, s.color) : 'border-border text-muted-foreground hover:border-border/80',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Prediction accuracy (read-only, shown when data is present) */}
      {outcome && <AccuracyCard outcome={form} />}

      {/* Deal economics */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-5">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Close Economics</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldGroup label="Close Date">
            <Input
              type="date"
              value={form.close_date ?? ''}
              onChange={set('close_date')}
            />
          </FieldGroup>
          <FieldGroup label="Sale Price (Total Consideration)" hint="Full purchase price before adjustments">
            <Input
              type="number"
              value={form.sale_price}
              onChange={set('sale_price')}
              placeholder="0"
              prefix="$"
            />
          </FieldGroup>
          <FieldGroup label="Actual Enterprise Value" hint="EV net of assumed debt and cash adjustments">
            <Input
              type="number"
              value={form.actual_ev}
              onChange={set('actual_ev')}
              placeholder="0"
              prefix="$"
            />
          </FieldGroup>
          <FieldGroup label="EBITDA at Close">
            <Input
              type="number"
              value={form.ebitda_at_close}
              onChange={set('ebitda_at_close')}
              placeholder="0"
              prefix="$"
            />
          </FieldGroup>
          <FieldGroup label="EV Multiple" hint="Auto-computed from Actual EV ÷ EBITDA if left blank">
            <Input
              type="number"
              value={form.ev_multiple}
              onChange={set('ev_multiple')}
              placeholder="auto"
              prefix="×"
            />
          </FieldGroup>
          <FieldGroup label="Days to Close" hint="Auto-computed from engagement start date if left blank">
            <Input
              type="number"
              value={form.days_to_close}
              onChange={set('days_to_close')}
              placeholder="auto"
            />
          </FieldGroup>
        </div>
      </div>

      {/* Buyer & Structure */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Buyer & Transaction Structure</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldGroup label="Buyer Type">
            <Select
              value={form.buyer_type}
              onChange={set('buyer_type')}
              options={BUYER_TYPES}
              placeholder="Select buyer type…"
            />
          </FieldGroup>
          <FieldGroup label="Buyer Name" hint="Optional — used for internal records only">
            <Input
              value={form.buyer_name}
              onChange={set('buyer_name')}
              placeholder="e.g. Acme Capital Partners"
            />
          </FieldGroup>
          <FieldGroup label="Deal Structure">
            <Select
              value={form.deal_structure}
              onChange={set('deal_structure')}
              options={DEAL_STRUCTURES}
              placeholder="Select structure…"
            />
          </FieldGroup>
        </div>
      </div>

      {/* Platform prediction snapshot */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Platform Predictions at Close</p>
          <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
            <Info className="w-3 h-3" />
            Used to measure DRS prediction accuracy
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FieldGroup label="DRS Score at Close">
            <Input
              type="number"
              value={form.drs_at_close}
              onChange={set('drs_at_close')}
              placeholder="0–100"
            />
          </FieldGroup>
          <FieldGroup label="Predicted EV Floor">
            <Input
              type="number"
              value={form.predicted_ev_floor}
              onChange={set('predicted_ev_floor')}
              placeholder="0"
              prefix="$"
            />
          </FieldGroup>
          <FieldGroup label="Predicted EV Ceiling">
            <Input
              type="number"
              value={form.predicted_ev_ceiling}
              onChange={set('predicted_ev_ceiling')}
              placeholder="0"
              prefix="$"
            />
          </FieldGroup>
        </div>
      </div>

      {/* Notes & data governance */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <p className="text-sm font-semibold text-foreground">Notes & Data Governance</p>
        <FieldGroup label="Advisor Notes">
          <textarea
            value={form.advisor_notes ?? ''}
            onChange={e => set('advisor_notes')(e.target.value || null)}
            rows={3}
            placeholder="Key deal dynamics, negotiation notes, lessons learned…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </FieldGroup>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_benchmark_eligible}
            onChange={e => set('is_benchmark_eligible')(e.target.checked)}
            className="rounded border-border"
          />
          <span className="text-sm text-foreground">Include in aggregate benchmarking</span>
          <span className="text-xs text-muted-foreground">(uncheck for anomalous or confidential deals)</span>
        </label>
      </div>

      {/* Summary stats (read-only) */}
      {outcome && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <p className="text-sm font-semibold text-foreground">Outcome Summary</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Sale Price',    value: fmt$(outcome.sale_price) },
              { label: 'Actual EV',     value: fmt$(outcome.actual_ev) },
              { label: 'EV Multiple',   value: fmtX(outcome.ev_multiple) },
              { label: 'Days to Close', value: outcome.days_to_close ? `${outcome.days_to_close}d` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="text-center p-3 rounded-md bg-muted/30 border border-border/50">
                <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
                <p className="text-base font-bold font-mono text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
