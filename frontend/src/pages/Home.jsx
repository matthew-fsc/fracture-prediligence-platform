import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Network, Building2, Shield, Target, BarChart2,
  ArrowRight, Activity, ListChecks, ChevronRight,
  Zap, Clock, Loader2, NotebookPen,
} from 'lucide-react'
import { apiClient } from '../lib/apiClient'
import { cn, fmtM } from '../lib/utils'
import { Skeleton } from '../components/ui/Skeleton'
import { useCompanyId } from '../context/CompanyContext'
import { withCompanyQuery, resolvePath } from '../lib/navLinks'

const colorCfg = {
  blue:    'border-blue-500/20 bg-blue-500/5 text-blue-400',
  red:     'border-red-500/20 bg-red-500/5 text-red-400',
  emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400',
  amber:   'border-amber-500/20 bg-amber-500/5 text-amber-400',
  purple:  'border-purple-500/20 bg-purple-500/5 text-purple-400',
  primary: 'border-primary/20 bg-primary/5 text-primary',
}

const MODULES = [
  { label: 'Engagement Intake',   path: '/EngagementIntake',  icon: NotebookPen, color: 'primary', desc: 'Owner goals, exit timeline, buyer fit' },
  { label: 'Company Workspace',   path: '/CompanyWorkspace',  icon: Building2,  color: 'blue',    desc: 'Entity-centric intelligence hub' },
  { label: 'Buyer Risk Profile',  path: '/BuyerLens',         icon: Shield,     color: 'red',     desc: null },
  { label: 'Value Gap Analysis',  path: '/ValueGap',          icon: Target,     color: 'emerald', desc: 'Addressable value creation opportunity' },
  { label: 'Business Quality',    path: '/BusinessQuality',   icon: BarChart2,  color: 'blue',    desc: 'Operating metrics vs benchmarks' },
  { label: 'Scenario Simulator',  path: '/ScenarioSimulator', icon: Activity,   color: 'amber',   desc: 'Model adverse events in real time' },
  { label: 'Advisory Workflow',   path: '/AdvisoryWorkflow',  icon: ListChecks, color: 'primary', desc: 'CEPA engagement progress tracker' },
  { label: 'Systems Intelligence',path: '/Connectors',        icon: Network,    color: 'purple',  desc: 'Operational graph & dependencies' },
]

const quickActions = [
  { label: 'Capture engagement intake', path: '/EngagementIntake', color: 'text-primary' },
  { label: 'Generate Readiness Report', path: '/Reports',          color: 'text-primary' },
  { label: 'Review Buyer Risk Flags',   path: '/BuyerLens',        color: 'text-red-400' },
  { label: 'Run Scenario Simulation',   path: '/ScenarioSimulator', color: 'text-amber-400' },
  { label: 'Check Data Quality',        path: '/DataQuality',      color: 'text-blue-400' },
]

function buildActivity(jobs, liveData, bqData, gapData) {
  const items = []
  for (const j of (jobs ?? []).slice(0, 5)) {
    const label = {
      quickbooks_pl: 'QuickBooks P&L',
      quickbooks_ar: 'QuickBooks A/R Aging',
      quickbooks_tx: 'QuickBooks Transactions',
      crm_export: 'CRM Export',
      payroll: 'Payroll Register',
      customer_list: 'Customer List',
      contract_list: 'Contract List',
      bank_statement: 'Bank Statement',
    }[j.source_type] ?? j.filename ?? 'File'
    const rows = j.row_count ? `${j.row_count.toLocaleString()} rows` : ''
    const detail = [rows, j.mapped_count ? `${j.mapped_count} columns mapped` : ''].filter(Boolean).join(' · ')
    const d = j.created_at ? new Date(j.created_at) : null
    const time = d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
    items.push({ event: `${label} ingested`, detail: detail || j.status, time })
  }
  if (liveData?.drs?.base != null) {
    const tier = liveData.drs.tier ?? ''
    items.push({
      event: `DRS scored: ${liveData.drs.base.toFixed(1)}/100${tier ? ` — ${tier} tier` : ''}`,
      detail: `6 categories scored · composite readiness index`,
      time: 'Current',
    })
  }
  const crit = (bqData?.questions ?? []).find(q => q.severity === 'CRITICAL')
  if (crit) {
    items.push({
      event: `Critical flag: ${crit.question.length > 55 ? crit.question.slice(0, 52) + '…' : crit.question}`,
      detail: crit.category ?? '',
      time: 'Active',
    })
  }
  const activityValueGap = Math.max(0, (gapData?.potential_ev_midpoint ?? 0) - (liveData?.enterprise_value?.midpoint ?? 0))
  if (activityValueGap > 0) {
    items.push({
      event: `Value gap analysis: +${fmtM(activityValueGap)} opportunity`,
      detail: `${gapData.gaps?.length ?? 0} value drivers identified`,
      time: 'Current',
    })
  }
  return items.slice(0, 6)
}

