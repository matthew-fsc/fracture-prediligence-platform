import { useState, useRef } from 'react'
import { Upload, AlertCircle, FileText, RefreshCw, ChevronRight } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import SectionDivider from '../components/ui/SectionDivider'

const COMPANY_ID = 1

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

function statusVariant(status) {
  return { COMPLETE: 'adequate', AWAITING_REVIEW: 'watch', QUARANTINED: 'critical', FAILED: 'critical' }[status] ?? 'medium'
}

function phaseLabel(phase, status) {
  if (status === 'AWAITING_REVIEW') return 'Awaiting mapping review'
  if (status === 'QUARANTINED')     return 'Quarantined — see validation report'
  if (status === 'FAILED')          return 'Pipeline failed'
  return { P2_EXTRACTION: 'Stored', P3_VALIDATION: 'Validated', P4_PROFILING: 'Profiled',
           P5_MAPPING: 'Mapped', P6_EXTRACTION: 'Extracted — ready for P7+' }[phase] ?? phase
}

export default function Connectors() {
  const [jobs, setJobs]             = useState([])
  const [uploading, setUploading]   = useState(false)
  const [dragOver, setDragOver]     = useState(false)
  const [sourceType, setSourceType] = useState('unknown')
  const [error, setError]           = useState(null)
  const fileRef = useRef()

  async function uploadFile(file) {
    setUploading(true)
    setError(null)
    const form = new FormData()
    form.append('file', file)
    form.append('source_type', sourceType)
    try {
      const res = await fetch(`/api/ingestion/upload/${COMPANY_ID}`, { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.detail || 'Upload failed')
      setJobs(prev => [json, ...prev])
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <PageHeader
        section="Data Pipeline"
        title="Data Sources"
        subtitle="Upload raw files — QuickBooks exports, CRM exports, payroll registers, contracts"
        badge={jobs.length > 0 ? `${jobs.length} files ingested` : 'No files yet'}
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Drop zone */}
        <div className="col-span-2">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) uploadFile(f) }}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/20'}`}
          >
            <input ref={fileRef} type="file" className="hidden" accept=".csv,.xlsx,.xls,.tsv" onChange={e => { const f = e.target.files[0]; if (f) uploadFile(f) }} />
            {uploading
              ? <RefreshCw className="w-8 h-8 text-primary animate-spin mb-3" />
              : <Upload className="w-8 h-8 text-muted-foreground mb-3" />}
            <p className="text-sm font-medium text-card-foreground">
              {uploading ? 'Running pipeline P2–P6...' : 'Drop file here or click to upload'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">CSV · Excel (.xlsx / .xls) · TSV</p>
          </div>
          {error && (
            <div className="mt-2 flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
            </div>
          )}
        </div>

        {/* Source type + pipeline legend */}
        <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-card-foreground">Source Type</p>
          <p className="text-[11px] text-muted-foreground">Declare the source to improve column mapping confidence.</p>
          <select
            value={sourceType}
            onChange={e => setSourceType(e.target.value)}
            className="bg-muted border border-border rounded-md px-3 py-2 text-xs text-card-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {SOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <div className="mt-auto pt-3 border-t border-border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-2">Pipeline Phases</p>
            {['P2 Raw Storage', 'P3 Validation', 'P4 Schema Profiling', 'P5 Column Mapping', 'P6 Row Extraction'].map(p => (
              <div key={p} className="flex items-center gap-1.5 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                <span className="text-[10px] text-muted-foreground">{p}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Jobs list */}
      {jobs.length > 0 && (
        <>
          <SectionDivider label="Ingestion Jobs" />
          <div className="space-y-2">
            {jobs.map((job, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium text-card-foreground flex-1 truncate">{job.filename}</span>
                  <StatusBadge variant={statusVariant(job.status)}>{job.status}</StatusBadge>
                </div>
                <div className="flex items-center gap-5 text-[11px] text-muted-foreground flex-wrap">
                  <span>{job.row_count ?? '—'} rows</span>
                  <span>{job.mapped_count ?? '—'} columns mapped</span>
                  {job.error_count > 0 && <span className="text-warning">{job.error_count} parse errors</span>}
                  <span className="font-mono text-[10px] opacity-60">{job.ingestion_id}</span>
                </div>
                <p className="text-[11px] text-primary mt-1">{phaseLabel(job.phase, job.status)}</p>

                {/* Non-pass validation checks */}
                {job.validation?.checks?.filter(c => c.result !== 'PASS').length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {job.validation.checks.filter(c => c.result !== 'PASS').map((c, ci) => (
                      <span key={ci} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.result === 'QUARANTINE' ? 'bg-destructive/20 text-destructive' : 'bg-warning/20 text-warning'}`}>
                        {c.message}
                      </span>
                    ))}
                  </div>
                )}

                {job.status === 'AWAITING_REVIEW' && (
                  <a href="/DataMapping" className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary font-medium">
                    Review column mappings <ChevronRight className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {jobs.length === 0 && !uploading && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No files ingested yet. Upload a QuickBooks P&amp;L export to start.
        </div>
      )}
    </div>
  )
}
