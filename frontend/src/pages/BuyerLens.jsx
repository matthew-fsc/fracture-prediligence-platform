import { useState, useEffect } from 'react'
import { AlertCircle, AlertTriangle, Info, FileText } from 'lucide-react'
import SectionHeader from '../components/ui/SectionHeader'
import { cn } from '../lib/utils'
import { Skeleton } from '../components/ui/Skeleton'
import { useCompanyId } from '../context/CompanyContext'
import { apiUrl } from '../lib/apiClient'

const CATEGORY_LABELS = {
  revenue_quality:          'Revenue Quality',
  financial_integrity:      'Financial Integrity',
  operational_independence: 'Operational Independence',
  customer_risk:            'Customer Risk',
  management_team:          'Management & Team',
  growth_drivers:           'Growth Drivers',
}

const CATEGORIES = ['all', ...Object.keys(CATEGORY_LABELS)]
const SEVERITIES = ['all', 'CRITICAL', 'HIGH', 'MEDIUM']

function SeverityIcon({ severity }) {
  if (severity === 'CRITICAL') return <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
  if (severity === 'HIGH')     return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
  return <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
}

function severityBadge(s) {
  if (s === 'CRITICAL') return 'border-red-500/20 bg-red-500/10 text-red-400'
  if (s === 'HIGH')     return 'border-amber-500/20 bg-amber-500/10 text-amber-400'
  return 'border-border bg-muted text-muted-foreground'
}

function buyerBadge(t) {
  if (t === 'PE')        return 'border-primary/20 bg-primary/10 text-primary'
  if (t === 'Strategic') return 'border-blue-500/20 bg-blue-500/10 text-blue-400'
  if (t === 'Financial') return 'border-purple-500/20 bg-purple-500/10 text-purple-400'
  return 'border-border bg-muted text-muted-foreground'
}

export default function BuyerLens() {
  const companyId = useCompanyId()
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [filterCat, setFilterCat] = useState('all')
  const [filterSev, setFilterSev] = useState('all')

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(apiUrl(`/api/analytics/buyer-questions/${companyId}`))
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [companyId])

  const questions = (data?.questions ?? []).filter(q => {
    if (filterCat !== 'all' && q.category !== filterCat) return false
    if (filterSev !== 'all' && q.severity !== filterSev) return false
    return true
  })

  const criticalCount = (data?.questions ?? []).filter(q => q.severity === 'CRITICAL').length
  const highCount     = (data?.questions ?? []).filter(q => q.severity === 'HIGH').length

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader
        title="Buyer Risk Profile"
        subtitle="Simulated due diligence questions a buyer would raise — prioritized by DRS weakness"
        action={data ? (
          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-border bg-muted text-muted-foreground">
            {data.total} questions
          </span>
        ) : null}
      />

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex gap-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-20" /></div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center text-sm text-red-400">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Critical</p>
              <p className="text-3xl font-black text-red-400">{criticalCount}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Must-answer for any deal</p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">High Priority</p>
              <p className="text-3xl font-black text-amber-400">{highCount}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Significant deal risk</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total</p>
              <p className="text-3xl font-black text-card-foreground">{data.total}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Questions generated</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              {SEVERITIES.map(s => (
                <button
                  key={s}
                  onClick={() => setFilterSev(s)}
                  className={cn(
                    'text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors',
                    filterSev === s
                      ? s === 'CRITICAL' ? 'border-red-500/20 bg-red-500/10 text-red-400'
                        : s === 'HIGH'   ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                        : s === 'MEDIUM' ? 'border-border bg-muted text-foreground'
                        : 'border-primary/20 bg-primary/10 text-primary'
                      : 'border-border bg-transparent text-muted-foreground hover:bg-muted/30'
                  )}
                >
                  {s === 'all' ? 'All Severities' : s}
                </button>
              ))}
            </div>
            <div className="w-px h-4 bg-border mx-1" />
            <select
              value={filterCat}
              onChange={e => setFilterCat(e.target.value)}
              className="bg-muted border border-border rounded-md px-3 py-1.5 text-xs text-card-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <span className="text-[11px] text-muted-foreground ml-auto">{questions.length} showing</span>
          </div>

          {/* Question list */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="divide-y divide-border">
              {questions.map(q => (
                <div key={q.id} className={cn(
                  'flex items-start gap-3 px-4 py-3.5',
                  q.severity === 'CRITICAL' && 'bg-red-500/5',
                  q.severity === 'HIGH' && 'bg-amber-500/5',
                )}>
                  <SeverityIcon severity={q.severity} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase', severityBadge(q.severity))}>
                        {q.severity}
                      </span>
                      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border', buyerBadge(q.buyer_type))}>
                        {q.buyer_type}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{CATEGORY_LABELS[q.category] ?? q.category}</span>
                    </div>
                    <p className="text-xs font-medium text-card-foreground leading-relaxed">{q.question}</p>
                    <div className="flex items-start gap-1.5 mt-1.5">
                      <FileText className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-muted-foreground">{q.data_needed}</p>
                    </div>
                  </div>
                </div>
              ))}
              {questions.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No questions match the current filters.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
