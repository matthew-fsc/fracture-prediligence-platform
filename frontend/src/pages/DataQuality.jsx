import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import SectionDivider from '../components/ui/SectionDivider'

const COMPANY_ID = 1

function CheckIcon({ result }) {
  if (result === 'PASS')       return <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
  if (result === 'QUARANTINE') return <XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
  return <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" />
}

export default function DataQuality() {
  const [jobs, setJobs]         = useState([])
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    fetch(`/api/ingestion/jobs/${COMPANY_ID}`)
      .then(r => r.json())
      .then(data => { setJobs(data); if (data.length > 0) loadJob(data[0].job_id) })
      .catch(() => {})
  }, [])

  async function loadJob(id) {
    try {
      const res = await fetch(`/api/ingestion/jobs/${COMPANY_ID}/${id}`)
      setSelected(await res.json())
    } catch {}
  }

  const checks      = selected?.validation?.checks ?? []
  const parseErrors = selected?.errors?.errors ?? []
  const passCount   = checks.filter(c => c.result === 'PASS').length
  const warnCount   = checks.filter(c => c.result === 'WARNING').length
  const failCount   = checks.filter(c => c.result === 'QUARANTINE').length

  return (
    <div>
      <PageHeader
        section="Data Pipeline"
        title="Data Quality"
        subtitle="Validation results, quarantine log, and parse errors per ingestion job"
        badge={selected ? (failCount > 0 ? `${failCount} critical` : warnCount > 0 ? `${warnCount} warnings` : 'Clean') : undefined}
      />

      {jobs.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No ingestion jobs yet. Upload a file in <a href="/Connectors" className="text-primary">Data Sources</a> first.
        </div>
      )}

      {jobs.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {/* Job list */}
          <div>
            <SectionDivider label="Jobs" />
            <div className="space-y-1">
              {jobs.map(job => (
                <button
                  key={job.job_id}
                  onClick={() => loadJob(job.job_id)}
                  className={`w-full text-left px-3 py-2.5 rounded-md transition-colors ${selected?.job_id === job.job_id ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-muted/50 text-muted-foreground'}`}
                >
                  <p className="text-xs font-medium truncate">{job.filename}</p>
                  <p className="text-[10px] opacity-60 mt-0.5">{job.status}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="col-span-3 space-y-4">
            {selected && (
              <>
                {/* Summary KPIs */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'File', value: selected.filename, sub: selected.validation?.detected_format ?? '' },
                    { label: 'Rows', value: selected.row_count ?? '—', sub: `${selected.mapped_count ?? 0} columns mapped` },
                    { label: 'Checks', value: `${passCount}/${checks.length} pass`, sub: `${warnCount} warn · ${failCount} fail` },
                    { label: 'Parse Errors', value: selected.error_count ?? 0, sub: 'row-level' },
                  ].map(k => (
                    <div key={k.label} className="bg-card border border-border rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
                      <p className="text-sm font-bold text-card-foreground truncate">{k.value}</p>
                      <p className="text-[10px] text-muted-foreground">{k.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Validation checks */}
                {checks.length > 0 && (
                  <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-xs font-semibold text-card-foreground">P3 Validation Checks</p>
                    </div>
                    <div className="divide-y divide-border">
                      {checks.map((c, i) => (
                        <div key={i} className="flex items-start gap-3 px-4 py-3">
                          <CheckIcon result={c.result} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-card-foreground">{c.name}</span>
                              <StatusBadge variant={c.result === 'PASS' ? 'adequate' : c.result === 'QUARANTINE' ? 'critical' : 'watch'}>
                                {c.result}
                              </StatusBadge>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{c.message}</p>
                            {c.detail && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{c.detail}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Parse errors */}
                {parseErrors.length > 0 && (
                  <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                      <p className="text-xs font-semibold text-card-foreground">P6 Parse Errors</p>
                      <span className="text-xs text-muted-foreground">{parseErrors.length} errors (showing first 50)</span>
                    </div>
                    <div className="divide-y divide-border max-h-80 overflow-y-auto">
                      {parseErrors.slice(0, 50).map((e, i) => (
                        <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                          <XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-medium text-card-foreground">Row {e.row_index}</span>
                              <span className="text-[10px] font-mono text-muted-foreground">{e.source_column}</span>
                              <StatusBadge variant="high">{e.error_type}</StatusBadge>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{e.message}</p>
                            <p className="text-[10px] font-mono text-muted-foreground/60">Raw: "{e.raw_value}"</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Schema profile */}
                {selected.schema?.columns && (
                  <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-xs font-semibold text-card-foreground">P4 Schema Profile — Column Summary</p>
                    </div>
                    <div className="divide-y divide-border max-h-80 overflow-y-auto">
                      {selected.schema.columns.map((col, i) => (
                        <div key={i} className="flex items-center gap-4 px-4 py-2.5">
                          <span className="text-xs font-mono text-muted-foreground w-36 truncate flex-shrink-0">{col.raw_header}</span>
                          <StatusBadge variant="medium">{col.inferred_type}</StatusBadge>
                          <span className="text-[11px] text-muted-foreground">{(col.null_rate * 100).toFixed(0)}% null</span>
                          <span className="text-[11px] text-muted-foreground">{col.unique_count} unique</span>
                          {col.is_currency && <span className="text-[10px] text-primary">$ currency</span>}
                          <span className="text-[10px] text-muted-foreground flex-1 truncate">
                            {col.sample_values.slice(0, 3).join(' · ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
