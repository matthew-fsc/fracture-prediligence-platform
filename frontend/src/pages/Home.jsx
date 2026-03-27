import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Network, Building2, Shield, Target, BarChart2,
  ArrowRight, Activity, ListChecks, Bot, ChevronRight,
  Zap, Clock
} from 'lucide-react'
import { cn, fmtM } from '../lib/utils'
import { recentActivity } from '../lib/mockData'
import { Skeleton } from '../components/ui/Skeleton'
import { useCompanyId } from '../context/CompanyContext'
import { withCompanyQuery } from '../lib/navLinks'

const colorCfg = {
  blue:    'border-blue-500/20 bg-blue-500/5 text-blue-400',
  red:     'border-red-500/20 bg-red-500/5 text-red-400',
  emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400',
  amber:   'border-amber-500/20 bg-amber-500/5 text-amber-400',
  purple:  'border-purple-500/20 bg-purple-500/5 text-purple-400',
  primary: 'border-primary/20 bg-primary/5 text-primary',
}

const MODULES = [
  { label: 'Company Workspace',   path: '/CompanyWorkspace',  icon: Building2,  color: 'blue',    desc: 'Entity-centric intelligence hub' },
  { label: 'Buyer Risk Profile',  path: '/BuyerLens',         icon: Shield,     color: 'red',     desc: null },
  { label: 'Value Gap Analysis',  path: '/ValueGap',          icon: Target,     color: 'emerald', desc: 'Addressable value creation opportunity' },
  { label: 'Business Quality',    path: '/BusinessQuality',   icon: BarChart2,  color: 'blue',    desc: 'Operating metrics vs benchmarks' },
  { label: 'Scenario Simulator',  path: '/ScenarioSimulator', icon: Activity,   color: 'amber',   desc: 'Model adverse events in real time' },
  { label: 'Advisory Workflow',   path: '/AdvisoryWorkflow',  icon: ListChecks, color: 'primary', desc: '3/9 stages complete' },
  { label: 'Systems Intelligence',path: '/Connectors',        icon: Network,    color: 'purple',  desc: 'Operational graph & dependencies' },
  { label: 'AI Copilot',          path: '/AICopilot',         icon: Bot,        color: 'primary', desc: 'Ask questions about your data' },
]

const quickActions = [
  { label: 'Generate Readiness Report', path: '/Reports',          color: 'text-primary' },
  { label: 'Review Buyer Risk Flags',   path: '/BuyerLens',        color: 'text-red-400' },
  { label: 'Run Scenario Simulation',   path: '/ScenarioSimulator', color: 'text-amber-400' },
  { label: 'Check Data Quality',        path: '/DataQuality',      color: 'text-blue-400' },
  { label: 'Open AI Copilot',           path: '/AICopilot',        color: 'text-primary' },
]

export default function Home() {
  const navigate = useNavigate()
  const companyId = useCompanyId()
  const [liveData, setLiveData] = useState(null)
  const [bqData, setBqData] = useState(null)
  const [gapData, setGapData] = useState(null)

  useEffect(() => {
    fetch(`/api/analytics/scores/${companyId}`)
      .then(r => r.ok ? r.json() : null)
      .then(setLiveData)
      .catch(() => {})
    fetch(`/api/analytics/buyer-questions/${companyId}`)
      .then(r => r.ok ? r.json() : null)
      .then(setBqData)
      .catch(() => {})
    fetch(`/api/analytics/value-gap/${companyId}`)
      .then(r => r.ok ? r.json() : null)
      .then(setGapData)
      .catch(() => {})
  }, [companyId])

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

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Greeting */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">{dateStr}</p>
          <h1 className="text-2xl font-bold text-foreground">{greeting}, Advisor</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Here's your advisory intelligence briefing</p>
        </div>

      </div>

      {/* Status strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {liveData === null ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-3 space-y-2">
              <Skeleton className="h-2 w-24" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-2 w-20" />
            </div>
          ))
        ) : (
          [
            { label: 'Active Engagements', value: '1',                   sub: 'ABC Company Inc',        color: 'blue'    },
            { label: 'Readiness Score',    value: `${drs}/100`,           sub: 'High Risk Tier',         color: 'amber'   },
            { label: 'Open Blockers',      value: String(blockerCount),   sub: `${criticalCount} critical flags`, color: 'red' },
            { label: 'Value Opportunity',  value: `+${fmtM(valueGap)}`,  sub: 'if all gaps resolved',   color: 'emerald' },
          ].map(c => (
            <div key={c.label} className={cn('rounded-xl border p-3', colorCfg[c.color])}>
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{c.label}</p>
              <p className="text-xl font-bold">{c.value}</p>
              <p className="text-[10px] text-muted-foreground">{c.sub}</p>
            </div>
          ))
        )}
      </div>

      {/* Module grid */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Advisory Modules</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {MODULES.map(m => {
            const Icon = m.icon
            return (
              <div key={m.path} onClick={() => navigate(withCompanyQuery(m.path, companyId))}
                className={cn('rounded-lg border p-4 hover:scale-[1.02] transition-all cursor-pointer group', colorCfg[m.color])}>
                <Icon className="w-5 h-5 mb-2" />
                <p className="text-sm font-semibold text-foreground">{m.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {m.path === '/BuyerLens' && bqData
                    ? `${bqData.total} flags · ${criticalCount} critical`
                    : m.desc}
                </p>
                <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
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
            {recentActivity.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs text-foreground">{r.event}</p>
                    <p className="text-[10px] text-muted-foreground">{r.detail}</p>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">{r.time}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="col-span-12 md:col-span-5 rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Quick Actions
          </p>
          <div className="space-y-2">
            {quickActions.map((a, i) => (
              <button key={i} onClick={() => navigate(withCompanyQuery(a.path, companyId))}
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
