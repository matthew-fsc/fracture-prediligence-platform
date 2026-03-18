import PageHeader from '../components/ui/PageHeader'
import ProgressBar from '../components/ui/ProgressBar'
import StatusBadge from '../components/ui/StatusBadge'
import SectionDivider from '../components/ui/SectionDivider'
import { advisoryWorkflowStages } from '../lib/mockData'

export default function AdvisoryWorkflow() {
  const complete = advisoryWorkflowStages.filter(s => s.status === 'complete').length
  return (
    <div>
      <PageHeader
        section="Workspace"
        title="CEPA Advisory Workflow"
        subtitle="BEI Value Acceleration Methodology™ — 9-stage certified exit planning engagement framework"
        badge={`${complete}/9 stages complete · ${Math.round(complete/9*100)}% overall`}
      />
      <div className="bg-card border border-border rounded-lg p-5 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-card-foreground">Overall Engagement Progress</p>
          <span className="text-xs text-muted-foreground">{Math.round(complete/9*100)}%</span>
        </div>
        <ProgressBar value={complete/9*100} />
      </div>
      <div className="space-y-3">
        {advisoryWorkflowStages.map((s) => (
          <div key={s.stage} className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${s.status === 'complete' ? 'bg-primary text-primary-foreground' : s.status === 'in_progress' ? 'bg-warning/20 text-warning' : 'bg-muted text-muted-foreground'}`}>
              {s.stage}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-card-foreground">{s.name}</p>
              <ProgressBar value={s.progress} className="mt-1.5 max-w-xs" />
            </div>
            <StatusBadge variant={s.status === 'complete' ? 'adequate' : s.status === 'in_progress' ? 'watch' : 'medium'}>
              {s.status === 'in_progress' ? 'In Progress' : s.status === 'complete' ? 'Complete' : 'Pending'}
            </StatusBadge>
          </div>
        ))}
      </div>
    </div>
  )
}
