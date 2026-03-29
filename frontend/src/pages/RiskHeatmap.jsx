/**
 * Risk Heatmap — Page 8 of the demo sequence.
 *
 * Plots every flagged risk from the buyer-questions endpoint on a 2D grid:
 *   X axis: urgency (how far the category score is below threshold)
 *   Y axis: impact (severity — CRITICAL / HIGH / MEDIUM)
 *
 * Data source: /api/analytics/buyer-questions/{company_id}
 * No mock data. Falls back to a loading skeleton while fetching.
 */

import { useState, useEffect } from 'react'
import SectionHeader from '../components/ui/SectionHeader'
import { cn } from '../lib/utils'
import { AlertCircle, AlertTriangle, Info, ShieldAlert } from 'lucide-react'
import { Skeleton } from '../components/ui/Skeleton'
import { useCompanyId } from '../context/CompanyContext'
import { apiClient } from '../lib/apiClient'

const CATEGORY_LABELS = {
  revenue_quality:          'Revenue Quality',
  financial_integrity:      'Financial Integrity',
  operational_independence: 'Operational Independence',
  customer_risk:            'Customer Risk',
  management_team:          'Management & Team',
  growth_drivers:           'Growth Drivers',
}

// Severity → numeric impact (Y axis bucket 0=low, 1=medium, 2=high)
const SEVERITY_RANK = { CRITICAL: 2, HIGH: 1, MEDIUM: 0 }
const SEVERITY_LABELS = ['Medium Impact', 'High Impact', 'Critical Impact']
const SEVERITY_COLORS = {
  CRITICAL: { dot: 'bg-red-500',    border: 'border-red-500/30',    bg: 'bg-red-500/10',    text: 'text-red-400'    },
  HIGH:     { dot: 'bg-amber-500',  border: 'border-amber-500/30',  bg: 'bg-amber-500/10',  text: 'text-amber-400'  },
  MEDIUM:   { dot: 'bg-blue-500',   border: 'border-blue-500/30',   bg: 'bg-blue-500/10',   text: 'text-blue-400'   },
}

const URGENCY_LABELS = ['Monitor', 'Elevated', 'Urgent']

/**
 * Urgency on the X axis: relative exposure vs other categories that have flags.
 * Absolute thresholds (e.g. ≥4 questions) collapse everything into "Urgent" when
 * the API caps the list (~20) and several categories each have many questions.
 */
function buildCategoryUrgencyRanks(catCounts) {
  const pairs = Object.entries(catCounts)
    .filter(([, c]) => c > 0)
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
  const n = pairs.length
  const rankByCategory = {}
  const labelByCategory = {}
  pairs.forEach(([cat], i) => {
    let rank
    if (n <= 1) {
      rank = 2
    } else {
      rank = Math.min(2, Math.floor((3 * i) / n))
    }
    rankByCategory[cat] = rank
    labelByCategory[cat] = URGENCY_LABELS[rank]
  })
  return { rankByCategory, labelByCategory }
}
const CELL_BG = [
  // row 0 (Critical), row 1 (High), row 2 (Medium)  — columns 0-2 (Monitor→Urgent)
  // Formatted as [row][col]
  ['bg-amber-500/5',  'bg-orange-500/10', 'bg-red-500/20'],   // CRITICAL row
  ['bg-blue-500/5',   'bg-amber-500/10',  'bg-orange-500/15'], // HIGH row
  ['bg-muted/20',     'bg-blue-500/5',    'bg-amber-500/10'],  // MEDIUM row
]

function RiskDot({ q }) {
  const [tip, setTip] = useState(false)
  const col = SEVERITY_COLORS[q.severity]
  return (
    <div className="relative inline-block" onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)}>
      <div className={cn('w-2.5 h-2.5 rounded-full cursor-pointer border border-white/20', col.dot)} />
      {tip && (
        <div className="absolute z-50 bottom-4 left-0 w-64 rounded-lg border border-border bg-card shadow-xl p-3 text-[11px] space-y-1">
          <p className={cn('font-bold text-xs', col.text)}>{q.severity} · {q.buyer_type}</p>
          <p className="text-card-foreground leading-relaxed">{q.question}</p>
          <p className="text-muted-foreground">{CATEGORY_LABELS[q.category] ?? q.category}</p>
        </div>
      )}
    </div>
  )
}

