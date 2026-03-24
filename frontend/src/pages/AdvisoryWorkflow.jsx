import { useNavigate } from 'react-router-dom'
import SectionHeader from '../components/ui/SectionHeader'
import { cn } from '../lib/utils'
import {
  CheckCircle, Clock, Circle, AlertCircle, ArrowRight,
  Building2, Plug, ShieldCheck, BarChart2, AlertTriangle,
  Shield, FileText, Target, TrendingUp
} from 'lucide-react'

const WORKFLOW_STAGES = [
  { stage: 1, label: 'Company Workspace',    desc: 'Entity profile, industry classification, ownership structure', cepaRef: 'CEPA 1.1', deliverable: 'Completed org profile',     iconName: 'Building2'     },
  { stage: 2, label: 'Valuation Baseline',   desc: 'EBITDA normalization, multiple benchmarking, EV range',       cepaRef: 'CEPA 2.1', deliverable: 'EV range model',           iconName: 'BarChart2'     },
  { stage: 3, label: 'Data Ingestion',       desc: 'Connect accounting, CRM, payroll, and banking sources',       cepaRef: 'CEPA 1.3', deliverable: 'Clean ontology',           iconName: 'Plug'          },
  { stage: 4, label: 'Diligence Readiness',  desc: 'DRS scoring across 6 dimensions with benchmark comparison',   cepaRef: 'CEPA 3.1', deliverable: 'DRS scorecard',           iconName: 'ShieldCheck'   },
  { stage: 5, label: 'Buyer Risk Analysis',  desc: 'Identify and quantify diligence flags a buyer will surface',  cepaRef: 'CEPA 3.2', deliverable: 'Risk heatmap',            iconName: 'AlertTriangle' },
  { stage: 6, label: 'Value Gap Analysis',   desc: 'Current EV vs achievable EV — initiative impact modeling',    cepaRef: 'CEPA 4.1', deliverable: 'Value gap report',        iconName: 'Target'        },
  { stage: 7, label: 'Data Room Readiness',  desc: 'VDR document audit, gap identification, buyer Q prep',        cepaRef: 'CEPA 4.2', deliverable: 'Document checklist',      iconName: 'FileText'      },
  { stage: 8, label: 'Report Generation',    desc: 'Produce advisor-grade exit readiness deliverable package',    cepaRef: 'CEPA 5.1', deliverable: 'Full report package',     iconName: 'TrendingUp'    },
  { stage: 9, label: 'Exit Execution',       desc: 'Process preparation, buyer targeting, go-to-market readiness',cepaRef: 'CEPA 5.2', deliverable: 'Exit execution plan',     iconName: 'Shield'        },
]

const STAGE_PROGRESS = [
  { stage: 1, status: 'completed',   pct: 100, note: 'Meridian Consulting Group profile complete' },
  { stage: 2, status: 'completed',   pct: 100, note: 'EV $14.1M–$19.7M · DRS 75.3' },
  { stage: 3, status: 'completed',   pct: 100, note: '4 sources · 1,948 records ingested' },
  { stage: 4, status: 'in_progress', pct: 60,  note: 'DRS 75.3 — Management & Growth need work' },
  { stage: 5, status: 'in_progress', pct: 40,  note: '4 open diligence flags identified' },
  { stage: 6, status: 'not_started', pct: 0,   note: null },
  { stage: 7, status: 'not_started', pct: 0,   note: null },
  { stage: 8, status: 'not_started', pct: 0,   note: null },
  { stage: 9, status: 'not_started', pct: 0,   note: null },
]

const STAGE_LINKS = { 2: '/Valuation', 4: '/Readiness', 5: '/BuyerLens', 6: '/ValueGap', 7: '/DataRoom', 8: '/Reports' }

const ICON_MAP = { Building2, Plug, ShieldCheck, BarChart2, AlertTriangle, Shield, FileText, Target, TrendingUp }

