import { useState, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Upload, AlertCircle, FileText, RefreshCw, ChevronRight, CheckCircle, Circle, Database } from 'lucide-react'
import SectionHeader from '../components/ui/SectionHeader'
import { cn } from '../lib/utils'
import { useCompanyId } from '../context/CompanyContext'
import { apiUrl } from '../lib/apiClient'

function useSiblingPath(segment) {
  const { pathname } = useLocation()
  // Replace the last path segment (or append if at demo root)
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

const MOCK_CONNECTORS = [
  { type: 'quickbooks', name: 'QuickBooks Online', category: 'accounting', status: 'connected', records: 1917, lastSync: '1h ago', icon: '📊' },
  { type: 'gusto',      name: 'Gusto Payroll',     category: 'payroll',    status: 'connected', records: 379,  lastSync: '1h ago', icon: '👥' },
  { type: 'hubspot',    name: 'HubSpot CRM',       category: 'crm',        status: 'connected', records: 31,   lastSync: '1h ago', icon: '🔗' },
  { type: 'plaid',      name: 'Plaid Banking',     category: 'banking',    status: 'available', records: 0,    lastSync: null,     icon: '🏦' },
  { type: 'xero',       name: 'Xero',              category: 'accounting', status: 'available', records: 0,    lastSync: null,     icon: '📋' },
  { type: 'salesforce', name: 'Salesforce',        category: 'crm',        status: 'available', records: 0,    lastSync: null,     icon: '☁️' },
]

const CATEGORIES = ['all', 'accounting', 'payroll', 'crm', 'banking']

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
  const companyId = useCompanyId()
  const fieldMappingPath = useSiblingPath('field-mapping')
  const [jobs, setJobs]             = useState([])
  const [uploading, setUploading]   = useState(false)
  const [dragOver, setDragOver]     = useState(false)
  const [sourceType, setSourceType] = useState('unknown')
  const [error, setError]           = useState(null)
  const [activeCategory, setActiveCategory] = useState('all')
  const fileRef = useRef()

  async function uploadFile(file) {
    setUploading(true)
    setError(null)
    const form = new FormData()
    form.append('file', file)
    form.append('source_type', sourceType)
    try {
      const res = await fetch(apiUrl(`/api/ingestion/upload/${companyId}`), { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.detail || 'Upload failed')
      setJobs(prev => [json, ...prev])
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  const connectedCount = MOCK_CONNECTORS.filter(c => c.status === 'connected').length
  const totalRecords = MOCK_CONNECTORS.reduce((s, c) => s + c.records, 0)
  const filtered = activeCategory === 'all' ? MOCK_CONNECTORS : MOCK_CONNECTORS.filter(c => c.category === activeCategory)

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader
        title="Data Sources"
        subtitle="Upload raw files — QuickBooks exports, CRM exports, payroll registers, contracts"
        action={
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Upload CSV
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Connected Sources', value: `${connectedCount}`, sub: 'of 6 available', color: 'emerald' },
          { label: 'Total Records',     value: totalRecords.toLocaleString(), sub: 'ingested & mapped', color: 'blue' },
          { label: 'Pipeline Status',   value: 'Healthy', sub: 'last sync 1h ago', color: 'emerald' },
        ].map(c => (
          <div key={c.label} className={cn('rounded-xl border p-4',
            c.color === 'emerald' ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-blue-500/20 bg-blue-500/5')}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{c.label}</p>
            <p className={cn('text-xl font-bold', c.color === 'emerald' ? 'text-emerald-400' : 'text-blue-400')}>{c.value}</p>
            <p className="text-[10px] text-muted-foreground">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2">
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={cn('text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors capitalize',
              activeCategory === cat ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/30')}>
            {cat}
          </button>
        ))}
      </div>

      {/* Connector grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {filtered.map(c => (
          <div key={c.type} className={cn('rounded-xl border bg-card p-4',
            c.status === 'connected' ? 'border-emerald-500/20' : 'border-border')}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{c.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-card-foreground">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{c.category}</p>
                </div>
              </div>
              <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase',
                c.status === 'connected' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-border bg-muted text-muted-foreground')}>
                {c.status}
              </span>
            </div>
            {c.status === 'connected' ? (
              <div className="space-y-1 text-[11px] text-muted-foreground">
                <div className="flex justify-between">
                  <span>Records</span>
                  <span className="font-semibold text-card-foreground">{c.records.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last sync</span>
                  <span className="font-semibold text-emerald-400">{c.lastSync}</span>
                </div>
              </div>
            ) : (
              <button className="w-full text-xs text-center py-1.5 rounded-lg border border-border hover:bg-muted/30 transition-colors text-muted-foreground">
                Connect
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Upload area */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-semibold text-card-foreground mb-4">Manual CSV Upload</p>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) uploadFile(f) }}
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
                {uploading ? 'Running pipeline P2–P6...' : 'Drop file here or click to upload'}
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
      </div>

      {/* Jobs list */}
      {jobs.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Ingestion Jobs</p>
          {jobs.map((job, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium text-card-foreground flex-1 truncate">{job.filename}</span>
                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase',
                  job.status === 'COMPLETE' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' :
                  job.status === 'AWAITING_REVIEW' ? 'border-amber-500/20 bg-amber-500/10 text-amber-400' :
                  'border-red-500/20 bg-red-500/10 text-red-400')}>
                  {job.status}
                </span>
              </div>
              <div className="flex items-center gap-5 text-[11px] text-muted-foreground flex-wrap">
                <span>{job.row_count ?? '—'} rows</span>
                <span>{job.mapped_count ?? '—'} columns mapped</span>
                {job.error_count > 0 && <span className="text-amber-400">{job.error_count} parse errors</span>}
                <span className="font-mono text-[10px] opacity-60">{job.ingestion_id}</span>
              </div>
              <p className="text-[11px] text-primary mt-1">{phaseLabel(job.phase, job.status)}</p>
              {job.status === 'AWAITING_REVIEW' && (
                <Link to={fieldMappingPath} className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary font-medium">
                  Review column mappings <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {jobs.length === 0 && !uploading && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No files ingested yet. Upload a QuickBooks P&amp;L export to start.
        </div>
      )}
    </div>
  )
}
