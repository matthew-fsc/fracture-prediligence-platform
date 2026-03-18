import { useState, useEffect } from 'react'
import { ArrowRight, CheckCircle, AlertCircle, HelpCircle, ChevronDown } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import SectionDivider from '../components/ui/SectionDivider'
import ProgressBar from '../components/ui/ProgressBar'

const COMPANY_ID = 1

// All ontology fields for the override dropdown
const ONTOLOGY_FIELDS = [
  'REVENUE_GROSS','REVENUE_TYPE','REVENUE_RECURRING_FLAG','REVENUE_PERIOD','REVENUE_CUSTOMER_ID','REVENUE_DESCRIPTION',
  'CUSTOMER_NAME','CUSTOMER_TENURE_START','CUSTOMER_INDUSTRY','CUSTOMER_IS_ACTIVE','CUSTOMER_OWNER_CONTACT',
  'EMPLOYEE_NAME','EMPLOYEE_ROLE','EMPLOYEE_DEPARTMENT','EMPLOYEE_HIRE_DATE','EMPLOYEE_STATUS','EMPLOYEE_COMP_ANNUAL','EMPLOYEE_IS_OWNER','EMPLOYEE_MANAGEMENT_LEVEL',
  'EXPENSE_AMOUNT','EXPENSE_CATEGORY','EXPENSE_DESCRIPTION','EXPENSE_PERIOD','EXPENSE_VENDOR',
  'CONTRACT_START_DATE','CONTRACT_END_DATE','CONTRACT_ANNUAL_VALUE','CONTRACT_TYPE','CONTRACT_CUSTOMER_ID','CONTRACT_IS_ACTIVE',
  '__EXCLUDE__',
]

function confidenceColor(n) {
  if (n >= 90) return 'text-primary'
  if (n >= 70) return 'text-card-foreground'
  if (n >= 50) return 'text-warning'
  return 'text-destructive'
}

function methodVariant(m) {
  return { exact: 'adequate', fuzzy: 'medium', value_inference: 'watch', manual: 'adequate', unmatched: 'high', excluded: 'medium' }[m] ?? 'medium'
}

export default function DataMapping() {
  const [jobs, setJobs]         = useState([])
  const [selected, setSelected] = useState(null)
  const [mappings, setMappings] = useState([])
  const [overrides, setOverrides] = useState({})
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  useEffect(() => {
    fetch(`/api/ingestion/jobs/${COMPANY_ID}`)
      .then(r => r.json())
      .then(data => { setJobs(data); if (data.length > 0) loadJob(data[0].job_id) })
      .catch(() => {})
  }, [])

  async function loadJob(jobId) {
    try {
      const res = await fetch(`/api/ingestion/jobs/${COMPANY_ID}/${jobId}`)
      const job = await res.json()
      setSelected(job)
      setMappings(job.mappings?.mappings ?? [])
    } catch {}
  }

  async function saveOverrides() {
    if (!selected || Object.keys(overrides).length === 0) return
    setSaving(true)
    try {
      await fetch(`/api/ingestion/jobs/${COMPANY_ID}/${selected.job_id}/mappings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overrides),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {}
    setSaving(false)
  }

  const reviewRequired = mappings.filter(m => m.requires_review)
  const autoMapped     = mappings.filter(m => !m.requires_review && m.ontology_field)

  return (
    <div>
      <PageHeader
        section="Data Pipeline"
        title="Field Mapping"
        subtitle="Review and approve column → ontology field assignments. Override low-confidence mappings before committing."
        badge={selected ? `${autoMapped.length} auto · ${reviewRequired.length} review` : undefined}
      />

      {jobs.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No ingestion jobs found. Upload a file in <a href="/Connectors" className="text-primary">Data Sources</a> first.
        </div>
      )}

      {jobs.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {/* Job selector */}
          <div className="col-span-1">
            <SectionDivider label="Ingestion Jobs" />
            <div className="space-y-1">
              {jobs.map(job => (
                <button
                  key={job.job_id}
                  onClick={() => loadJob(job.job_id)}
                  className={`w-full text-left px-3 py-2.5 rounded-md transition-colors ${selected?.job_id === job.job_id ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-muted/50 text-muted-foreground'}`}
                >
                  <p className="text-xs font-medium truncate">{job.filename}</p>
                  <p className="text-[10px] opacity-60 mt-0.5">{job.status} · {job.row_count ?? 0} rows</p>
                </button>
              ))}
            </div>
          </div>

          {/* Mappings table */}
          <div className="col-span-3">
            {selected && (
              <>
                {/* Summary */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-card border border-border rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Auto-Mapped</p>
                    <p className="text-xl font-bold text-primary">{autoMapped.length}</p>
                    <ProgressBar value={autoMapped.length / Math.max(mappings.length, 1) * 100} className="mt-1" />
                  </div>
                  <div className="bg-card border border-border rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Needs Review</p>
                    <p className="text-xl font-bold text-warning">{reviewRequired.length}</p>
                    <ProgressBar value={reviewRequired.length / Math.max(mappings.length, 1) * 100} color="bg-warning" className="mt-1" />
                  </div>
                  <div className="bg-card border border-border rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total Columns</p>
                    <p className="text-xl font-bold text-card-foreground">{mappings.length}</p>
                  </div>
                </div>

                {/* Mappings */}
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <p className="text-xs font-semibold text-card-foreground">Column Mappings — {selected.filename}</p>
                    {Object.keys(overrides).length > 0 && (
                      <button
                        onClick={saveOverrides}
                        disabled={saving}
                        className="text-xs px-3 py-1 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
                      >
                        {saving ? 'Saving...' : saved ? 'Saved!' : `Save ${Object.keys(overrides).length} override${Object.keys(overrides).length > 1 ? 's' : ''}`}
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-border">
                    {mappings.map((m, i) => (
                      <div key={i} className={`flex items-center gap-4 px-4 py-3 ${m.requires_review ? 'bg-warning/5' : ''}`}>
                        {/* Source column */}
                        <span className="text-xs text-muted-foreground font-mono w-40 truncate flex-shrink-0" title={m.source_column}>
                          {m.source_column}
                        </span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        {/* Ontology field / override */}
                        <div className="flex-1 min-w-0">
                          {m.requires_review ? (
                            <select
                              value={overrides[m.source_column] ?? m.ontology_field ?? ''}
                              onChange={e => setOverrides(prev => ({ ...prev, [m.source_column]: e.target.value }))}
                              className="bg-muted border border-border rounded px-2 py-1 text-xs text-card-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full max-w-xs"
                            >
                              <option value="">— unassigned —</option>
                              {ONTOLOGY_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                          ) : (
                            <span className="text-xs font-mono text-primary">{m.ontology_field ?? '—'}</span>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{m.match_detail}</p>
                        </div>
                        {/* Entity */}
                        <span className="text-[10px] text-muted-foreground w-20 text-right flex-shrink-0 capitalize">{m.entity_type ?? '—'}</span>
                        {/* Confidence */}
                        <span className={`text-xs font-bold w-10 text-right flex-shrink-0 ${confidenceColor(m.confidence)}`}>
                          {m.confidence > 0 ? `${m.confidence}%` : '—'}
                        </span>
                        {/* Method badge */}
                        <StatusBadge variant={methodVariant(m.match_method)} className="flex-shrink-0">
                          {m.match_method}
                        </StatusBadge>
                        {/* Review indicator */}
                        <div className="w-4 flex-shrink-0">
                          {m.requires_review
                            ? <AlertCircle className="w-3.5 h-3.5 text-warning" />
                            : <CheckCircle className="w-3.5 h-3.5 text-primary" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
