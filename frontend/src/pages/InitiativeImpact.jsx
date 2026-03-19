import { useState, useEffect } from 'react'
import { TrendingUp, Clock } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import SectionDivider from '../components/ui/SectionDivider'

const COMPANY_ID = 1

// Static initiative library keyed to gap categories
// In Phase 2 this will be AI-generated per company
const INITIATIVES = {
  revenue_quality: [
    { title: 'Formalize recurring contracts', effort: 'Medium', timeline: '60–90 days', ev_impact: 'High', description: 'Convert month-to-month clients to annual contracts. Each converted client reduces concentration risk and adds contractual ARR.' },
    { title: 'Implement a CRM and pipeline tracker', effort: 'Low', timeline: '30 days', ev_impact: 'Medium', description: 'Document all revenue relationships in a CRM. Creates institutional visibility and reduces key-person risk on sales.' },
    { title: 'Develop a customer success function', effort: 'High', timeline: '90–180 days', ev_impact: 'High', description: 'Assign dedicated customer success roles to top 10 accounts. Documented NRR improvement directly raises revenue quality score.' },
  ],
  financial_integrity: [
    { title: 'Commission a CPA review or audit', effort: 'Low', timeline: '30–60 days', ev_impact: 'Critical', description: 'An independent CPA review or audit dramatically increases buyer confidence and often unlocks higher multiples.' },
    { title: 'Prepare a 3-year normalized EBITDA schedule', effort: 'Low', timeline: '14 days', ev_impact: 'High', description: 'Document each add-back with supporting receipts or invoices. Reduces buyer skepticism around EBITDA quality.' },
    { title: 'Separate owner personal expenses from operating P&L', effort: 'Low', timeline: '30 days', ev_impact: 'High', description: 'Clean separation makes the add-back schedule defensible and reduces the time spent in financial due diligence.' },
  ],
  operational_independence: [
    { title: 'Document all core operating procedures', effort: 'Medium', timeline: '60 days', ev_impact: 'High', description: 'Create SOPs for client onboarding, service delivery, and account management. Proves the business runs independently of the owner.' },
    { title: 'Hire or promote an operations manager / GM', effort: 'High', timeline: '60–120 days', ev_impact: 'Critical', description: 'The single highest-impact operational change. A credible GM/COO running day-to-day directly removes the largest PE valuation discount.' },
    { title: 'Transition client relationships to team members', effort: 'Medium', timeline: '90 days', ev_impact: 'High', description: 'Introduce a second point of contact at every client. Schedule check-in calls with the non-founder contact present.' },
  ],
  customer_risk: [
    { title: 'Reduce top-customer revenue concentration', effort: 'High', timeline: '6–12 months', ev_impact: 'High', description: 'Actively sell to new clients while growing other existing accounts. Target: no single customer > 20% of revenue.' },
    { title: 'Add customer reference letters to VDR', effort: 'Low', timeline: '14 days', ev_impact: 'Medium', description: 'Written references from top clients reduce buyer concern about post-close customer attrition.' },
    { title: 'Implement a client health score dashboard', effort: 'Medium', timeline: '45 days', ev_impact: 'Medium', description: 'Document client satisfaction, renewal probability, and at-risk flags. Demonstrates disciplined account management.' },
  ],
  management_team: [
    { title: 'Hire a CFO or engage a fractional CFO', effort: 'Medium', timeline: '30–60 days', ev_impact: 'High', description: 'Financial leadership independent of the owner removes a major red flag for PE buyers evaluating management continuity.' },
    { title: 'Formalize management team roles and authorities', effort: 'Low', timeline: '30 days', ev_impact: 'Medium', description: 'Define reporting structure, decision authorities, and compensation in writing. Shows governance beyond the owner.' },
    { title: 'Execute retention agreements for key managers', effort: 'Low', timeline: '14 days', ev_impact: 'High', description: 'Retention bonuses tied to transaction close remove key-person deal risk and give buyers post-close continuity.' },
  ],
  growth_drivers: [
    { title: 'Build and document a 3-year growth plan', effort: 'Low', timeline: '30 days', ev_impact: 'Medium', description: 'A credible, data-backed growth plan increases the strategic value of the business to potential buyers.' },
    { title: 'Launch a structured outbound sales motion', effort: 'Medium', timeline: '60–90 days', ev_impact: 'High', description: 'Adding a repeatable new-client acquisition channel directly improves growth score and forward pipeline coverage.' },
    { title: 'Identify and pursue one adjacent market', effort: 'High', timeline: '90–180 days', ev_impact: 'Medium', description: 'Demonstrating expansion into an adjacent market signals runway and reduces perceived market saturation risk.' },
  ],
}

const EFFORT_VARIANT = { Low: 'adequate', Medium: 'watch', High: 'high', Critical: 'critical' }
const IMPACT_VARIANT = { Critical: 'critical', High: 'high', Medium: 'watch', Low: 'medium' }

function fmtM(n) {
  if (!n && n !== 0) return '—'
  return `$${(n / 1_000_000).toFixed(2)}M`
}

export default function InitiativeImpact() {
  const [gap, setGap]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/analytics/value-gap/${COMPANY_ID}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setGap(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Build initiative list ordered by gap priority
  const gapCategories = gap?.gaps?.map(g => g.category) ?? Object.keys(INITIATIVES)
  const allInitiatives = gapCategories.flatMap(cat =>
    (INITIATIVES[cat] ?? []).map((init, i) => ({
      ...init,
      category: cat,
      gap: gap?.gaps?.find(g => g.category === cat),
      rank: i,
    }))
  )

  // Sort: Critical impact first, then by gap priority
  const sorted = [...allInitiatives].sort((a, b) => {
    const impactOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 }
    const ai = impactOrder[a.ev_impact] ?? 4
    const bi = impactOrder[b.ev_impact] ?? 4
    return ai - bi || (a.gap?.priority ?? 99) - (b.gap?.priority ?? 99)
  })

  return (
    <div>
      <PageHeader
        section="Value Creation"
        title="Initiative Impact"
        subtitle="Prioritized value-creation initiatives ranked by enterprise value uplift"
        badge={gap ? `${fmtM(gap.total_value_gap)} total gap` : undefined}
      />

      {loading && <div className="text-center py-16 text-muted-foreground text-sm">Loading initiatives…</div>}

      {gap && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Current EV',   value: fmtM(gap.current_ev_midpoint) },
            { label: 'Potential EV', value: fmtM(gap.potential_ev_midpoint) },
            { label: 'Value Gap',    value: fmtM(gap.total_value_gap), primary: true },
          ].map(k => (
            <div key={k.label} className="bg-card border border-border rounded-lg p-4 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
              <p className={`text-2xl font-black ${k.primary ? 'text-primary' : 'text-card-foreground'}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      <SectionDivider label="Value Creation Initiatives" />

      <div className="space-y-3">
        {sorted.map((init, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-primary">{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-xs font-semibold text-card-foreground">{init.title}</p>
                  <StatusBadge variant={IMPACT_VARIANT[init.ev_impact]}>
                    {init.ev_impact} impact
                  </StatusBadge>
                </div>
                <p className="text-[11px] text-muted-foreground mb-2 leading-relaxed">{init.description}</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Effort: </span>
                    <StatusBadge variant={EFFORT_VARIANT[init.effort]}>{init.effort}</StatusBadge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">{init.timeline}</span>
                  </div>
                  {init.gap && (
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      Addresses: {init.gap.label} ({init.gap.current_score} → {init.gap.target_score})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
