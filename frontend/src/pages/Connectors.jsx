import { useState, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload, AlertCircle, FileText, RefreshCw, ChevronRight, Trash2, RotateCcw, Info } from 'lucide-react'
import SectionHeader from '../components/ui/SectionHeader'
import { cn } from '../lib/utils'
import { useCompanyId } from '../context/CompanyContext'
import { apiClient } from '../lib/apiClient'
import { toast } from '../lib/notify'

function useSiblingPath(segment) {
  const { pathname } = useLocation()
  return pathname.replace(/\/[^/]*$/, '') + '/' + segment
}

const SOURCE_TYPES = [
  { value: 'quickbooks_pl',  label: 'QuickBooks — P&L' },
  { value: 'quickbooks_ar',  label: 'QuickBooks — A/R Aging' },
  { value: 'quickbooks_tx',  label: 'QuickBooks — Transaction Detail' },
  { value: 'crm_export',     label: 'CRM Export (HubSpot / Salesforce)' },
  { value: 'payroll',        label: 'Payroll Register' },
  { value: 'customer_list',  label: 'Customer List' },
  { value: 'contract_list',  label: 'Contract List / MSAs' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'unknown',        label: 'Unknown / Other' },
]

function jobNeedsPolling(jobs) {
  if (!Array.isArray(jobs) || jobs.length === 0) return false
  return jobs.some(j =>
    j.status === 'RUNNING' || j.status === 'PENDING' || j.status === 'AWAITING_REVIEW',
  )
}

function phaseLabel(phase, status) {
  if (status === 'AWAITING_REVIEW') return 'Awaiting mapping review'
  if (status === 'QUARANTINED')     return 'Quarantined — see validation report'
  if (status === 'FAILED')          return 'Pipeline failed'
  return { P2_EXTRACTION: 'Stored', P3_VALIDATION: 'Validated', P4_PROFILING: 'Profiled',
           P5_MAPPING: 'Mapped', P6_EXTRACTION: 'Extracted — ready for P7+' }[phase] ?? phase
}

