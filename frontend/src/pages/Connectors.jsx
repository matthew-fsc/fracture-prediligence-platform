import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload, AlertCircle, FileText, RefreshCw, ChevronRight, ChevronDown, ChevronUp, Trash2, RotateCcw, Info, Plug, CheckCircle2, XCircle } from 'lucide-react'
import SectionHeader from '../components/ui/SectionHeader'
import { cn } from '../lib/utils'
import { useCompanyId } from '../context/CompanyContext'
import { apiClient, ApiError } from '../lib/apiClient'
import { toast } from '../lib/notify'

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024 // mirror backend INGESTION_MAX_UPLOAD_BYTES

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

const RUNNING_PHASE_LABELS = {
  P2_EXTRACTION: 'P2 — Raw storage',
  P3_VALIDATION: 'P3 — File validation',
  P4_PROFILING:  'P4 — Schema profiling',
  P5_MAPPING:    'P5 — Column mapping',
  P6_EXTRACTION: 'P6 — Row extraction',
  P7_RULES:      'P7 — Business rules',
  P8_NORMALIZE:  'P8 — Normalization',
  P9_ENTITY_RES: 'P9 — Entity resolution',
  P10_RELATIONS: 'P10 — Relationship mapping',
  P11_COMMIT:    'P11 — Ontology commit',
}

function runningPhaseLabel(phase) {
  return RUNNING_PHASE_LABELS[phase] ?? phase
}

const TERMINAL_STATUSES = ['COMPLETE', 'FAILED', 'QUARANTINED', 'AWAITING_REVIEW']
const POLL_INTERVAL_MS = 1500
const POLL_TIMEOUT_MS = 5 * 60 * 1000

/** Human-readable validation report for FAILED / QUARANTINED jobs. */
function ValidationDetails({ companyId, jobId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['ingestion-job', companyId, jobId],
    queryFn: () => apiClient.get(`/api/ingestion/jobs/${companyId}/${jobId}`),
    staleTime: 30_000,
  })

  if (isLoading) {
    return <p className="mt-3 text-[11px] text-muted-foreground">Loading validation report…</p>
  }

  const validation = data?.validation
  const checks = validation?.checks ?? []
  const resultColor = (result) =>
    result === 'PASS' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
    : result === 'WARNING' ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
    : 'border-red-500/20 bg-red-500/10 text-red-400'

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3 space-y-2">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Validation Report</p>
      {validation?.error && (
        <p className="text-xs text-red-400 break-words">{validation.error}</p>
      )}
      {checks.length > 0 ? (
        <div className="space-y-1.5">
          {checks.map((c, i) => (
            <div key={`${c.name}-${i}`} className="flex items-start gap-2">
              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase flex-shrink-0 mt-0.5', resultColor(c.result))}>
                {c.result}
              </span>
              <div className="min-w-0">
                <p className="text-xs text-card-foreground">
                  <span className="font-mono text-[11px] text-muted-foreground mr-1.5">{c.name}</span>
                  {c.message}
                </p>
                {c.detail && <p className="text-[11px] text-muted-foreground">{c.detail}</p>}
              </div>
            </div>
          ))}
        </div>
      ) : !validation?.error ? (
        <p className="text-xs text-muted-foreground">
          No detailed validation report is available for this job. Try re-running the pipeline or re-uploading the file.
        </p>
      ) : null}
    </div>
  )
}

