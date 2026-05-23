import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Network, Building2, Shield, Target, BarChart2,
  ArrowRight, Activity, ListChecks, ChevronRight,
  Zap, Clock, Loader2, NotebookPen, TrendingUp,
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
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
  { label: 'Client Profile',       path: '/EngagementIntake',  icon: NotebookPen, color: 'primary', desc: 'Owner goals, exit timeline, buyer fit' },
  { label: 'Company Workspace',   path: '/CompanyWorkspace',  icon: Building2,  color: 'blue',    desc: 'Entity-centric intelligence hub' },
  { label: 'Buyer Risk Profile',  path: '/BuyerLens',         icon: Shield,     color: 'red',     desc: null },
  { label: 'Value Gap Analysis',  path: '/ValueGap',          icon: Target,     color: 'emerald', desc: 'Addressable value creation opportunity' },
  { label: 'Business Quality',    path: '/BusinessQuality',   icon: BarChart2,  color: 'blue',    desc: 'Operating metrics vs benchmarks' },
  { label: 'Scenario Simulator',  path: '/ScenarioSimulator', icon: Activity,   color: 'amber',   desc: 'Model adverse events in real time' },
  { label: 'Advisory Workflow',   path: '/AdvisoryWorkflow',  icon: ListChecks, color: 'primary', desc: 'CEPA engagement progress tracker' },
  { label: 'Systems Intelligence',path: '/Connectors',        icon: Network,    color: 'purple',  desc: 'Operational graph & dependencies' },
]

