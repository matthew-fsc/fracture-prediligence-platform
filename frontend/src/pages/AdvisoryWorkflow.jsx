import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import SectionHeader from '../components/ui/SectionHeader'
import { cn } from '../lib/utils'
import {
  CheckCircle, Clock, Circle, ArrowRight, ChevronRight,
  Sparkles, Lock,
} from 'lucide-react'
import { useCompanyId } from '../context/CompanyContext'
import { apiClient } from '../lib/apiClient'
import { withCompanyQuery, resolvePath } from '../lib/navLinks'
import { Skeleton } from '../components/ui/Skeleton'

const STATUS_CFG = {
  completed:   { color: 'text-emerald-400', bar: 'bg-emerald-500', ring: 'ring-emerald-500/20', border: 'border-emerald-500/25', label: 'Complete' },
  in_progress: { color: 'text-blue-400',    bar: 'bg-blue-500',    ring: 'ring-blue-500/20',    border: 'border-blue-500/25',   label: 'In Progress' },
  not_started: { color: 'text-muted-foreground', bar: 'bg-muted', ring: 'ring-border/0', border: 'border-border/50', label: 'Not Started' },
}

const PHASE_COLORS = [
  { accent: 'from-blue-600/20 to-blue-500/5',   num: 'bg-blue-600 text-white',   bar: 'bg-blue-500'    },
  { accent: 'from-violet-600/20 to-violet-500/5', num: 'bg-violet-600 text-white', bar: 'bg-violet-500'  },
  { accent: 'from-amber-600/20 to-amber-500/5',  num: 'bg-amber-600 text-white',  bar: 'bg-amber-500'   },
  { accent: 'from-rose-600/20 to-rose-500/5',    num: 'bg-rose-600 text-white',   bar: 'bg-rose-500'    },
  { accent: 'from-emerald-600/20 to-emerald-500/5', num: 'bg-emerald-600 text-white', bar: 'bg-emerald-500' },
]

function StepDot({ pct, active }) {
  if (pct >= 85) return <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
  if (pct > 0)   return <Clock className={cn('w-4 h-4 flex-shrink-0', active ? 'text-blue-400' : 'text-muted-foreground/60')} />
  return              <Circle className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />
}

