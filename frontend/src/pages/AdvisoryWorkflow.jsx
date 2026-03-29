import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import SectionHeader from '../components/ui/SectionHeader'
import { cn } from '../lib/utils'
import {
  CheckCircle, Clock, Circle, AlertCircle, ArrowRight,
  Building2, Plug, ShieldCheck, BarChart2, AlertTriangle,
  Shield, FileText, Target, TrendingUp,
} from 'lucide-react'
import { useCompanyId } from '../context/CompanyContext'
import { apiClient } from '../lib/apiClient'
import { withCompanyQuery, resolvePath } from '../lib/navLinks'
import { Skeleton } from '../components/ui/Skeleton'

const ICON_MAP = { Building2, Plug, ShieldCheck, BarChart2, AlertTriangle, Shield, FileText, Target, TrendingUp }

const STATUS_CFG = {
  completed:   { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'Completed'   },
  in_progress: { icon: Clock,       color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/30',   label: 'In Progress' },
  not_started: { icon: Circle,      color: 'text-muted-foreground', bg: 'bg-muted/20', border: 'border-border',         label: 'Not Started' },
  blocked:     { icon: AlertCircle, color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/30',    label: 'Blocked'     },
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
      <div className="space-y-5 max-w-[1400px]">
        <SectionHeader
          title="Advisory Workflow"
          subtitle="BEI Value Acceleration Methodology™ — 9-stage certified exit planning engagement framework"
        />
        <p className="text-sm text-muted-foreground">Select a client in the header to load workflow progress.</p>
      </div>
    )
  }

  if (isPending && !data) {
    return (
      <div className="space-y-5 max-w-[1400px]">
        <Skeleton className="h-8 w-96" />
        <Skeleton className="h-24 w-full rounded-xl" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-5 max-w-[1400px]">
        <SectionHeader title="Advisory Workflow" subtitle="Could not load workflow state" />
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-400">
          {error?.message || 'Failed to load advisory workflow'}
        </div>
      </div>
    )
  }

  const stages = data?.stages ?? []
  const overall = data?.overall_pct ?? 0
  const completed = data?.completed_count ?? 0
  const total = data?.total_stages ?? (stages.length > 0 ? stages.length : 9)
  const currentStage = data?.current_stage ?? null
  const firstInProgress = stages.find(s => s.status === 'in_progress')

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader
        title="Advisory Workflow"
        subtitle="9-stage exit planning engagement framework · stage progress derived from live data"
        action={
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary">
            {completed}/{total} stages complete · {overall}% overall
          </span>
        }
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-card-foreground">Overall Engagement Progress</p>
          <span className="text-lg font-bold text-primary">{overall}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full">
          <div className="h-2 bg-primary rounded-full transition-all" style={{ width: `${overall}%` }} />
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground mt-1.5">
          <span>Company Workspace</span>
          <span className="text-primary font-medium">
            {currentStage != null ? `Stage ${currentStage} active` : 'Pick a stage to advance'}
          </span>
          <span>Exit Ready</span>
        </div>
      </div>

      <div className="space-y-3">
        {stages.map((stage) => {
          const st = STATUS_CFG[stage.status] ?? STATUS_CFG.not_started
          const StIcon = st.icon
          const IconComponent = ICON_MAP[stage.iconName] ?? Building2
          const route = stage.route
          const isActive = stage.status === 'in_progress'
          const canLink = !!route

          return (
            <div
              key={stage.stage}
              className={cn('rounded-xl border bg-card p-5 transition-all', st.border, isActive && 'ring-1 ring-primary/30')}
            >
              <div className="flex items-center gap-4">
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold', st.bg, st.color)}>
                  {stage.stage}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <IconComponent className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden />
                    <p className="text-sm font-semibold text-card-foreground">{stage.label}</p>
                    {isActive && (
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded border border-primary/20 bg-primary/10 text-primary">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{stage.desc}</p>
                  {stage.note && <p className="text-[11px] text-muted-foreground/70 mt-1 italic">{stage.note}</p>}
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="text-[11px] font-mono text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded">{stage.cepaRef}</span>
                    <span className="text-[11px] text-muted-foreground/60">▸ {stage.deliverable}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {stage.pct > 0 && stage.pct < 100 && (
                    <div className="hidden md:block w-24">
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-muted-foreground">Progress</span>
                        <span className={st.color}>{stage.pct}%</span>
                      </div>
                      <div className="h-1 bg-muted rounded-full">
                        <div
                          className={cn('h-1 rounded-full', stage.status === 'in_progress' ? 'bg-blue-500' : 'bg-emerald-500')}
                          style={{ width: `${stage.pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <div className={cn('flex items-center gap-1.5 text-xs font-medium', st.color)}>
                    <StIcon className="w-3.5 h-3.5" />
                    {st.label}
                  </div>
                  {canLink && (
                    <button
                      type="button"
                      onClick={() => go(route)}
                      className={cn(
                        'text-xs px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
                          : 'border-border text-muted-foreground hover:bg-muted/30',
                      )}
                    >
                      {isActive ? 'Continue' : stage.status === 'completed' ? 'Review' : 'Start'} <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {firstInProgress && firstInProgress.route && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-semibold text-primary">Next Recommended Action</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Stage {firstInProgress.stage}: {firstInProgress.label}
              {firstInProgress.note ? ` — ${firstInProgress.note}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => go(firstInProgress.route)}
            className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium flex items-center gap-1.5 hover:bg-primary/90 transition-colors"
          >
            Go to Stage <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  )
}