const quickActions = [
  { label: 'Capture client profile', path: '/EngagementIntake', color: 'text-primary' },
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

  const { data: engProfile = null } = useQuery({
    queryKey: ['engagement-profile', companyId],
    queryFn: () => apiClient.get(`/api/analytics/engagement-profile/${companyId}`).catch(() => null),
    enabled: companyReady,
    staleTime: ANALYTICS_STALE_MS,
  })

  const { data: snapshotData = null } = useQuery({
    queryKey: ['score-history', companyId],
    queryFn: () => apiClient.get(`/api/analytics/scores/${companyId}/history`),
    enabled: companyReady,
    staleTime: ANALYTICS_STALE_MS,
  })

  if (companyId == null) {
    if (companiesLoading) {
      return workspaceLoadingUi()
    }
    if (companies.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div className="space-y-2 max-w-sm">
            <h2 className="text-xl font-semibold text-foreground">Welcome to Pre-Diligence</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Create your first client to get started. Use the company switcher in the top-left header to add a client name.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-left max-w-sm w-full">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Getting started</p>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Click the <span className="text-foreground font-medium">company menu</span> in the header (top-left)</li>
              <li>Type a client name and press <span className="text-foreground font-medium">+</span></li>
              <li>Your dashboard will load automatically</li>
            </ol>
          </div>
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

      {/* Data quality indicator */}
      {liveData?.drs?.confidence_summary?.category_levels && (() => {
        const levels = liveData.drs.confidence_summary.category_levels
        const all = Object.values(levels)
        const highCount = all.filter(v => v === 'HIGH').length
        const mediumCount = all.filter(v => v === 'MEDIUM').length
        const lowCount = all.filter(v => v === 'LOW').length
        const total = all.length
        const overallLevel = liveData.drs.confidence_summary.overall_level
        const overallColor = overallLevel === 'HIGH' ? 'emerald' : overallLevel === 'MEDIUM' ? 'amber' : 'red'
        return (
          <div className={cn('rounded-xl border p-4', colorCfg[overallColor])}>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              Data Quality
              <span className={cn('ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border', colorCfg[overallColor])}>
                {overallLevel}
              </span>
            </p>
            <div className="h-2 rounded-full overflow-hidden bg-muted/30 flex mb-3">
              {highCount > 0   && <div className="bg-emerald-500 h-full transition-all" style={{ width: `${highCount   / total * 100}%` }} />}
              {mediumCount > 0 && <div className="bg-amber-500  h-full transition-all" style={{ width: `${mediumCount / total * 100}%` }} />}
              {lowCount > 0    && <div className="bg-red-500    h-full transition-all" style={{ width: `${lowCount    / total * 100}%` }} />}
            </div>
            <div className="flex gap-4 text-[11px] mb-2 flex-wrap">
              {[
                { label: 'High confidence',   count: highCount,   color: 'text-emerald-400' },
                { label: 'Med confidence',    count: mediumCount, color: 'text-amber-400'   },
                { label: 'Low confidence',    count: lowCount,    color: 'text-red-400'     },
              ].map(({ label, count, color }) => count > 0 && (
                <span key={label} className="flex items-center gap-1">
                  <span className={cn('font-bold tabular-nums', color)}>{count}</span>
                  <span className="text-muted-foreground">{label}</span>
                </span>
              ))}
            </div>
            {liveData.drs.confidence_summary.factors?.[0] && (
              <p className="text-[10px] text-muted-foreground leading-snug">
                {liveData.drs.confidence_summary.factors[0]}
              </p>
            )}
          </div>
        )
      })()}

      {/* Owner financial gap */}
      {(() => {
        const ownerTarget = engProfile?.target_valuation != null ? Number(engProfile.target_valuation) : null
        const financialGap = engProfile?.personal_financial_gap != null ? Number(engProfile.personal_financial_gap) : null
        const evShortfall = ownerTarget && currentEV ? Math.max(0, ownerTarget - currentEV) : null
        if (!ownerTarget && !financialGap) return null
        return (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-amber-400" />
              Owner Financial Target
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              {ownerTarget != null && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">Owner Target</p>
                  <p className="text-lg font-bold text-amber-400">{fmtM(ownerTarget)}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">Current EV</p>
                <p className="text-lg font-bold text-blue-400">{currentEV ? fmtM(currentEV) : '—'}</p>
              </div>
              {evShortfall != null && evShortfall > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">EV Shortfall</p>
                  <p className="text-lg font-bold text-red-400">{fmtM(evShortfall)}</p>
                </div>
              )}
              {financialGap != null && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">Personal Fin. Gap</p>
                  <p className="text-lg font-bold text-red-400">{fmtM(financialGap)}</p>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Owner Personal Readiness (PRE) Score */}
      {liveData?.owner_readiness && (() => {
        const pre = liveData.owner_readiness
        const tierColor =
          pre.tier === 'Aligned'       ? 'emerald' :
          pre.tier === 'Mostly Ready'  ? 'blue'    :
          pre.tier === 'Moderate Gap'  ? 'amber'   : 'red'
        const barColor =
          pre.tier === 'Aligned'       ? 'bg-emerald-500' :
          pre.tier === 'Mostly Ready'  ? 'bg-blue-500'    :
          pre.tier === 'Moderate Gap'  ? 'bg-amber-500'   : 'bg-red-500'
        return (
          <div className={cn('rounded-xl border p-4', colorCfg[tierColor])}>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Owner Personal Readiness (PRE)
            </p>
            <div className="flex items-end gap-4 mb-3">
              <div>
                <p className="text-3xl font-black">{pre.pre_score.toFixed(0)}<span className="text-base font-semibold text-muted-foreground">/100</span></p>
                <p className="text-xs font-semibold mt-0.5">{pre.tier}</p>
              </div>
              <div className="flex-1 pb-1">
                <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pre.pre_score}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">{pre.summary}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {pre.dimensions.map(d => (
                <div key={d.name} className="rounded-lg bg-background/30 border border-border/40 px-2.5 py-2">
                  <p className="text-[10px] font-semibold text-muted-foreground">{d.name}</p>
                  <p className="text-sm font-bold mt-0.5">{d.score.toFixed(0)}<span className="text-[10px] text-muted-foreground">/100</span></p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{d.label}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* DRS Score Trend */}
      {(() => {
        const snaps = snapshotData?.snapshots ?? []
        if (snaps.length < 2) return null
        const chartData = snaps.map(s => ({
          date: s.created_at ? new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
          drs: typeof s.drs_score === 'number' ? parseFloat(s.drs_score.toFixed(1)) : null,
        }))
        const first = snaps[0]?.drs_score ?? 0
        const last  = snaps[snaps.length - 1]?.drs_score ?? 0
        const delta = last - first
        const deltaColor = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-muted-foreground'
        return (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              <p className="text-xs font-semibold text-foreground">DRS Score Trend</p>
              <span className={cn('text-[11px] font-bold ml-1', deltaColor)}>
                {delta >= 0 ? '+' : ''}{delta.toFixed(1)} pts
              </span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {snaps.length} snapshots · last {snaps.length >= 30 ? '90' : snaps.length} captures
              </span>
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 11 }}
                  labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                  formatter={(v) => [v, 'DRS']}
                />
                <ReferenceLine y={70} stroke="hsl(var(--emerald-400, 52 211 153))" strokeDasharray="3 3" strokeOpacity={0.4} />
                <Line type="monotone" dataKey="drs" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )
      })()}

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
