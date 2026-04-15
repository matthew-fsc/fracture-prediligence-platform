import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import SectionHeader from '../components/ui/SectionHeader'
import { cn } from '../lib/utils'
import {
  CheckCircle, Circle, Clock, Target, TrendingUp, Zap, ChevronRight,
  Plus, Trash2, CalendarDays, RefreshCw, AlertCircle,
} from 'lucide-react'
import { Skeleton } from '../components/ui/Skeleton'
import { apiClient } from '../lib/apiClient'
import { toast } from '../lib/notify'
import { useCompanyId } from '../context/CompanyContext'
import { getDrsCategoryStyle } from '../lib/drsCategoryColors'

// Phase metadata
const PHASES = {
  1: { label: 'Phase 1 — Risk Elimination', icon: AlertCircle, color: 'red',     desc: 'Address critical gaps that will surface in buyer diligence' },
  2: { label: 'Phase 2 — Structural',       icon: Zap,          color: 'amber',   desc: 'Build the infrastructure that supports a premium valuation' },
  3: { label: 'Phase 3 — Value Optimization', icon: TrendingUp, color: 'emerald', desc: 'Maximise enterprise value and buyer attractiveness' },
}

const phaseColor = {
  red:     { border: 'border-red-500/30',     bg: 'bg-red-500/5',     text: 'text-red-400',     badge: 'border-red-500/20 bg-red-500/10 text-red-400',     dot: 'bg-red-500'     },
  amber:   { border: 'border-amber-500/30',   bg: 'bg-amber-500/5',   text: 'text-amber-400',   badge: 'border-amber-500/20 bg-amber-500/10 text-amber-400', dot: 'bg-amber-500'   },
  emerald: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', text: 'text-emerald-400', badge: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400', dot: 'bg-emerald-500' },
}

const STATUS_META = {
  planned:     { label: 'Planned',     icon: Circle,       color: 'text-muted-foreground' },
  in_progress: { label: 'In Progress', icon: Clock,        color: 'text-amber-400'        },
  complete:    { label: 'Complete',    icon: CheckCircle,  color: 'text-emerald-400'      },
}

// ─── Individual initiative card ────────────────────────────────────────────

