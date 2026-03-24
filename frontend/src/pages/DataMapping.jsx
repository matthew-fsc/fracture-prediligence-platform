import { useState, useEffect } from 'react'
import { ArrowRight, CheckCircle, AlertCircle } from 'lucide-react'
import SectionHeader from '../components/ui/SectionHeader'
import { cn } from '../lib/utils'

const COMPANY_ID = 1

const ONTOLOGY_FIELDS = [
  'REVENUE_GROSS','REVENUE_TYPE','REVENUE_RECURRING_FLAG','REVENUE_PERIOD','REVENUE_CUSTOMER_ID','REVENUE_DESCRIPTION',
  'CUSTOMER_NAME','CUSTOMER_TENURE_START','CUSTOMER_INDUSTRY','CUSTOMER_IS_ACTIVE','CUSTOMER_OWNER_CONTACT',
  'EMPLOYEE_NAME','EMPLOYEE_ROLE','EMPLOYEE_DEPARTMENT','EMPLOYEE_HIRE_DATE','EMPLOYEE_STATUS','EMPLOYEE_COMP_ANNUAL','EMPLOYEE_IS_OWNER','EMPLOYEE_MANAGEMENT_LEVEL',
  'EXPENSE_AMOUNT','EXPENSE_CATEGORY','EXPENSE_DESCRIPTION','EXPENSE_PERIOD','EXPENSE_VENDOR',
  'CONTRACT_START_DATE','CONTRACT_END_DATE','CONTRACT_ANNUAL_VALUE','CONTRACT_TYPE','CONTRACT_CUSTOMER_ID','CONTRACT_IS_ACTIVE',
  '__EXCLUDE__',
]

function confidenceColor(n) {
  if (n >= 90) return 'text-emerald-400'
  if (n >= 70) return 'text-foreground'
  if (n >= 50) return 'text-amber-400'
  return 'text-red-400'
}

function methodBadge(m) {
  const cfg = {
    exact:           'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
    fuzzy:           'border-blue-500/20 bg-blue-500/10 text-blue-400',
    value_inference: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
    manual:          'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
    unmatched:       'border-red-500/20 bg-red-500/10 text-red-400',
    excluded:        'border-border bg-muted text-muted-foreground',
  }
  return cfg[m] || 'border-border bg-muted text-muted-foreground'
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
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader
        title="Field Mapping"
        subtitle="Review and approve column → ontology field assignments. Override low-confidence mappings before committing."
        action={selected ? (
          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400">
            {autoMapped.length} auto · {reviewRequired.length} review
          </span>
        ) : null}
      />

      {jobs.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          No ingestion jobs found. Upload a file in <a href="/Connectors" className="text-primary">Data Sources</a> first.
        </div>
      )}

      {jobs.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {/* Job selector */}
          <div className="col-span-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Ingestion Jobs</p>
            <div className="space-y-1">
              {jobs.map(job => (
                <button
                  key={job.job_id}
                  onClick={() => loadJob(job.job_id)}
                  className={cn('w-full text-left px-3 py-2.5 rounded-lg border transition-colors',
                    selected?.job_id === job.job_id
                      ? 'border-primary/20 bg-primary/5 text-foreground'
                      : 'border-border hover:bg-muted/30 text-muted-foreground')}
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
                  {[
                    { label: 'Auto-Mapped',   value: autoMapped.length,    total: mappings.length, color: 'emerald' },
                    { label: 'Needs Review',  value: reviewRequired.length, total: mappings.length, color: 'amber'   },
                    { label: 'Total Columns', value: mappings.length,       total: null,            color: 'blue'    },
                  ].map(k => (
                    <div key={k.label} className="rounded-xl border border-border bg-card p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
                      <p className={cn('text-xl font-bold',
                        k.color === 'emerald' ? 'text-emerald-400' : k.color === 'amber' ? 'text-amber-400' : 'text-blue-400')}>
                        {k.value}
                      </p>
                      {k.total && (
                        <div className="h-1 bg-muted rounded-full mt-2">
                          <div className={cn('h-1 rounded-full', k.color === 'emerald' ? 'bg-emerald-500' : k.color === 'amber' ? 'bg-amber-500' : 'bg-blue-500')}
                            style={{ width: `${(k.value / k.total) * 100}%` }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Mappings */}
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <p className="text-xs font-semibold text-card-foreground">Column Mappings — {selected.filename}</p>
                    {Object.keys(overrides).length > 0 && (
                      <button
                        onClick={saveOverrides}
                        disabled={saving}
                        className="text-xs px-3 py-1 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
                      >
                        {saving ? 'Saving...' : saved ? 'Saved!' : `Save ${Object.keys(overrides).length} override${Object.keys(overrides).length > 1 ? 's' : ''}`}
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-border">
                    {mappings.map((m, i) => (
                      <div key={i} className={cn('flex items-center gap-4 px-4 py-3', m.requires_review && 'bg-amber-500/5')}>
                        <span className="text-xs text-muted-foreground font-mono w-40 truncate flex-shrink-0" title={m.source_column}>
                          {m.source_column}
                        </span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
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
                        <span className="text-[10px] text-muted-foreground w-20 text-right flex-shrink-0 capitalize">{m.entity_type ?? '—'}</span>
                        <span className={cn('text-xs font-bold w-10 text-right flex-shrink-0', confidenceColor(m.confidence))}>
                          {m.confidence > 0 ? `${m.confidence}%` : '—'}
                        </span>
                        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0', methodBadge(m.match_method))}>
                          {m.match_method}
                        </span>
                        <div className="w-4 flex-shrink-0">
                          {m.requires_review
                            ? <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                            : <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
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