export default function RiskHeatmap() {
  const companyId = useCompanyId()
  const companyReady = companyId != null && companyId > 0
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (!companyReady) { setLoading(false); return }
    setLoading(true)
    apiClient.get(`/api/analytics/buyer-questions/${companyId}`)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [companyId, companyReady])

  if (!companyReady) {
    return (
      <div className="space-y-5 max-w-[1400px]">
        <SectionHeader title="Risk Heatmap" subtitle="Select a client in the header to load the risk matrix." />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-5 max-w-[1400px]">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  const questions = data?.questions ?? []
  const criticalCount = questions.filter(q => q.severity === 'CRITICAL').length
  const highCount     = questions.filter(q => q.severity === 'HIGH').length
  const mediumCount   = questions.filter(q => q.severity === 'MEDIUM').length

  // Build per-category counts
  const catCounts = {}
  for (const q of questions) {
    catCounts[q.category] = (catCounts[q.category] ?? 0) + 1
  }

  const { rankByCategory, labelByCategory } = buildCategoryUrgencyRanks(catCounts)

  // Build heatmap cell contents: cells[impactRow 0-2][urgencyCol 0-2] = list of questions
  const cells = { 0: {}, 1: {}, 2: {} }
  for (let r = 0; r <= 2; r++) {
    for (let c = 0; c <= 2; c++) {
      cells[r][c] = []
    }
  }
  for (const q of questions) {
    const row = SEVERITY_RANK[q.severity] ?? 0
    const col = rankByCategory[q.category] ?? 1
    cells[row][col].push(q)
  }

  // Category risk cards
  const catRows = Object.entries(CATEGORY_LABELS).map(([key, label]) => {
    const count = catCounts[key] ?? 0
    const catQs = questions.filter(q => q.category === key)
    const worstSev = catQs.some(q => q.severity === 'CRITICAL') ? 'CRITICAL'
                   : catQs.some(q => q.severity === 'HIGH') ? 'HIGH'
                   : catQs.length > 0 ? 'MEDIUM'
                   : null
    return {
      key,
      label,
      count,
      urgency: count > 0 ? (labelByCategory[key] ?? 'Monitor') : '—',
      worstSev,
    }
  }).sort((a, b) => b.count - a.count)

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader
        title="Risk Heatmap"
        subtitle="Impact = question severity; urgency = relative question density vs other flagged DRS categories (not a fixed count threshold) — hover dots to preview"
        action={
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-red-500/20 bg-red-500/10 text-red-400">
            {criticalCount} critical · {highCount} high · {mediumCount} medium
          </span>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Critical Flags',  count: criticalCount, icon: AlertCircle,   color: 'red',   note: 'Deal-blocking without resolution' },
          { label: 'High Priority',   count: highCount,     icon: AlertTriangle, color: 'amber', note: 'Significant valuation discount risk' },
          { label: 'Monitor / Watch', count: mediumCount,   icon: Info,          color: 'blue',  note: 'Address before buyer Q3 sessions' },
        ].map(({ label, count, icon: Icon, color, note }) => {
          const cls = color === 'red'   ? 'border-red-500/20 bg-red-500/5 text-red-400'
                    : color === 'amber' ? 'border-amber-500/20 bg-amber-500/5 text-amber-400'
                    : 'border-blue-500/20 bg-blue-500/5 text-blue-400'
          return (
            <div key={label} className={cn('rounded-xl border p-4 flex items-center gap-4', cls)}>
              <Icon className="w-6 h-6 opacity-70 flex-shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="text-2xl font-black">{count}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{note}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Heatmap grid */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          Risk Matrix — Impact vs Urgency · hover dots to preview question
        </p>
        <p className="text-[11px] text-muted-foreground mb-4">
          Urgent = categories with the most flagged questions in this view; Monitor = comparatively fewer flags in the same set.
        </p>
        <div className="flex gap-3">
          {/* Y-axis label */}
          <div className="flex flex-col justify-around items-end w-28 flex-shrink-0 pb-8">
            {['Critical', 'High', 'Medium'].map(l => (
              <span key={l} className="text-[11px] font-semibold text-muted-foreground text-right leading-tight">{l} Impact</span>
            ))}
          </div>

          <div className="flex-1 space-y-2">
            {/* Heatmap rows: row 2 = CRITICAL (top), row 0 = MEDIUM (bottom) */}
            {[2, 1, 0].map(impactRow => (
              <div key={impactRow} className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map(urgencyCol => {
                  const cellQs = cells[impactRow][urgencyCol]
                  const bgClass = CELL_BG[2 - impactRow][urgencyCol]
                  return (
                    <div
                      key={urgencyCol}
                      className={cn(
                        'rounded-lg border border-border p-3 min-h-[80px] cursor-pointer transition-all',
                        bgClass,
                        selected === `${impactRow}-${urgencyCol}` && 'ring-1 ring-primary'
                      )}
                      onClick={() => setSelected(selected === `${impactRow}-${urgencyCol}` ? null : `${impactRow}-${urgencyCol}`)}
                    >
                      <div className="flex flex-wrap gap-1">
                        {cellQs.map((q, i) => <RiskDot key={i} q={q} />)}
                      </div>
                      {cellQs.length === 0 && (
                        <span className="text-[11px] text-muted-foreground/30">—</span>
                      )}
                      {cellQs.length > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-2">{cellQs.length} risk{cellQs.length > 1 ? 's' : ''}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}

            {/* X-axis labels */}
            <div className="grid grid-cols-3 gap-2 mt-1">
              {URGENCY_LABELS.map(l => (
                <p key={l} className="text-[11px] font-semibold text-muted-foreground text-center">{l}</p>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground text-center">← Resolution Urgency →</p>
          </div>
        </div>
      </div>

      {/* Selected cell detail panel */}
      {selected && (() => {
        const [r, c] = selected.split('-').map(Number)
        const cellQs = cells[r][c]
        return cellQs.length > 0 ? (
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-semibold text-card-foreground mb-3">
              {SEVERITY_LABELS[r]} × {URGENCY_LABELS[c]} — {cellQs.length} question{cellQs.length > 1 ? 's' : ''}
            </p>
            <div className="space-y-2">
              {cellQs.map(q => {
                const col = SEVERITY_COLORS[q.severity]
                return (
                  <div key={q.id} className={cn('rounded-lg border p-3 text-xs', col.border, col.bg)}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={cn('text-[11px] font-bold uppercase', col.text)}>{q.severity}</span>
                      <span className="text-muted-foreground">{CATEGORY_LABELS[q.category] ?? q.category}</span>
                      <span className="text-muted-foreground">· {q.buyer_type}</span>
                    </div>
                    <p className="text-card-foreground font-medium leading-relaxed">{q.question}</p>
                    <p className="text-muted-foreground mt-1 text-[11px]">Prepare: {q.data_needed}</p>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null
      })()}

      {/* Category risk table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-xs font-semibold text-card-foreground">Risk Exposure by DRS Category</p>
        </div>
        <div className="divide-y divide-border">
          {catRows.map(row => {
            const col = row.worstSev ? SEVERITY_COLORS[row.worstSev] : { text: 'text-muted-foreground', bg: 'bg-muted/20', border: 'border-border', dot: 'bg-muted' }
            const Icon = row.worstSev === 'CRITICAL' ? AlertCircle : row.worstSev === 'HIGH' ? AlertTriangle : Info
            return (
              <div key={row.key} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  {row.worstSev ? <Icon className={cn('w-4 h-4', col.text)} /> : <ShieldAlert className="w-4 h-4 text-emerald-400" />}
                  <div>
                    <p className="text-xs font-medium text-card-foreground">{row.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{row.count} question{row.count !== 1 ? 's' : ''} flagged</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {row.worstSev && (
                    <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded border uppercase', col.border, col.bg, col.text)}>
                      {row.worstSev}
                    </span>
                  )}
                  <span className={cn(
                    'text-[11px] font-semibold px-2 py-0.5 rounded',
                    row.urgency === 'Urgent'   ? 'bg-red-500/10 text-red-400' :
                    row.urgency === 'Elevated' ? 'bg-amber-500/10 text-amber-400' :
                    row.count === 0            ? 'bg-emerald-500/10 text-emerald-400' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {row.count === 0 ? 'No flags' : row.urgency}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