function PhaseCard({ phase, go, isFirst, isLast }) {
  const pc = PHASE_COLORS[(phase.phase - 1) % PHASE_COLORS.length]
  const st = STATUS_CFG[phase.status] ?? STATUS_CFG.not_started
  const isActive = phase.status === 'in_progress'
  const isDone = phase.status === 'completed'
  const isFuture = phase.status === 'not_started'

  const firstRoutableStep = phase.steps?.find(s => s.route)

  return (
    <div className={cn(
      'relative rounded-2xl border bg-card overflow-hidden transition-all duration-200',
      isActive ? `ring-1 ${st.ring} border-blue-500/30` : st.border,
    )}>
      {/* Phase header gradient */}
      <div className={cn('absolute inset-x-0 top-0 h-1', st.bar, isFuture && 'opacity-20')} style={{ width: `${phase.pct}%` }} />

      <div className={cn('px-5 pt-5 pb-4 bg-gradient-to-br', pc.accent)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0', pc.num)}>
              {phase.phase}
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-card-foreground leading-tight">{phase.label}</p>
                {isActive && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400 uppercase tracking-wide">
                    Active
                  </span>
                )}
                {isDone && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 uppercase tracking-wide">
                    Complete
                  </span>
                )}
              </div>
              <p className={cn('text-xs mt-0.5', st.color, isFuture && 'opacity-60')}>
                {isFuture ? 'Not started' : `${phase.pct}% complete`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isFuture && <Lock className="w-3.5 h-3.5 text-muted-foreground/40" />}
            {!isFuture && (
              <span className={cn('text-lg font-bold tabular-nums', st.color)}>{phase.pct}%</span>
            )}
            {isActive && firstRoutableStep?.route && (
              <button
                type="button"
                onClick={() => go(firstRoutableStep.route)}
                className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium flex items-center gap-1 hover:bg-primary/90 transition-colors"
              >
                Continue <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Phase progress bar */}
        {!isFuture && (
          <div className="mt-3 h-1 bg-black/10 dark:bg-white/5 rounded-full">
            <div className={cn('h-1 rounded-full transition-all', pc.bar)} style={{ width: `${phase.pct}%` }} />
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="px-5 pb-5 pt-3 space-y-0 divide-y divide-border/40">
        {phase.steps?.map((step, i) => {
          const stepActive = step.pct > 0 && step.pct < 85
          const stepDone = step.pct >= 85
          return (
            <div
              key={step.id}
              className={cn(
                'flex items-start gap-3 py-2.5',
                isFuture && 'opacity-50',
              )}
            >
              {/* Connector line */}
              <div className="flex flex-col items-center flex-shrink-0 mt-0.5">
                <StepDot pct={step.pct} active={stepActive} />
                {i < phase.steps.length - 1 && (
                  <div className={cn('w-px flex-1 mt-1', stepDone ? 'bg-emerald-500/30' : 'bg-border/40')} style={{ minHeight: 16 }} />
                )}
              </div>

              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    'text-xs font-medium',
                    stepDone ? 'text-emerald-400' : stepActive ? 'text-card-foreground' : 'text-muted-foreground/70',
                  )}>
                    {step.label}
                  </span>
                  {step.ip_badge && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1 py-0.5 rounded border border-primary/20 bg-primary/10 text-primary uppercase tracking-wide">
                      <Sparkles className="w-2 h-2" /> IP
                    </span>
                  )}
                  {step.pct > 0 && step.pct < 100 && (
                    <span className="text-[10px] text-muted-foreground/60 font-mono">{step.pct}%</span>
                  )}
                </div>
                {step.note && (
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5 leading-relaxed">{step.note}</p>
                )}
              </div>

              {step.route && !isFuture && (
                <button
                  type="button"
                  onClick={() => go(step.route)}
                  className={cn(
                    'flex-shrink-0 mt-0.5 w-6 h-6 rounded-md flex items-center justify-center transition-colors',
                    stepActive
                      ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                      : 'text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted/40',
                  )}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )
        })}

        {phase.has_dashboard && !isFuture && (
          <div className="pt-3 mt-1">
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-primary">Exit Readiness Dashboard</p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">{phase.dashboard_note}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Phase connector arrow */}
      {!isLast && (
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-10 w-6 h-6 rounded-full border border-border bg-card flex items-center justify-center shadow-sm">
          <ChevronRight className="w-3 h-3 text-muted-foreground/40 rotate-90" />
        </div>
      )}
    </div>
  )
}

export default function AdvisoryWorkflow() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const companyId = useCompanyId()
  const companyReady = companyId != null && companyId > 0
  const go = (appPath) => navigate(withCompanyQuery(resolvePath(appPath, pathname), companyId))

  const { data, isPending, error } = useQuery({
    queryKey: ['advisory-workflow', companyId],
    queryFn: () => apiClient.get(`/api/analytics/advisory-workflow/${companyId}`),
    enabled: companyReady,
    staleTime: 60_000,
  })

  if (!companyReady) {
    return (
      <div className="space-y-5 max-w-3xl">
        <SectionHeader
          title="Exit Blueprint"
          subtitle="5-phase deal process · select a client to load workflow progress"
        />
        <p className="text-sm text-muted-foreground">Select a client in the header to load workflow progress.</p>
      </div>
    )
  }

  if (isPending && !data) {
    return (
      <div className="space-y-5 max-w-3xl">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-16 w-full rounded-xl" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-5 max-w-3xl">
        <SectionHeader title="Exit Blueprint" subtitle="Could not load workflow state" />
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-400">
          {error?.message || 'Failed to load advisory workflow'}
        </div>
      </div>
    )
  }

  const phases = data?.phases ?? []
  const overall = data?.overall_pct ?? 0
  const completed = data?.completed_count ?? 0
  const total = data?.total_phases ?? phases.length

  const activePhase = phases.find(p => p.status === 'in_progress')

  return (
    <div className="space-y-6 max-w-3xl">
      <SectionHeader
        title="Exit Blueprint"
        subtitle="Deal process workflow · progress derived from live engagement data"
        action={
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary">
            Phase {completed}/{total} complete · {overall}% overall
          </span>
        }
      />

      {/* Overall progress strip */}
      <div className="rounded-xl border border-border bg-card px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-card-foreground">Overall Deal Progress</p>
          <span className="text-lg font-bold text-primary tabular-nums">{overall}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-2 rounded-full transition-all bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500"
            style={{ width: `${overall}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground mt-2">
          <span>Preparation</span>
          {activePhase && (
            <span className="text-primary font-medium">Phase {activePhase.phase}: {activePhase.label}</span>
          )}
          <span>Close</span>
        </div>
      </div>

      {/* Phases */}
      <div className="space-y-6">
        {phases.map((phase, i) => (
          <PhaseCard
            key={phase.phase}
            phase={phase}
            go={go}
            isFirst={i === 0}
            isLast={i === phases.length - 1}
          />
        ))}
      </div>

      {/* WM retention callout */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 flex items-start gap-3">
        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-emerald-400">Post-close AUM retained by wealth manager</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            The wealth manager remains the primary advisory relationship through close and into post-transaction wealth management.
          </p>
        </div>
      </div>
    </div>
  )
}
