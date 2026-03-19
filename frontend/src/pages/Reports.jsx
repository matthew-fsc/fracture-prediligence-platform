import { useState, useEffect } from 'react'
import { FileText, Download, RefreshCw, CheckCircle } from 'lucide-react'
import SectionHeader from '../components/ui/SectionHeader'
import { cn } from '../lib/utils'
import { fmtM } from '../lib/utils'

const COMPANY_ID = 1

const REPORT_TEMPLATES = [
  {
    id: 'drs_summary',
    title: 'Diligence Readiness Summary',
    description: '2-page executive-ready format with DRS score, category breakdown, and top risks.',
    sections: ['DRS Score & Tier', 'Category Scores', 'Top 5 Risks', 'Immediate Action Items'],
    status: 'ready',
    color: 'primary',
  },
  {
    id: 'value_gap',
    title: 'Value Gap Report',
    description: 'Current vs. potential enterprise value with ranked value-creation initiatives.',
    sections: ['EV Range', 'Gap Analysis by Category', 'Initiative Roadmap', 'DRS Sensitivity'],
    status: 'ready',
    color: 'emerald',
  },
  {
    id: 'buyer_prep',
    title: 'Buyer Preparation Package',
    description: 'Anticipated due diligence questions with data needed for each response.',
    sections: ['Critical Questions', 'Financial Data Checklist', 'Operational Documentation', 'Management Bios'],
    status: 'ready',
    color: 'blue',
  },
  {
    id: 'ebitda_recast',
    title: 'EBITDA Recast Schedule',
    description: 'Normalized EBITDA with each add-back itemized and documented.',
    sections: ['Reported P&L', 'Owner Add-backs', 'One-time Items', 'Defensible EBITDA'],
    status: 'partial',
    color: 'amber',
  },
  {
    id: 'company_profile',
    title: 'Company Profile Teaser',
    description: 'Investor-ready 1-page company overview with key metrics and highlights.',
    sections: ['Business Overview', 'Financial Highlights', 'Team Summary', 'Growth Story'],
    status: 'partial',
    color: 'purple',
  },
]

const colorMap = {
  primary: { border: 'border-primary/20', bg: 'bg-primary/5', icon: 'bg-primary/10 text-primary' },
  emerald: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', icon: 'bg-emerald-500/10 text-emerald-400' },
  blue:    { border: 'border-blue-500/20', bg: 'bg-blue-500/5', icon: 'bg-blue-500/10 text-blue-400' },
  amber:   { border: 'border-amber-500/20', bg: 'bg-amber-500/5', icon: 'bg-amber-500/10 text-amber-400' },
  purple:  { border: 'border-purple-500/20', bg: 'bg-purple-500/5', icon: 'bg-purple-500/10 text-purple-400' },
}

export default function Reports() {
  const [generating, setGenerating] = useState(null)
  const [generated, setGenerated]   = useState({})
  const [scoreData, setScoreData]   = useState(null)

  useEffect(() => {
    fetch(`/api/analytics/scores/${COMPANY_ID}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setScoreData(d))
      .catch(() => {})
  }, [])

  async function generateReport(templateId) {
    setGenerating(templateId)
    await new Promise(r => setTimeout(r, 1500))
    setGenerated(prev => ({ ...prev, [templateId]: true }))
    setGenerating(null)
  }

  const readyReports = REPORT_TEMPLATES.filter(t => t.status === 'ready')
  const partialReports = REPORT_TEMPLATES.filter(t => t.status === 'partial')

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader
        title="Reports"
        subtitle="Generate and export advisory deliverables in advisor-ready format"
        action={scoreData ? (
          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
            DRS {scoreData.drs?.base}/100
          </span>
        ) : null}
      />

      {/* Stats row */}
      {scoreData && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'DRS Score',     value: `${scoreData.drs?.base}/100`,                                            color: 'emerald' },
            { label: 'EV Midpoint',   value: scoreData.enterprise_value ? fmtM(scoreData.enterprise_value.midpoint) : '—', color: 'blue' },
            { label: 'DRS Tier',      value: scoreData.drs?.tier ?? '—',                                              color: 'primary' },
            { label: 'Reports Ready', value: `${Object.keys(generated).length}/${REPORT_TEMPLATES.length}`,           color: 'amber'  },
          ].map(k => (
            <div key={k.label} className={cn('rounded-xl border p-3',
              k.color === 'emerald' ? 'border-emerald-500/20 bg-emerald-500/5' :
              k.color === 'blue' ? 'border-blue-500/20 bg-blue-500/5' :
              k.color === 'amber' ? 'border-amber-500/20 bg-amber-500/5' :
              'border-primary/20 bg-primary/5')}>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
              <p className={cn('text-sm font-bold truncate',
                k.color === 'emerald' ? 'text-emerald-400' : k.color === 'blue' ? 'text-blue-400' :
                k.color === 'amber' ? 'text-amber-400' : 'text-primary')}>
                {k.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Available reports */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Available Reports</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {readyReports.map(t => {
            const cl = colorMap[t.color] || colorMap.primary
            return (
              <div key={t.id} className={cn('rounded-xl border p-4', cl.border, cl.bg)}>
                <div className="flex items-start gap-3 mb-3">
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', cl.icon)}>
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-xs font-semibold text-card-foreground">{t.title}</p>
                      {generated[t.id] && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{t.description}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {t.sections.map(s => (
                    <span key={s} className="text-[9px] px-1.5 py-0.5 bg-muted/50 rounded text-muted-foreground border border-border/50">{s}</span>
                  ))}
                </div>
                <button
                  onClick={() => generateReport(t.id)}
                  disabled={generating === t.id}
                  className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {generating === t.id
                    ? <><RefreshCw className="w-3 h-3 animate-spin" /> Generating…</>
                    : generated[t.id]
                    ? <><Download className="w-3 h-3" /> Download</>
                    : <><FileText className="w-3 h-3" /> Generate</>
                  }
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Partial reports */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Requires More Data</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {partialReports.map(t => {
            const cl = colorMap[t.color] || colorMap.amber
            return (
              <div key={t.id} className="rounded-xl border border-border bg-card p-4 opacity-70">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-xs font-semibold text-card-foreground">{t.title}</p>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-500/20 bg-amber-500/10 text-amber-400">Partial Data</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{t.description}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