export default function Connectors() {
  const companyId = useCompanyId()
  const { pathname } = useLocation()
  const isDemo = pathname.startsWith('/demo')

  const qc = useQueryClient()
  const navigate = useNavigate()
  const fieldMappingBase = useSiblingPath('field-mapping')
  const [uploading, setUploading]   = useState(false)
  const [activeJob, setActiveJob]   = useState(null)   // job being polled after upload
  const [dragOver, setDragOver]     = useState(false)
  const [sourceType, setSourceType] = useState('unknown')
  const [error, setError]           = useState(null)
  const [retryingId, setRetryingId] = useState(null)
  const [expandedJobId, setExpandedJobId] = useState(null)
  const [qbFetching, setQbFetching] = useState(false)
  const fileRef = useRef()
  const pollTimerRef = useRef(null)
  const unmountedRef = useRef(false)

  // Clean up the poller (and stop state updates) when the page unmounts.
  useEffect(() => () => {
    unmountedRef.current = true
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
  }, [])

  const companyReady = companyId != null && companyId >= 1

  const { data: qbStatus } = useQuery({
    queryKey: ['qb-status', companyId],
    queryFn: () => apiClient.get(`/api/qb/status/${companyId}`),
    enabled: companyReady && !isDemo,
    staleTime: 60_000,
  })

  async function connectQuickBooks() {
    if (!companyReady) return
    try {
      const { authorize_url } = await apiClient.get(`/api/qb/authorize/${companyId}`)
      // Open OAuth consent page; callback will redirect back to this page
      window.location.href = authorize_url
    } catch (e) {
      toast.error(e.message || 'Could not start QuickBooks connection')
    }
  }

  async function fetchFromQuickBooks() {
    if (!companyReady) return
    setQbFetching(true)
    try {
      const result = await apiClient.post(`/api/qb/fetch/${companyId}`, {})
      await qc.invalidateQueries({ queryKey: ['ingestion-jobs', companyId] })
      const count = result.jobs_created?.length ?? 0
      if (result.errors?.length) {
        toast.warning(`QB sync: ${count} dataset${count !== 1 ? 's' : ''} ingested, ${result.errors.length} failed`)
        result.errors.forEach(e => toast.error(`QB fetch error: ${e}`))
      } else {
        toast.success(`QuickBooks sync complete — ${count} dataset${count !== 1 ? 's' : ''} ingested`)
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        toast.error('No active QuickBooks connection found — reconnect via the Connect QuickBooks button.')
        await qc.invalidateQueries({ queryKey: ['qb-status', companyId] })
      } else {
        toast.error(e.message || 'QuickBooks fetch failed')
      }
    } finally {
      setQbFetching(false)
    }
  }

  async function disconnectQuickBooks() {
    try {
      await apiClient.del(`/api/qb/disconnect/${companyId}`)
      await qc.invalidateQueries({ queryKey: ['qb-status', companyId] })
      toast.success('QuickBooks disconnected')
    } catch (e) {
      toast.error(e.message || 'Disconnect failed')
    }
  }

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

  async function finishPolledJob(job) {
    setUploading(false)
    setActiveJob(null)
    await qc.invalidateQueries({ queryKey: ['ingestion-jobs', companyId] })
    qc.invalidateQueries({ queryKey: ['ingestion-job', companyId, job.job_id] })

    if (job.status === 'COMPLETE') {
      // Committed ontology data changes every analytics output.
      qc.invalidateQueries({
        predicate: q =>
          typeof q.queryKey?.[0] === 'string' &&
          (q.queryKey[0].startsWith('analytics-') || q.queryKey[0] === 'ebitda-recast'),
      })
      toast.success(`Ingestion complete — ${(job.row_count ?? 0).toLocaleString()} rows committed. Analytics now include this data.`)
    } else if (job.status === 'AWAITING_REVIEW') {
      toast('Column mapping needs your review before data is committed.', {
        action: {
          label: 'Review mappings',
          onClick: () => navigate(`${fieldMappingBase}?jobId=${job.job_id}`),
        },
      })
    } else if (job.status === 'QUARANTINED') {
      toast.error('File quarantined during validation — see details below.')
      setExpandedJobId(job.job_id)
    } else if (job.status === 'FAILED') {
      toast.error('Ingestion failed — see details below.')
      setExpandedJobId(job.job_id)
    }
  }

  function pollJob(jobId) {
    const startedAt = Date.now()
    const tick = async () => {
      if (unmountedRef.current) return
      let job = null
      try {
        job = await apiClient.get(`/api/ingestion/jobs/${companyId}/${jobId}`)
      } catch {
        // transient poll failure — keep trying until the safety timeout
      }
      if (unmountedRef.current) return
      if (job) setActiveJob(job)
      if (job && TERMINAL_STATUSES.includes(job.status)) {
        await finishPolledJob(job)
        return
      }
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setUploading(false)
        setActiveJob(null)
        toast.error('Ingestion is taking longer than expected — check the jobs list below for its final status.')
        qc.invalidateQueries({ queryKey: ['ingestion-jobs', companyId] })
        return
      }
      pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS)
    }
    tick()
  }

  async function uploadFile(file) {
    if (!companyReady) {
      toast.error('Select or create a client in the header before uploading.')
      return
    }
    if (demoReadOnly) {
      toast.error('Uploads are disabled in the demo — data is pre-loaded for ABC Company Inc.')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('File is larger than the 25 MB limit.')
      return
    }
    setUploading(true)
    setError(null)
    const form = new FormData()
    form.append('file', file)
    form.append('source_type', sourceType)
    try {
      const job = await apiClient.postMultipart(`/api/ingestion/upload/${companyId}`, form)
      await qc.invalidateQueries({ queryKey: ['ingestion-jobs', companyId] })
      if (job?.job_id != null && !TERMINAL_STATUSES.includes(job.status)) {
        // Pipeline runs in the background — poll until it reaches a terminal state.
        setActiveJob(job)
        pollJob(job.job_id)
      } else if (job?.job_id != null) {
        // Pipeline already finished (e.g. P2 storage failure).
        await finishPolledJob(job)
      } else {
        setUploading(false)
      }
    } catch (e) {
      let msg = e.message || 'Upload failed'
      if (e instanceof ApiError && e.status === 409) {
        msg = `${e.message} Delete the previous job below if you need to re-ingest this file.`
      }
      setError(msg)
      toast.error(msg)
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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


      {/* QuickBooks Direct Connection */}
      {!demoReadOnly && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Plug className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-card-foreground">Connect QuickBooks</p>
              <p className="text-xs text-muted-foreground">Pull P&amp;L, invoices, and customers directly via OAuth — no export needed</p>
            </div>
            {qbStatus?.connected && (
              <span className="ml-auto flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Connected
              </span>
            )}
          </div>

          {qbStatus?.connected ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                <p className="text-xs text-muted-foreground">Realm ID: <span className="font-mono text-card-foreground">{qbStatus.realm_id}</span></p>
                {qbStatus.expires_at && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">Token expires: {new Date(qbStatus.expires_at).toLocaleString()}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={fetchFromQuickBooks}
                  disabled={qbFetching}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
                >
                  {qbFetching ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {qbFetching ? 'Syncing...' : 'Sync Now'}
                </button>
                <button
                  type="button"
                  onClick={disconnectQuickBooks}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/30 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-500/10 transition-colors"
                >
                  <XCircle className="w-3 h-3" /> Disconnect
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={connectQuickBooks}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              <Plug className="w-4 h-4" /> Connect QuickBooks
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold">or upload manually</span>
        <div className="flex-1 h-px bg-border" />
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
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
                  {uploading ? (activeJob ? 'Pipeline running…' : 'Uploading…') : 'Drop file here or click to upload'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">CSV · Excel (.xlsx / .xls) · TSV · max 25 MB</p>
              </div>
              {uploading && activeJob && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2">
                  <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin flex-shrink-0" />
                  <p className="text-xs text-card-foreground truncate">
                    Running <span className="font-semibold">{runningPhaseLabel(activeJob.phase)}</span>…
                  </p>
                </div>
              )}
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
                {(job.status === 'FAILED' || job.status === 'QUARANTINED') && (
                  <button
                    type="button"
                    onClick={() => setExpandedJobId(expandedJobId === job.job_id ? null : job.job_id)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border border-border bg-muted/50 hover:bg-muted text-card-foreground"
                    title="Show validation report"
                  >
                    {expandedJobId === job.job_id
                      ? <ChevronUp className="w-3 h-3" />
                      : <ChevronDown className="w-3 h-3" />}
                    Details
                  </button>
                )}
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
                  className="mt-2 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-400 font-semibold hover:bg-amber-500/20 transition-colors"
                >
                  Review column mappings <ChevronRight className="w-3 h-3" />
                </Link>
              )}
              {(job.status === 'FAILED' || job.status === 'QUARANTINED') && expandedJobId === job.job_id && (
                <ValidationDetails companyId={companyId} jobId={job.job_id} />
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