export default function Connectors() {
  const companyId = useCompanyId()
  const { pathname } = useLocation()
  const isDemo = pathname.startsWith('/demo')

  const qc = useQueryClient()
  const fieldMappingBase = useSiblingPath('field-mapping')
  const [uploading, setUploading]   = useState(false)
  const [dragOver, setDragOver]     = useState(false)
  const [sourceType, setSourceType] = useState('unknown')
  const [error, setError]           = useState(null)
  const [retryingId, setRetryingId] = useState(null)
  const fileRef = useRef()

  const companyReady = companyId != null && companyId >= 1

  const {
    data: jobs = [],
    isLoading: jobsLoading,
  } = useQuery({
    queryKey: ['ingestion-jobs', companyId],
    queryFn: () => apiClient.get(`/api/ingestion/jobs/${companyId}`),
    enabled: companyReady,
    refetchInterval: (query) => (jobNeedsPolling(query.state.data) ? 2500 : 8000),
  })

  /** Demo tour: ABC file is pre-seeded server-side; no uploads; no delete. */
  const demoReadOnly = isDemo
  const demoDeleteDisabled = isDemo

  async function uploadFile(file) {
    if (!companyReady) {
      toast.error('Select or create a client in the header before uploading.')
      return
    }
    if (demoReadOnly) {
      toast.error('Uploads are disabled in the demo — data is pre-loaded for ABC Company Inc.')
      return
    }
    setUploading(true)
    setError(null)
    const form = new FormData()
    form.append('file', file)
    form.append('source_type', sourceType)
    try {
      await apiClient.postMultipart(`/api/ingestion/upload/${companyId}`, form)
      await qc.invalidateQueries({ queryKey: ['ingestion-jobs', companyId] })
      toast.success('File uploaded — pipeline finished')
    } catch (e) {
      const msg = e.message || 'Upload failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }

  async function deleteJob(jobId) {
    try {
      await apiClient.del(`/api/ingestion/jobs/${companyId}/${jobId}`)
      await qc.invalidateQueries({ queryKey: ['ingestion-jobs', companyId] })
    } catch (e) {
      toast.error('Could not delete job')
    }
  }

  async function retryJob(jobId) {
    setRetryingId(jobId)
    try {
      await apiClient.post(`/api/ingestion/jobs/${companyId}/${jobId}/retry`, {})
      await qc.invalidateQueries({ queryKey: ['ingestion-jobs', companyId] })
      await qc.invalidateQueries({ queryKey: ['ingestion-job', companyId, jobId] })
      toast.success('Pipeline re-run started')
    } catch (e) {
      toast.error(e.message || 'Retry failed')
    } finally {
      setRetryingId(null)
    }
  }

  const totalRecords = jobs.reduce((s, j) => s + (j.row_count ?? 0), 0)
  const completeJobs = jobs.filter(j => j.status === 'COMPLETE').length
  const pipelineStatus = jobs.length === 0
    ? 'No uploads yet'
    : jobs.some(j => j.status === 'FAILED') ? 'Has errors'
    : jobs.some(j => j.status === 'AWAITING_REVIEW') ? 'Needs review'
    : 'Processing'
  const pipelineColor = jobs.length === 0 || jobs.some(j => j.status === 'FAILED') ? 'red'
    : jobs.some(j => j.status === 'AWAITING_REVIEW') ? 'amber'
    : 'emerald'

  return (
    <div className="space-y-5 max-w-[1400px]">
      {isDemo && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 flex gap-3 items-start">
          <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-card-foreground space-y-1">
            <p className="font-medium">Demo mode — ABC Company Inc.</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              QuickBooks P&amp;L sample is pre-loaded for this client. Uploads are turned off so the tour stays read-only.
            </p>
          </div>
        </div>
      )}

      <SectionHeader
        title="Data Sources"
        subtitle={
          isDemo
            ? 'Demo: pre-loaded QuickBooks-style P&L for ABC Company Inc. (full product supports uploads)'
            : 'Upload raw files — QuickBooks exports, CRM exports, payroll registers, contracts'
        }
        action={
          demoReadOnly ? null : (
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <Upload className="w-3.5 h-3.5" /> Upload CSV
            </button>
          )
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Files Uploaded</p>
          <p className="text-xl font-bold text-blue-400">{jobsLoading ? '—' : jobs.length}</p>
          <p className="text-[11px] text-muted-foreground">{completeJobs} complete</p>
        </div>
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total Records</p>
          <p className="text-xl font-bold text-blue-400">{jobsLoading ? '—' : totalRecords.toLocaleString()}</p>
          <p className="text-[11px] text-muted-foreground">across all uploads</p>
        </div>
        <div className={cn('rounded-xl border p-4',
          pipelineColor === 'emerald' ? 'border-emerald-500/20 bg-emerald-500/5'
          : pipelineColor === 'amber' ? 'border-amber-500/20 bg-amber-500/5'
          : 'border-red-500/20 bg-red-500/5')}>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Pipeline Status</p>
          <p className={cn('text-xl font-bold',
            pipelineColor === 'emerald' ? 'text-emerald-400'
            : pipelineColor === 'amber' ? 'text-amber-400'
            : 'text-red-400')}>{pipelineStatus}</p>
          <p className="text-[11px] text-muted-foreground">{jobs.length} job{jobs.length !== 1 ? 's' : ''} total</p>
        </div>
      </div>


      {/* Upload area — full uploader only outside demo */}
      {demoReadOnly ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold text-card-foreground mb-2">Pre-loaded source file</p>
          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
            The demo includes a completed QuickBooks P&amp;L export for <span className="text-card-foreground font-medium">ABC Company Inc.</span> No
            manual upload is required.
          </p>
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold mb-2">Pipeline Phases</p>
            {['P2 Raw Storage', 'P3 Validation', 'P4 Schema Profiling', 'P5 Column Mapping', 'P6 Row Extraction'].map(p => (
              <div key={p} className="flex items-center gap-1.5 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                <span className="text-[11px] text-muted-foreground">{p}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold text-card-foreground mb-4">Manual CSV Upload</p>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault()
                  setDragOver(false)
                  const f = e.dataTransfer.files[0]
                  if (f) uploadFile(f)
                }}
                onClick={() => fileRef.current?.click()}
                className={cn('border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-colors',
                  dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/20')}
              >
                <input ref={fileRef} type="file" className="hidden" accept=".csv,.xlsx,.xls,.tsv"
                  onChange={e => { const f = e.target.files[0]; if (f) uploadFile(f) }} />
                {uploading
                  ? <RefreshCw className="w-8 h-8 text-primary animate-spin mb-3" />
                  : <Upload className="w-8 h-8 text-muted-foreground mb-3" />}
                <p className="text-sm font-medium text-card-foreground">
                  {uploading ? 'Running pipeline P2–P11...' : 'Drop file here or click to upload'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">CSV · Excel (.xlsx / .xls) · TSV</p>
              </div>
              {error && (
                <div className="mt-2 flex items-center gap-2 text-xs text-red-400">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-4 flex flex-col gap-3">
              <p className="text-xs font-semibold text-card-foreground">Source Type</p>
              <select
                value={sourceType}
                onChange={e => setSourceType(e.target.value)}
                className="bg-muted border border-border rounded-md px-3 py-2 text-xs text-card-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {SOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <div className="mt-auto pt-3 border-t border-border">
                <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold mb-2">Pipeline Phases</p>
                {['P2 Raw Storage', 'P3 Validation', 'P4 Schema Profiling', 'P5 Column Mapping', 'P6 Row Extraction'].map(p => (
                  <div key={p} className="flex items-center gap-1.5 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                    <span className="text-[11px] text-muted-foreground">{p}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Jobs list */}
      {jobs.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Ingestion Jobs</p>
          {jobs.map(job => (
            <div key={job.job_id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium text-card-foreground flex-1 truncate">{job.filename}</span>
                <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded border uppercase',
                  job.status === 'COMPLETE' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' :
                  job.status === 'AWAITING_REVIEW' ? 'border-amber-500/20 bg-amber-500/10 text-amber-400' :
                  'border-red-500/20 bg-red-500/10 text-red-400')}>
                  {job.status}
                </span>
                {(job.status === 'FAILED' || job.status === 'QUARANTINED') && !demoReadOnly && (
                  <button
                    type="button"
                    onClick={() => retryJob(job.job_id)}
                    disabled={retryingId === job.job_id}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border border-border bg-muted/50 hover:bg-muted text-card-foreground disabled:opacity-50"
                    title="Re-run pipeline from stored file"
                  >
                    {retryingId === job.job_id
                      ? <RefreshCw className="w-3 h-3 animate-spin" />
                      : <RotateCcw className="w-3 h-3" />}
                    Retry
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => deleteJob(job.job_id)}
                  disabled={demoDeleteDisabled}
                  className="p-1 rounded text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-25 disabled:pointer-events-none disabled:hover:text-muted-foreground/40"
                  title={demoDeleteDisabled ? 'Removing jobs is disabled in demo mode' : 'Delete job'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-5 text-[11px] text-muted-foreground flex-wrap">
                <span>{job.row_count ?? '—'} rows</span>
                <span>{job.mapped_count ?? '—'} columns mapped</span>
                {job.error_count > 0 && <span className="text-amber-400">{job.error_count} parse errors</span>}
                <span className="font-mono text-[11px] opacity-60">{job.ingestion_id}</span>
              </div>
              <p className="text-[11px] text-primary mt-1">{phaseLabel(job.phase, job.status)}</p>
              {job.status === 'AWAITING_REVIEW' && (
                <Link
                  to={`${fieldMappingBase}?jobId=${job.job_id}`}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary font-medium"
                >
                  Review column mappings <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {jobs.length === 0 && !uploading && !jobsLoading && (
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3">
          <p className="text-muted-foreground text-sm">No ingestion jobs yet.</p>
          <p className="text-xs text-muted-foreground">
            {isDemo
              ? 'The demo API should pre-load a QuickBooks P&L job for ABC Company Inc. Restart the backend or run the seed script if this stays empty.'
              : 'Upload a QuickBooks P&L export or other CSV above to start the pipeline.'}
          </p>
          {!demoReadOnly && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Upload a file
            </button>
          )}
        </div>
      )}
    </div>
  )
}
