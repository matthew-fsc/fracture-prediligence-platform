import { useQuery } from '@tanstack/react-query'
import SectionHeader from '../components/ui/SectionHeader'
import { cn } from '../lib/utils'
import { FolderOpen, FileText, CheckCircle, AlertCircle, Clock, HelpCircle, ExternalLink } from 'lucide-react'
import { apiClient } from '../lib/apiClient'
import { useCompanyId } from '../context/CompanyContext'
import PageHeader from '../components/ui/PageHeader'

// ---------------------------------------------------------------------------
// Document category definitions — static checklist every PE buyer expects
// Each entry maps to source_type values from the ingestion pipeline.
// ---------------------------------------------------------------------------
const DOC_CATEGORIES = [
  {
    category: 'Financial',
    docs: [
      { name: 'Income Statement / P&L',      sourceTypes: ['quickbooks_pl', 'pl_statement', 'income_statement'] },
      { name: 'Balance Sheet',               sourceTypes: ['quickbooks_bs', 'balance_sheet'] },
      { name: 'Revenue by Customer',         sourceTypes: ['revenue_by_customer', 'crm_export', 'ar_aging', 'quickbooks_pl'] },
      { name: 'Accounts Receivable Aging',   sourceTypes: ['ar_aging', 'quickbooks_ar'] },
      { name: 'Payroll / Compensation',      sourceTypes: ['payroll', 'gusto_export', 'adp_export'] },
    ],
  },
  {
    category: 'Contracts & Legal',
    docs: [
      { name: 'Customer Contracts / MSAs',   sourceTypes: ['contracts', 'customer_contracts'] },
      { name: 'Employee Agreements',         sourceTypes: ['employee_agreements', 'payroll'] },
      { name: 'Vendor / Supplier Contracts', sourceTypes: ['vendor_contracts'] },
    ],
  },
  {
    category: 'Operations & CRM',
    docs: [
      { name: 'Customer List / CRM Export',  sourceTypes: ['crm_export', 'hubspot_export', 'salesforce_export'] },
      { name: 'Pipeline / Opportunity Data', sourceTypes: ['crm_pipeline', 'crm_export'] },
      { name: 'Headcount / Org Data',        sourceTypes: ['payroll', 'gusto_export', 'adp_export', 'headcount'] },
    ],
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const statusIcon = { present: CheckCircle, missing: AlertCircle, partial: Clock }
const statusColor = { present: 'text-emerald-400', missing: 'text-red-400', partial: 'text-amber-400' }
const statusBadge = {
  present: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  missing: 'border-red-500/20 bg-red-500/10 text-red-400',
  partial: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
}

function deriveDocStatus(sourceTypes, jobs) {
  const matches = jobs.filter(j => sourceTypes.includes(j.source_type))
  if (!matches.length) return { status: 'missing', note: 'Not yet uploaded', filename: null }
  const complete = matches.filter(j => j.status === 'COMPLETE' || j.status === 'complete')
  const failed   = matches.filter(j => j.status === 'FAILED'   || j.status === 'failed')
  const latest   = matches.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
  if (complete.length) {
    const rows = complete.reduce((sum, j) => sum + (j.row_count || 0), 0)
    return { status: 'present', note: `${latest.filename}${rows ? ` — ${rows.toLocaleString()} rows` : ''}`, filename: latest.filename }
  }
  if (failed.length) {
    return { status: 'partial', note: `${latest.filename} — ingestion failed, retry in Data Sources`, filename: latest.filename }
  }
  return { status: 'partial', note: `${latest.filename} — processing…`, filename: latest.filename }
}

// ---------------------------------------------------------------------------
// VDR providers — connection status is static (no live integration yet)
// ---------------------------------------------------------------------------
const VDR_PROVIDERS = [
  { name: 'Datasite',   abbr: 'DS', description: 'Enterprise VDR — M&A focused' },
  { name: 'DealRoom',   abbr: 'DR', description: 'Collaborative deal management' },
  { name: 'Firmex',     abbr: 'FX', description: 'Secure document sharing' },
  { name: 'Intralinks', abbr: 'IL', description: 'Financial services VDR' },
]

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function DataRoom() {
  const companyId = useCompanyId()

  const { data: jobs = [], isLoading, isError } = useQuery({
    queryKey: ['ingestion-jobs', companyId],
    queryFn: () => apiClient.get(`/api/ingestion/jobs/${companyId}?limit=200`),
    enabled: companyId != null && companyId > 0,
    staleTime: 30_000,
  })

  if (!companyId) {
    return (
      <div className="space-y-5 max-w-[1400px]">
        <SectionHeader title="Data Room (VDR)" subtitle="Virtual data room readiness — document audit, gap identification, and buyer preparation" />
        <p className="text-sm text-muted-foreground">Select or create a client to view data room status.</p>
      </div>
    )
  }

  // Derive per-doc status from live ingestion jobs
  const allDocs = DOC_CATEGORIES.flatMap(cat =>
    cat.docs.map(doc => ({ ...doc, ...deriveDocStatus(doc.sourceTypes, jobs) }))
  )
  const presentCount = allDocs.filter(d => d.status === 'present').length
  const partialCount = allDocs.filter(d => d.status === 'partial').length
  const missingCount = allDocs.filter(d => d.status === 'missing').length
  const totalCount   = allDocs.length
  const readinessPct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0
  const badgeColor   = readinessPct >= 75 ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
    : readinessPct >= 40 ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
    : 'border-red-500/20 bg-red-500/10 text-red-400'

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader
        title="Data Room (VDR)"
        subtitle="Virtual data room readiness — document audit, gap identification, and buyer preparation"
        action={
          <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full border', badgeColor)}>
            {presentCount}/{totalCount} documents ready
          </span>
        }
      />

      {isError && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Could not load ingestion jobs — document status may be incomplete.
        </div>
      )}

      {/* Readiness stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Documents Present', value: presentCount, color: 'emerald' },
          { label: 'Partially Ready',   value: partialCount, color: 'amber'   },
          { label: 'Missing',           value: missingCount, color: 'red'     },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl border p-4',
            s.color === 'emerald' ? 'border-emerald-500/20 bg-emerald-500/5'
            : s.color === 'amber' ? 'border-amber-500/20 bg-amber-500/5'
            : 'border-red-500/20 bg-red-500/5')}>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{s.label}</p>
            <p className={cn('text-2xl font-bold',
              s.color === 'emerald' ? 'text-emerald-400' : s.color === 'amber' ? 'text-amber-400' : 'text-red-400')}>
              {s.value}
            </p>
            <div className="h-1 bg-muted rounded-full mt-2 overflow-hidden">
              <div
                className={cn('h-1 rounded-full transition-all', s.color === 'emerald' ? 'bg-emerald-500' : s.color === 'amber' ? 'bg-amber-500' : 'bg-red-500')}
                style={{ width: totalCount > 0 ? `${(s.value / totalCount) * 100}%` : '0%' }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Document categories */}
      <div className="space-y-4">
        {DOC_CATEGORIES.map(cat => {
          const catDocs = cat.docs.map(doc => ({ ...doc, ...deriveDocStatus(doc.sourceTypes, jobs) }))
          const catPresent = catDocs.filter(d => d.status === 'present').length
          return (
            <div key={cat.category} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-card-foreground">{cat.category}</p>
                <span className="text-[11px] text-muted-foreground ml-auto">
                  {isLoading ? 'Loading…' : `${catPresent}/${catDocs.length} ready`}
                </span>
              </div>
              <div className="divide-y divide-border">
                {catDocs.map((doc, i) => {
                  const Icon = statusIcon[doc.status]
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <Icon className={cn('w-4 h-4 flex-shrink-0', statusColor[doc.status])} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-card-foreground">{doc.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{doc.note}</p>
                      </div>
                      <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded border uppercase flex-shrink-0', statusBadge[doc.status])}>
                        {doc.status}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* VDR integrations — future */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">VDR Integrations</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {VDR_PROVIDERS.map(p => (
            <div key={p.name} className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                  {p.abbr}
                </div>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-border bg-muted/30 text-muted-foreground uppercase">
                  soon
                </span>
              </div>
              <p className="text-xs font-semibold text-card-foreground">{p.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{p.description}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground/60 mt-3">
          Native VDR sync coming soon — export your document checklist to Datasite, DealRoom, or Firmex directly from this view.
        </p>
      </div>

      {/* Empty state — no ingestion jobs yet */}
      {!isLoading && jobs.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full border-2 border-dashed border-border flex items-center justify-center mx-auto">
            <FileText className="w-5 h-5 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-semibold text-card-foreground">No files uploaded yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Upload QuickBooks exports, CRM data, payroll, or contracts in Data Sources to populate this checklist.
          </p>
          <a
            href="/Connectors"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            Go to Data Sources <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  )
}