function workspaceLoadingUi(message = 'Loading workspace…') {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

const ANALYTICS_STALE_MS = 120_000

export default function Home() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const companyId = useCompanyId()
  const companyReady = companyId != null && companyId > 0
  const go = (appPath) => navigate(withCompanyQuery(resolvePath(appPath, pathname), companyId))

  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => apiClient.get('/api/companies'),
  })

  const { data: liveData = null, isPending: scoresPending } = useQuery({
    queryKey: ['analytics-scores', companyId],
    queryFn: () => apiClient.get(`/api/analytics/scores/${companyId}`),
    enabled: companyReady,
    staleTime: ANALYTICS_STALE_MS,
  })

  const { data: bqData = null } = useQuery({
    queryKey: ['analytics-buyer-questions', companyId],
    queryFn: () => apiClient.get(`/api/analytics/buyer-questions/${companyId}`),
    enabled: companyReady,
    staleTime: ANALYTICS_STALE_MS,
  })

  const { data: gapData = null } = useQuery({
    queryKey: ['analytics-value-gap', companyId],
    queryFn: () => apiClient.get(`/api/analytics/value-gap/${companyId}`),
    enabled: companyReady,
    staleTime: ANALYTICS_STALE_MS,
  })

  const { data: jobs = [] } = useQuery({
    queryKey: ['ingestion-jobs', companyId],
    queryFn: () =>
      apiClient.get(`/api/ingestion/jobs/${companyId}`).then((d) => (Array.isArray(d) ? d : [])),
    enabled: companyReady,
    staleTime: 60_000,
  })

  if (companyId == null) {
    if (companiesLoading) {
      return workspaceLoadingUi()
    }
    if (companies.length === 0) {
      return (
        <div className="rounded-xl border border-border bg-card p-8 text-center max-w-lg mx-auto">
          <p className="text-foreground font-medium">No clients yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            Create a client from the company menu in the header to see your dashboard.
          </p>
        </div>
      )
    }
    return workspaceLoadingUi('Preparing workspace…')
  }

  const drs       = liveData?.drs?.base ?? 0
  const currentEV  = liveData?.enterprise_value?.midpoint ?? 0
  const potentialEV = gapData?.potential_ev_midpoint ?? liveData?.enterprise_value?.ceiling ?? 0
  const valueGap   = Math.max(0, potentialEV - currentEV)

  const criticalCount = bqData?.questions?.filter(q => q.severity === 'CRITICAL').length ?? 0
  const highCount     = bqData?.questions?.filter(q => q.severity === 'HIGH').length ?? 0
  const blockerCount  = criticalCount + highCount

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const activityItems = buildActivity(jobs, liveData, bqData, gapData)

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Greeting */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">{dateStr}</p>
        <h1 className="text-2xl font-bold text-foreground">{greeting}, Advisor</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Here&apos;s your advisory intelligence briefing</p>
      </div>

      {/* Status strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {companyReady && liveData == null && scoresPending ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-3 space-y-2">
              <Skeleton className="h-2 w-24" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-2 w-20" />
            </div>
          ))
        ) : (
          [
            { label: 'Active Engagements', value: '1',                   sub: companies[0]?.name ?? 'No client selected', color: 'blue'    },
            { label: 'Readiness Score',    value: `${drs}/100`,           sub: liveData?.drs?.tier ? `${liveData.drs.tier} Tier` : 'Score pending', color: 'amber'   },
            { label: 'Open Blockers',      value: String(blockerCount),   sub: `${criticalCount} critical flags`, color: 'red' },
            { label: 'Value Opportunity',  value: `+${fmtM(valueGap)}`,  sub: 'if all gaps resolved',   color: 'emerald' },
          ].map(c => (
            <div key={c.label} className={cn('rounded-xl border p-3', colorCfg[c.color])}>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{c.label}</p>
              <p className="text-xl font-bold">{c.value}</p>
              <p className="text-[11px] text-muted-foreground">{c.sub}</p>
            </div>
          ))
        )}
      </div>

      {/* Module grid */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Advisory Modules</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {MODULES.map(m => {
            const Icon = m.icon
            return (
              <div key={m.path} onClick={() => go(m.path)}
                className={cn('rounded-lg border p-4 hover:scale-[1.02] transition-all cursor-pointer group', colorCfg[m.color])}>
                <Icon className="w-5 h-5 mb-2" />
                <p className="text-sm font-semibold text-foreground">{m.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {m.path === '/BuyerLens' && bqData
                    ? `${bqData.total} flags · ${criticalCount} critical`
                    : m.desc}
                </p>
                <div className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
                  Open <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-7 rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" /> Recent Activity
          </p>
          <div className="space-y-2.5">
            {activityItems.length === 0
              ? <p className="text-xs text-muted-foreground">Upload data to see activity.</p>
              : activityItems.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    <div>
                      <p className="text-xs text-foreground">{r.event}</p>
                      <p className="text-[11px] text-muted-foreground">{r.detail}</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground flex-shrink-0 ml-2">{r.time}</span>
                </div>
              ))
            }
          </div>
        </div>
        <div className="col-span-12 md:col-span-5 rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Quick Actions
          </p>
          <div className="space-y-2">
            {quickActions.map((a, i) => (
              <button key={i} onClick={() => go(a.path)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:bg-muted/30 transition-colors group">
                <span className={cn('text-xs font-medium', a.color)}>{a.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
