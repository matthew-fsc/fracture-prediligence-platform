import { useState, useEffect } from 'react'
import { FileText, Download, RefreshCw, CheckCircle } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import SectionDivider from '../components/ui/SectionDivider'

const COMPANY_ID = 1

const REPORT_TEMPLATES = [
  {
    id: 'drs_summary',
    title: 'Diligence Readiness Summary',
    description: 'DRS score, category breakdown, and top risks. 2-page executive-ready format.',
    sections: ['DRS Score & Tier', 'Category Scores', 'Top 5 Risks', 'Immediate Action Items'],
    status: 'ready',
  },
  {
    id: 'value_gap',
    title: 'Value Gap Report',
    description: 'Current vs. potential enterprise value with ranked value-creation initiatives.',
    sections: ['EV Range', 'Gap Analysis by Category', 'Initiative Roadmap', 'DRS Sensitivity'],
    status: 'ready',
  },
  {
    id: 'buyer_prep',
    title: 'Buyer Preparation Package',
    description: 'Anticipated due diligence questions with data needed for each response.',
    sections: ['Critical Questions', 'Financial Data Checklist', 'Operational Documentation', 'Management Bios'],
    status: 'ready',
  },
  {
    id: 'ebitda_recast',
    title: 'EBITDA Recast Schedule',
    description: 'Normalized EBITDA with each add-back itemized and documented.',
    sections: ['Reported P&L', 'Owner Add-backs', 'One-time Items', 'Defensible EBITDA'],
    status: 'partial',
  },
  {
    id: 'company_profile',
    title: 'Company Profile Teaser',
    description: 'Investor-ready 1-page company overview with key metrics and highlights.',
    sections: ['Business Overview', 'Financial Highlights', 'Team Summary', 'Growth Story'],
    status: 'partial',
  },
]

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
    // Simulate report generation (in Phase 2 this calls a real report endpoint)
    await new Promise(r => setTimeout(r, 1500))
    setGenerated(prev => ({ ...prev, [templateId]: true }))
    setGenerating(null)
  }

  const readyReports = REPORT_TEMPLATES.filter(t => t.status === 'ready')
  const partialReports = REPORT_TEMPLATES.filter(t => t.status === 'partial')

  return (
    <div>
      <PageHeader
        section="Output"
        title="Reports"
        subtitle="Generate and export advisory deliverables in advisor-ready format"
        badge={scoreData ? `DRS ${scoreData.drs?.base}/100` : undefined}
      />

      {scoreData && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'DRS Score',        value: `${scoreData.drs?.base}/100` },
            { label: 'EV Midpoint',      value: scoreData.enterprise_value ? `$${(scoreData.enterprise_value.midpoint / 1e6).toFixed(2)}M` : '—' },
            { label: 'DRS Tier',         value: scoreData.drs?.tier ?? '—' },
            { label: 'Reports Ready',    value: `${Object.keys(generated).length}/${REPORT_TEMPLATES.length}` },
          ].map(k => (
            <div key={k.label} className="bg-card border border-border rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
              <p className="text-sm font-bold text-card-foreground truncate">{k.value}</p>
            </div>
          ))}
        </div>
      )}

      <SectionDivider label="Available Reports" />
      <div className="space-y-3 mb-6">
        {readyReports.map(t => (
          <div key={t.id} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-xs font-semibold text-card-foreground">{t.title}</p>
                  <StatusBadge variant="adequate">Ready</StatusBadge>
                  {generated[t.id] && <CheckCircle className="w-3.5 h-3.5 text-primary" />}
                </div>
                <p className="text-[11px] text-muted-foreground mb-2">{t.description}</p>
                <div className="flex flex-wrap gap-1">
                  {t.sections.map(s => (
                    <span key={s} className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">{s}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => generateReport(t.id)}
                  disabled={generating === t.id}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {generating === t.id
                    ? <><RefreshCw className="w-3 h-3 animate-spin" /> Generating…</>
                    : generated[t.id]
                    ? <><Download className="w-3 h-3" /> Download</>
                    : <><FileText className="w-3 h-3" /> Generate</>
                  }
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <SectionDivider label="Requires More Data" />
      <div className="space-y-3">
        {partialReports.map(t => (
          <div key={t.id} className="bg-card border border-border rounded-lg p-4 opacity-70">
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-xs font-semibold text-card-foreground">{t.title}</p>
                  <StatusBadge variant="watch">Partial Data</StatusBadge>
                </div>
                <p className="text-[11px] text-muted-foreground">{t.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