function InitiativeCard({ init, phaseKey, onStatusChange, onDelete, onComplete }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const sm = STATUS_META[init.status] ?? STATUS_META.planned
  const StatusIcon = sm.icon
  const catStyle = getDrsCategoryStyle(init.drs_category_key ?? '')

  return (
    <div className={cn(
      'rounded-lg border bg-card p-3 space-y-2 transition-all',
      init.status === 'complete' ? 'opacity-60' : 'hover:border-border/80',
      'border-border',
    )}>
      {/* Header */}
      <div className="flex items-start gap-2">
        <button
          onClick={() => onStatusChange(init.id, init.status === 'complete' ? 'in_progress' : init.status === 'in_progress' ? 'complete' : 'in_progress')}
          className={cn('mt-0.5 flex-shrink-0', sm.color, 'hover:opacity-80 transition-opacity')}
          title={`Status: ${sm.label}`}
        >
          <StatusIcon className="w-4 h-4" />
        </button>
        <p className={cn('text-[11px] font-semibold flex-1 leading-snug', init.status === 'complete' ? 'line-through text-muted-foreground' : 'text-foreground')}>
          {init.title}
        </p>
      </div>

      {/* Category & DRS impact */}
      {(init.drs_category_key || init.estimated_drs_impact) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {init.drs_category_key && (
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', catStyle.badge ?? 'border-border bg-muted/20 text-muted-foreground')}>
              {init.drs_category_key.replace(/_/g, ' ')}
            </span>
          )}
          {init.estimated_drs_impact != null && (
            <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5">
              <TrendingUp className="w-2.5 h-2.5" />
              +{init.estimated_drs_impact.toFixed ? init.estimated_drs_impact.toFixed(1) : init.estimated_drs_impact} DRS
            </span>
          )}
        </div>
      )}

      {/* Dates */}
      {init.target_completion_date && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <CalendarDays className="w-3 h-3 flex-shrink-0" />
          <span>Target: {new Date(init.target_completion_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          {init.actual_completion_date && (
            <span className="text-emerald-400 ml-1">
              ✓ {new Date(init.actual_completion_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      )}

      {/* EV impact */}
      {init.ev_impact_estimate != null && Number(init.ev_impact_estimate) > 0 && (
        <p className="text-[10px] text-muted-foreground">
          EV opportunity: <span className="text-foreground font-semibold">
            +${Number(init.ev_impact_estimate).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-border/40">
        {init.status !== 'complete' && (
          <button
            onClick={() => onComplete(init.id)}
            className="text-[10px] font-semibold text-primary hover:underline"
          >
            Mark complete
          </button>
        )}
        <div className="flex-1" />
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button onClick={() => onDelete(init.id)} className="text-[10px] font-bold text-red-400 hover:underline">Confirm</button>
            <button onClick={() => setConfirmDelete(false)} className="text-[10px] text-muted-foreground hover:underline">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-muted-foreground/40 hover:text-red-400 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Phase column ────────────────────────────────────────────────────────────

function PhaseColumn({ phase, initiatives, onStatusChange, onDelete, onComplete, onAdd }) {
  const [addOpen, setAddOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const meta = PHASES[phase]
  const c = phaseColor[meta.color]
  const PhaseIcon = meta.icon

  const handleAdd = () => {
    if (!newTitle.trim()) return
    onAdd(phase, newTitle.trim())
    setNewTitle('')
    setAddOpen(false)
  }

  const completeCount = initiatives.filter(i => i.status === 'complete').length
  const totalCount = initiatives.length

  return (
    <div className={cn('rounded-xl border p-4 space-y-3 flex flex-col', c.border, c.bg, 'min-h-[300px]')}>
      {/* Column header */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PhaseIcon className={cn('w-4 h-4', c.text)} />
            <p className={cn('text-xs font-bold', c.text)}>{meta.label}</p>
          </div>
          {totalCount > 0 && (
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', c.badge)}>
              {completeCount}/{totalCount}
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug">{meta.desc}</p>
        {totalCount > 0 && (
          <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', c.dot === 'bg-red-500' ? 'bg-red-500' : c.dot === 'bg-amber-500' ? 'bg-amber-500' : 'bg-emerald-500')}
              style={{ width: `${(completeCount / totalCount) * 100}%` }} />
          </div>
        )}
      </div>

      {/* Initiative cards */}
      <div className="flex-1 space-y-2">
        {initiatives.length === 0 && (
          <p className="text-[11px] text-muted-foreground text-center py-6 italic">No initiatives yet</p>
        )}
        {initiatives.map(init => (
          <InitiativeCard
            key={init.id}
            init={init}
            phaseKey={`phase_${phase}`}
            onStatusChange={onStatusChange}
            onDelete={onDelete}
            onComplete={onComplete}
          />
        ))}
      </div>

      {/* Add initiative */}
      <div className="pt-2 border-t border-border/30">
        {addOpen ? (
          <div className="space-y-2">
            <input
              autoFocus
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAddOpen(false) }}
              placeholder="Initiative title…"
              className="w-full text-xs bg-background border border-border rounded-lg px-3 py-1.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            <div className="flex gap-2">
              <button onClick={handleAdd} className="text-[11px] font-semibold text-primary hover:underline">Add</button>
              <button onClick={() => setAddOpen(false)} className="text-[11px] text-muted-foreground hover:underline">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddOpen(true)}
            className={cn('w-full flex items-center gap-1.5 text-[11px] font-semibold py-1.5 rounded-lg transition-colors', c.text, 'hover:opacity-80')}>
            <Plus className="w-3 h-3" />
            Add initiative
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function EngagementView() {
  const companyId = useCompanyId()
  const queryClient = useQueryClient()

  const { data: planData, isLoading: planLoading } = useQuery({
    queryKey: ['engagement-plan', companyId],
    queryFn: () => apiClient.get(`/api/engagement/plan/${companyId}`),
    enabled: companyId != null && companyId > 0,
  })

  const { data: initsData, isLoading: initsLoading } = useQuery({
    queryKey: ['engagement-initiatives', companyId],
    queryFn: () => apiClient.get(`/api/engagement/initiatives/${companyId}`),
    enabled: companyId != null && companyId > 0,
  })

  const [drsAfterComplete, setDrsAfterComplete] = useState(null)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['engagement-initiatives', companyId] })
    queryClient.invalidateQueries({ queryKey: ['engagement-plan', companyId] })
    queryClient.invalidateQueries({ queryKey: ['analytics-scores', companyId] })
    queryClient.invalidateQueries({ queryKey: ['analytics-value-gap', companyId] })
  }

  const patchMutation = useMutation({
    mutationFn: ({ id, body }) => apiClient.patch(`/api/engagement/initiatives/${companyId}/${id}`, body),
    onSuccess: invalidate,
    onError: () => toast.error('Update failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.del(`/api/engagement/initiatives/${companyId}/${id}`),
    onSuccess: invalidate,
    onError: () => toast.error('Delete failed'),
  })

  const completeMutation = useMutation({
    mutationFn: (id) => apiClient.post(`/api/engagement/initiatives/${companyId}/${id}/complete`, {}),
    onSuccess: (data) => {
      invalidate()
      if (data?.drs) setDrsAfterComplete(data.drs)
      toast.success('Initiative marked complete — DRS re-scored')
    },
    onError: () => toast.error('Failed to mark complete'),
  })

  const createMutation = useMutation({
    mutationFn: ({ phase, title }) =>
      apiClient.post(`/api/engagement/initiatives/${companyId}`, { title, phase, source: 'custom' }),
    onSuccess: invalidate,
    onError: () => toast.error('Failed to create initiative'),
  })

  const populateMutation = useMutation({
    mutationFn: () => apiClient.post(`/api/engagement/initiatives/${companyId}/populate`, {}),
    onSuccess: (data) => {
      invalidate()
      toast.success(`${data.created} initiative${data.created === 1 ? '' : 's'} added from Value Gap analysis`)
    },
    onError: () => toast.error('Populate failed'),
  })

  const loading = planLoading || initsLoading
  const initiatives = initsData?.initiatives ?? {}
  const plan = planData

  // Aggregate DRS impact across phases
  const totalDrsImpact = Object.values(initiatives)
    .flat()
    .reduce((sum, i) => sum + (i.status !== 'complete' && i.estimated_drs_impact ? Number(i.estimated_drs_impact) : 0), 0)

  if (loading) {
    return (
      <div className="space-y-5 max-w-[1200px]">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-[1200px]">
      <SectionHeader
        title="Exit Planning Roadmap"
        subtitle="3-phase value creation framework — Risk Elimination → Structural → Value Optimization"
        action={
          <div className="flex items-center gap-2">
            {drsAfterComplete && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                DRS re-scored: {drsAfterComplete.base}/100
              </span>
            )}
            <button
              onClick={() => populateMutation.mutate()}
              disabled={populateMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', populateMutation.isPending && 'animate-spin')} />
              Populate from Value Gap
            </button>
          </div>
        }
      />

      {/* Plan summary bar */}
      {plan && (
        <div className="rounded-xl border border-border bg-card p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Current Phase</p>
            <p className="text-sm font-bold text-foreground">{plan.current_phase_label ?? `Phase ${plan.current_phase}`}</p>
          </div>
          {plan.target_exit_date && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Target Exit</p>
              <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                {new Date(plan.target_exit_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </p>
            </div>
          )}
          {plan.target_drs != null && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Target DRS</p>
              <p className="text-sm font-bold text-primary flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" />
                {plan.target_drs}/100
              </p>
            </div>
          )}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Potential DRS Lift</p>
            <p className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              +{totalDrsImpact.toFixed(1)} pts remaining
            </p>
          </div>
        </div>
      )}

      {/* 3-column kanban */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(phase => (
          <PhaseColumn
            key={phase}
            phase={phase}
            initiatives={initiatives[`phase_${phase}`] ?? []}
            onStatusChange={(id, status) => patchMutation.mutate({ id, body: { status } })}
            onDelete={(id) => deleteMutation.mutate(id)}
            onComplete={(id) => completeMutation.mutate(id)}
            onAdd={(ph, title) => createMutation.mutate({ phase: ph, title })}
          />
        ))}
      </div>

      {/* Unphased */}
      {(initiatives.unphased ?? []).length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Unphased Initiatives</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {initiatives.unphased.map(init => (
              <InitiativeCard
                key={init.id}
                init={init}
                phaseKey="unphased"
                onStatusChange={(id, status) => patchMutation.mutate({ id, body: { status } })}
                onDelete={(id) => deleteMutation.mutate(id)}
                onComplete={(id) => completeMutation.mutate(id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {initsData?.total === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center space-y-3">
          <ChevronRight className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-semibold text-foreground">No initiatives yet</p>
          <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
            Click "Populate from Value Gap" to auto-generate phase-tagged initiatives based on current DRS category gaps, or add initiatives manually using the + button in each phase column.
          </p>
          <button
            onClick={() => populateMutation.mutate()}
            disabled={populateMutation.isPending}
            className="mx-auto flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            <RefreshCw className={cn('w-4 h-4', populateMutation.isPending && 'animate-spin')} />
            Populate from Value Gap
          </button>
        </div>
      )}
    </div>
  )
}
