import SectionHeader from '../components/ui/SectionHeader'
import { cn } from '../lib/utils'
import { FolderOpen, FileText, CheckCircle, AlertCircle, Clock } from 'lucide-react'

const VDR_PROVIDERS = [
  { name: 'Datasite',   abbr: 'DS', status: 'connected',    description: 'Connected. 2 active rooms.',   color: 'emerald' },
  { name: 'DealRoom',   abbr: 'DR', status: 'disconnected', description: 'API integration available.',   color: 'muted'   },
  { name: 'Firmex',     abbr: 'FX', status: 'disconnected', description: 'API integration available.',   color: 'muted'   },
  { name: 'Intralinks', abbr: 'IL', status: 'disconnected', description: 'API integration available.',   color: 'muted'   },
]

const DOC_CATEGORIES = [
  {
    category: 'Financial',
    docs: [
      { name: 'Income Statement (3yr)',    status: 'present',  note: 'QuickBooks export — current' },
      { name: 'Balance Sheet (3yr)',       status: 'present',  note: 'QuickBooks export — current' },
      { name: 'EBITDA Recast Schedule',    status: 'missing',  note: 'Needs advisor preparation' },
      { name: 'Revenue by Customer',       status: 'present',  note: 'Derived from QuickBooks' },
      { name: 'Accounts Receivable Aging', status: 'present',  note: 'QuickBooks A/R export' },
    ],
  },
  {
    category: 'Legal & Contracts',
    docs: [
      { name: 'Articles of Incorporation', status: 'missing',  note: 'Required for all buyers' },
      { name: 'Customer Contracts / MSAs', status: 'missing',  note: '0 of 5 top customers have signed MSAs' },
      { name: 'Employee Agreements',       status: 'present',  note: 'Gusto — offer letters on file' },
      { name: 'IP Assignments',            status: 'partial',  note: 'Incomplete — 3 of 7 signed' },
    ],
  },
  {
    category: 'Operations',
    docs: [
      { name: 'Org Chart',                 status: 'missing',  note: 'Required for management review' },
      { name: 'SOPs / Process Docs',       status: 'missing',  note: 'Not yet created' },
      { name: 'Customer List',             status: 'present',  note: 'HubSpot export — current' },
      { name: 'Technology Stack Diagram',  status: 'partial',  note: 'Partial — missing integrations' },
    ],
  },
]

const statusIcon = {
  present: CheckCircle,
  missing: AlertCircle,
  partial: Clock,
}
const statusColor = {
  present: 'text-emerald-400',
  missing: 'text-red-400',
  partial: 'text-amber-400',
}
const statusBadge = {
  present: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  missing: 'border-red-500/20 bg-red-500/10 text-red-400',
  partial: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
}

export default function DataRoom() {
  const totalDocs = DOC_CATEGORIES.flatMap(c => c.docs)
  const presentCount = totalDocs.filter(d => d.status === 'present').length
  const missingCount = totalDocs.filter(d => d.status === 'missing').length
  const partialCount = totalDocs.filter(d => d.status === 'partial').length

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader
        title="Data Room (VDR)"
        subtitle="Virtual data room readiness — document audit, gap identification, and buyer preparation"
        action={
          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400">
            {presentCount}/{totalDocs.length} documents ready
          </span>
        }
      />

      {/* VDR Providers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {VDR_PROVIDERS.map(p => (
          <div key={p.name} className={cn('rounded-xl border p-4',
            p.status === 'connected' ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-border bg-card')}>
            <div className="flex items-center justify-between mb-2">
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold',
                p.status === 'connected' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-muted text-muted-foreground')}>
                {p.abbr}
              </div>
              <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase',
                p.status === 'connected' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-border bg-muted/30 text-muted-foreground')}>
                {p.status}
              </span>
            </div>
            <p className="text-sm font-semibold text-card-foreground">{p.name}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{p.description}</p>
          </div>
        ))}
      </div>

      {/* Document readiness stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Documents Present', value: presentCount, color: 'emerald' },
          { label: 'Partially Ready',   value: partialCount, color: 'amber'   },
          { label: 'Missing',           value: missingCount, color: 'red'     },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl border p-4',
            s.color === 'emerald' ? 'border-emerald-500/20 bg-emerald-500/5' :
            s.color === 'amber' ? 'border-amber-500/20 bg-amber-500/5' :
            'border-red-500/20 bg-red-500/5')}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{s.label}</p>
            <p className={cn('text-2xl font-bold',
              s.color === 'emerald' ? 'text-emerald-400' : s.color === 'amber' ? 'text-amber-400' : 'text-red-400')}>
              {s.value}
            </p>
            <div className="h-1 bg-muted rounded-full mt-2">
              <div className={cn('h-1 rounded-full', s.color === 'emerald' ? 'bg-emerald-500' : s.color === 'amber' ? 'bg-amber-500' : 'bg-red-500')}
                style={{ width: `${(s.value / totalDocs.length) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Document categories */}
      <div className="space-y-4">
        {DOC_CATEGORIES.map(cat => (
          <div key={cat.category} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-card-foreground">{cat.category}</p>
              <span className="text-[10px] text-muted-foreground ml-auto">{cat.docs.filter(d => d.status === 'present').length}/{cat.docs.length} ready</span>
            </div>
            <div className="divide-y divide-border">
              {cat.docs.map((doc, i) => {
                const Icon = statusIcon[doc.status]
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <Icon className={cn('w-4 h-4 flex-shrink-0', statusColor[doc.status])} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-card-foreground">{doc.name}</p>
                      <p className="text-[10px] text-muted-foreground">{doc.note}</p>
                    </div>
                    <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase flex-shrink-0', statusBadge[doc.status])}>
                      {doc.status}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