const STATUS_CFG = {
  completed:   { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'Completed'   },
  in_progress: { icon: Clock,       color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/30',   label: 'In Progress' },
  not_started: { icon: Circle,      color: 'text-muted-foreground', bg: 'bg-muted/20', border: 'border-border',         label: 'Not Started' },
  blocked:     { icon: AlertCircle, color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/30',    label: 'Blocked'     },
}

export default function AdvisoryWorkflow() {
  const navigate = useNavigate()
  const completed = STAGE_PROGRESS.filter(p => p.status === 'completed').length
  const overall = Math.round(STAGE_PROGRESS.reduce((s, p) => s + p.pct, 0) / STAGE_PROGRESS.length)
  const currentStage = STAGE_PROGRESS.find(p => p.status === 'in_progress')?.stage

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader
        title="CEPA Advisory Workflow"
        subtitle="BEI Value Acceleration Methodology™ — 9-stage certified exit planning engagement framework"
        action={
          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary">
            {completed}/9 stages complete · {overall}% overall
          </span>
        }
      />

      {/* Progress bar */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-card-foreground">Overall Engagement Progress</p>
          <span className="text-lg font-bold text-primary">{overall}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full">
          <div className="h-2 bg-primary rounded-full transition-all" style={{ width: `${overall}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
          <span>Company Workspace</span>
          <span className="text-primary font-medium">Stage {currentStage} active</span>
          <span>Exit Ready</span>
        </div>
      </div>

      {/* Stage pipeline */}
      <div className="space-y-3">
        {WORKFLOW_STAGES.map((stage, i) => {
          const prog = STAGE_PROGRESS[i]
          const st = STATUS_CFG[prog.status]
          const StIcon = st.icon
          const link = STAGE_LINKS[stage.stage]
          const isActive = prog.status === 'in_progress'

          return (
            <div key={stage.stage} className={cn('rounded-xl border bg-card p-5 transition-all', st.border, isActive && 'ring-1 ring-primary/30')}>
              <div className="flex items-center gap-4">
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold', st.bg, st.color)}>
                  {stage.stage}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-semibold text-card-foreground">{stage.label}</p>
                    {isActive && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-primary/20 bg-primary/10 text-primary">Active</span>}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{stage.desc}</p>
                  {prog.note && <p className="text-[11px] text-muted-foreground/70 mt-1 italic">{prog.note}</p>}
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="text-[9px] font-mono text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded">{stage.cepaRef}</span>
                    <span className="text-[9px] text-muted-foreground/60">▸ {stage.deliverable}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {prog.pct > 0 && prog.pct < 100 && (
                    <div className="hidden md:block w-24">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-muted-foreground">Progress</span>
                        <span className={st.color}>{prog.pct}%</span>
                      </div>
                      <div className="h-1 bg-muted rounded-full">
                        <div className={cn('h-1 rounded-full', prog.status === 'in_progress' ? 'bg-blue-500' : 'bg-emerald-500')} style={{ width: `${prog.pct}%` }} />
                      </div>
                    </div>
                  )}
                  <div className={cn('flex items-center gap-1.5 text-xs font-medium', st.color)}>
                    <StIcon className="w-3.5 h-3.5" />{st.label}
                  </div>
                  {link && (prog.status === 'in_progress' || prog.status === 'completed') && (
                    <button onClick={() => navigate(link)}
                      className={cn('text-xs px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-colors',
                        isActive ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90' : 'border-border text-muted-foreground hover:bg-muted/30')}>
                      {isActive ? 'Continue' : 'Review'} <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Next action */}
      {currentStage && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">Next Recommended Action</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Stage {currentStage}: {WORKFLOW_STAGES[currentStage - 1]?.label} — {STAGE_PROGRESS[currentStage - 1]?.note}
            </p>
          </div>
          {STAGE_LINKS[currentStage] && (
            <button onClick={() => navigate(STAGE_LINKS[currentStage])}
              className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium flex items-center gap-1.5 hover:bg-primary/90 transition-colors">
              Go to Stage <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
