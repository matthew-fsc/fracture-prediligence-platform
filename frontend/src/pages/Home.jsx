import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Shield, Target, BarChart2,
  Activity, Workflow, Network, Bot, ChevronRight,
} from 'lucide-react'
import KpiCard from '../components/ui/KpiCard'
import SectionDivider from '../components/ui/SectionDivider'
import { recentActivity, kpis as mockKpis } from '../lib/mockData'
import { fmtM } from '../lib/utils'

const COMPANY_ID = 1

const modules = [
  { label: 'Company Workspace',  icon: FileText,  subtitle: 'Entity-centric intelligence hub',         href: '/CompanyWorkspace' },
  { label: 'Buyer Risk Profile', icon: Shield,    subtitle: '6 active flags · 2 critical',              href: '/BuyerLens' },
  { label: 'Value Gap Analysis', icon: Target,    subtitle: '+$4.28M value creation opportunity',        href: '/ValueGap' },
  { label: 'Business Quality',   icon: BarChart2, subtitle: 'Operating metrics vs benchmarks',           href: '/BusinessQuality' },
  { label: 'Scenario Simulator', icon: Activity,  subtitle: 'Model adverse events in real time',         href: '/ScenarioSimulator' },
  { label: 'Advisory Workflow',  icon: Workflow,  subtitle: '3/9 stages complete',                       href: '/AdvisoryWorkflow' },
  { label: 'Systems Intelligence',icon: Network,  subtitle: 'Operational graph & dependencies',          href: '/Connectors' },
  { label: 'AI Copilot',         icon: Bot,       subtitle: 'Ask questions about your data',             href: '/AICopilot' },
]

const quickActions = [
  { label: 'Generate Readiness Report', href: '/Reports' },
  { label: 'Review Buyer Risk Flags',   href: '/BuyerLens' },
  { label: 'Run Scenario Simulation',   href: '/ScenarioSimulator' },
  { label: 'Check Data Quality',        href: '/DataQuality' },
  { label: 'Open AI Copilot',           href: '/AICopilot' },
]

export default function Home() {
  const navigate = useNavigate()
  const [liveData, setLiveData] = useState(null)

  useEffect(() => {
    fetch(`/api/analytics/scores/${COMPANY_ID}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setLiveData(d))
      .catch(() => {})
  }, [])

  const kpis = {
    ...mockKpis,
    drs:      liveData?.drs?.base ?? mockKpis.drs,
    valueGap: liveData
      ? Math.max(0, (liveData.enterprise_value?.ceiling ?? 0) - (liveData.enterprise_value?.midpoint ?? 0))
      : mockKpis.valueGap,
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm text-muted-foreground">Wednesday, March 18, 2026</p>
          <h1 className="text-3xl font-bold text-card-foreground mt-0.5">Good evening, Advisor</h1>
          <p className="text-sm text-muted-foreground mt-1">Here's your advisory intelligence briefing</p>
        </div>
        <button
          onClick={() => navigate('/CompanyWorkspace')}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          Open Workspace
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard label="Active Engagements" value="3"                      sublabel="1 in pre-diligence" />
        <KpiCard label="Readiness Score"    value={`${kpis.drs}/100`}      sublabel="Meridian Group" />
        <KpiCard label="Open Blockers"      value="4"                      sublabel="2 critical flags" />
        <KpiCard label="Value Opportunity"  value={`+${fmtM(kpis.valueGap)}`} sublabel="addressable gap" />
      </div>

      {/* Advisory Modules */}
      <SectionDivider label="Advisory Modules" />
      <div className="grid grid-cols-4 gap-3 mb-6">
        {modules.map(({ label, icon: Icon, subtitle, href }) => (
          <div
            key={label}
            onClick={() => navigate(href)}
            className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-primary/40 transition-colors"
          >
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center mb-3">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-card-foreground">{label}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">{subtitle}</p>
            <button className="text-[11px] text-primary font-medium flex items-center gap-1">
              Open <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Recent Activity */}
        <div className="bg-card border border-border rounded-lg p-4">
          <SectionDivider label="Recent Activity" />
          <div className="space-y-3">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-card-foreground">{item.event}</p>
                  <p className="text-[11px] text-muted-foreground">{item.detail}</p>
                </div>
                <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-3">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-card border border-border rounded-lg p-4">
          <SectionDivider label="Quick Actions" />
          <div className="space-y-2">
            {quickActions.map(({ label, href }) => (
              <button
                key={label}
                onClick={() => navigate(href)}
                className="w-full text-left flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted/50 transition-colors group"
              >
                <span className="text-sm text-card-foreground">{label}</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
