import { useState, useEffect } from 'react'
import { AlertCircle, AlertTriangle, Info, FileText } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import SectionDivider from '../components/ui/SectionDivider'

const COMPANY_ID = 1

const CATEGORY_LABELS = {
  revenue_quality:          'Revenue Quality',
  financial_integrity:      'Financial Integrity',
  operational_independence: 'Operational Independence',
  customer_risk:            'Customer Risk',
  management_team:          'Management & Team',
  growth_drivers:           'Growth Drivers',
}

const BUYER_COLORS = {
  PE:         'bg-primary/10 text-primary border border-primary/20',
  Strategic:  'bg-chart-2/10 text-chart-2 border border-chart-2/20',
  Financial:  'bg-warning/10 text-warning border border-warning/20',
  All:        'bg-muted text-muted-foreground border border-border',
}

function SeverityIcon({ severity }) {
  if (severity === 'CRITICAL') return <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
  if (severity === 'HIGH')     return <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" />
  return <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
}

function severityVariant(s) {
  return { CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'watch' }[s] ?? 'medium'
}

export default function BuyerLens() {
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [filterCat, setFilterCat] = useState('all')
  const [filterSev, setFilterSev] = useState('all')

  useEffect(() => {
    fetch(`/api/analytics/buyer-questions/${COMPANY_ID}`)
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const questions = (data?.questions ?? []).filter(q => {
    if (filterCat !== 'all' && q.category !== filterCat) return false
    if (filterSev !== 'all' && q.severity !== filterSev) return false
    return true
  })

  const criticalCount = (data?.questions ?? []).filter(q => q.severity === 'CRITICAL').length
  const highCount     = (data?.questions ?? []).filter(q => q.severity === 'HIGH').length

  return (
    <div>
      <PageHeader
        section="Intelligence"
        title="Buyer Lens"
        subtitle="Simulated due diligence questions a buyer would raise — prioritized by DRS weakness"
        badge={data ? `${data.total} questions` : undefined}
      />

      {loading && <div className="text-center py-16 text-muted-foreground text-sm">Generating questions…</div>}
      {error && <div className="text-center py-12 text-sm text-destructive">{error}</div>}

      {data && (
        <div className="space-y-4">
          {/* Summary KPIs */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Critical</p>
              <p className="text-2xl font-black text-destructive">{criticalCount}</p>
              <p className="text-[11px] text-muted-foreground">Must-answer for any deal</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">High Priority</p>
              <p className="text-2xl font-black text-warning">{highCount}</p>
              <p className="text-[11px] text-muted-foreground">Significant deal risk</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total</p>
              <p className="text-2xl font-black text-card-foreground">{data.total}</p>
              <p className="text-[11px] text-muted-foreground">Questions generated</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
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
            <select
              value={filterSev}
              onChange={e => setFilterSev(e.target.value)}
              className="bg-muted border border-border rounded-md px-3 py-1.5 text-xs text-card-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
            </select>
            <span className="text-[11px] text-muted-foreground ml-auto">{questions.length} showing</span>
          </div>

          {/* Question list */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="divide-y divide-border">
              {questions.map(q => (
                <div key={q.id} className="flex items-start gap-3 px-4 py-3.5">
                  <SeverityIcon severity={q.severity} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <StatusBadge variant={severityVariant(q.severity)}>{q.severity}</StatusBadge>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${BUYER_COLORS[q.buyer_type]}`}>
                        {q.buyer_type}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{CATEGORY_LABELS[q.category]}</span>
                    </div>
                    <p className="text-xs text-card-foreground font-medium leading-relaxed">{q.question}</p>
                    <div className="flex items-start gap-1.5 mt-1.5">
                      <FileText className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-muted-foreground">{q.data_needed}</p>
                    </div>
                  </div>
                </div>
              ))}
              {questions.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No questions match the current filters.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
