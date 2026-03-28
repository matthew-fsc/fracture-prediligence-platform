import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import SectionHeader from '../components/ui/SectionHeader'
import { Skeleton } from '../components/ui/Skeleton'
import { cn } from '../lib/utils'
import { useCompanyId } from '../context/CompanyContext'
import { apiClient } from '../lib/apiClient'
import { withCompanyQuery, resolvePath } from '../lib/navLinks'

function CheckIcon({ result }) {
  if (result === 'PASS')       return <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
  if (result === 'QUARANTINE') return <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
  return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
}

export default function DataQuality() {
  const companyId = useCompanyId()
  const [selectedJobId, setSelectedJobId] = useState(null)

  const companyReady = companyId != null && companyId > 0

  const {
    data: jobs = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['ingestion-jobs', companyId],
    queryFn: () => apiClient.get(`/api/ingestion/jobs/${companyId}`),
    enabled: companyReady,
  })

  useEffect(() => {
    if (!jobs.length) {
      setSelectedJobId(null)
      return
    }
    setSelectedJobId((prev) => {
      const ids = jobs.map((j) => j.job_id)
      if (prev && ids.includes(prev)) return prev
      return jobs[0].job_id
    })
  }, [jobs])

  const {
    data: selected,
    isLoading: jobLoading,
  } = useQuery({
    queryKey: ['ingestion-job', companyId, selectedJobId],
    queryFn: () => apiClient.get(`/api/ingestion/jobs/${companyId}/${selectedJobId}`),
    enabled: companyReady && !!selectedJobId,
  })

  const checks      = selected?.validation?.checks ?? []
  const parseErrors = selected?.errors?.errors ?? []
  const passCount   = checks.filter(c => c.result === 'PASS').length
  const warnCount   = checks.filter(c => c.result === 'WARNING').length
  const failCount   = checks.filter(c => c.result === 'QUARANTINE').length

  const { pathname } = useLocation()
  const connectorsPath = withCompanyQuery(resolvePath('/Connectors', pathname), companyId)

  if (!companyReady) {
    return (
      <div className="space-y-5 max-w-[1400px]">
        <SectionHeader
          title="Data Quality"
          subtitle="Validation results, quarantine log, and parse errors per ingestion job"
        />
        <p className="text-sm text-muted-foreground">
          Select or create a client in the header to view data quality for that engagement.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader
        title="Data Quality"
        subtitle="Validation results, quarantine log, and parse errors per ingestion job"
        action={selected ? (
          <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full border',
            failCount > 0 ? 'border-red-500/20 bg-red-500/10 text-red-400' :
            warnCount > 0 ? 'border-amber-500/20 bg-amber-500/10 text-amber-400' :
            'border-emerald-500/20 bg-emerald-500/10 text-emerald-400')}>
            {failCount > 0 ? `${failCount} critical` : warnCount > 0 ? `${warnCount} warnings` : 'Clean'}
          </span>
        ) : null}
      />

      {isError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400 flex items-center justify-between gap-3" role="alert">
          <span>{error?.message || 'Could not load ingestion jobs'}</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-xs font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      )}

      {!isLoading && !isError && jobs.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3">
          <p className="text-muted-foreground text-sm">No ingestion jobs yet.</p>
          <p className="text-xs text-muted-foreground">Upload a file in Data Sources to run validation and profiling.</p>
          <Link
            to={connectorsPath}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Go to Data Sources
          </Link>
        </div>
      )}

      {!isLoading && !isError && jobs.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {/* Job list */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Jobs</p>
            <div className="space-y-1">
              {jobs.map(job => (
                <button
                  key={job.job_id}
                  onClick={() => setSelectedJobId(job.job_id)}
                  className={cn('w-full text-left px-3 py-2.5 rounded-lg border transition-colors',
                    selected?.job_id === job.job_id
                      ? 'border-primary/20 bg-primary/5 text-foreground'
                      : 'border-border hover:bg-muted/30 text-muted-foreground')}
                >
                  <p className="text-xs font-medium truncate">{job.filename}</p>
                  <p className="text-[11px] opacity-60 mt-0.5">{job.status}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="col-span-3 space-y-4">
            {jobLoading && selectedJobId && (
              <div className="space-y-3">
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-40 w-full rounded-xl" />
              </div>
            )}
            {!jobLoading && selected && (
              <>
                {/* Summary KPIs */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'File',         value: selected.filename,                              sub: selected.validation?.detected_format ?? '' },
                    { label: 'Rows',         value: selected.row_count ?? '—',                     sub: `${selected.mapped_count ?? 0} columns mapped` },
                    { label: 'Checks',       value: `${passCount}/${checks.length} pass`,           sub: `${warnCount} warn · ${failCount} fail` },
                    { label: 'Parse Errors', value: selected.error_count ?? 0,                     sub: 'row-level' },
                  ].map(k => (
                    <div key={k.label} className="rounded-xl border border-border bg-card p-3">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
                      <p className="text-sm font-bold text-card-foreground truncate">{k.value}</p>
                      <p className="text-[11px] text-muted-foreground">{k.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Validation checks */}
                {checks.length > 0 && (
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
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
                              <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded border uppercase',
                                c.result === 'PASS' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' :
                                c.result === 'QUARANTINE' ? 'border-red-500/20 bg-red-500/10 text-red-400' :
                                'border-amber-500/20 bg-amber-500/10 text-amber-400')}>
                                {c.result}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{c.message}</p>
                            {c.detail && <p className="text-[11px] text-muted-foreground/60 mt-0.5">{c.detail}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Parse errors */}
                {parseErrors.length > 0 && (
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                      <p className="text-xs font-semibold text-card-foreground">P6 Parse Errors</p>
                      <span className="text-xs text-muted-foreground">{parseErrors.length} errors (showing first 50)</span>
                    </div>
                    <div className="divide-y divide-border max-h-80 overflow-y-auto">
                      {parseErrors.slice(0, 50).map((e, i) => (
                        <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                          <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-medium text-card-foreground">Row {e.row_index}</span>
                              <span className="text-[11px] font-mono text-muted-foreground">{e.source_column}</span>
                              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded border border-red-500/20 bg-red-500/10 text-red-400">{e.error_type}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{e.message}</p>
                            <p className="text-[11px] font-mono text-muted-foreground/60">Raw: "{e.raw_value}"</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Schema profile */}
                {selected.schema?.columns && (
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-xs font-semibold text-card-foreground">P4 Schema Profile — Column Summary</p>
                    </div>
                    <div className="divide-y divide-border max-h-80 overflow-y-auto">
                      {selected.schema.columns.map((col, i) => (
                        <div key={i} className="flex items-center gap-4 px-4 py-2.5">
                          <span className="text-xs font-mono text-muted-foreground w-36 truncate flex-shrink-0">{col.raw_header}</span>
                          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground">{col.inferred_type}</span>
                          <span className="text-[11px] text-muted-foreground">{(col.null_rate * 100).toFixed(0)}% null</span>
                          <span className="text-[11px] text-muted-foreground">{col.unique_count} unique</span>
                          {col.is_currency && <span className="text-[11px] text-primary">$ currency</span>}
                          <span className="text-[11px] text-muted-foreground flex-1 truncate">
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
