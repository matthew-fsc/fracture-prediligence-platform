import { useState, useEffect } from 'react'
import { cn, fmtM } from '../lib/utils'
import { Target, CheckCircle, Circle, Clock } from 'lucide-react'
import { useCompanyId } from '../context/CompanyContext'
import { apiClient } from '../lib/apiClient'
import { toast } from '../lib/notify'
import { drsCategoryBadgeClass } from '../lib/drsCategoryColors'

// Static initiative library for gap categories (live API fallback)
const INITIATIVES_BY_CAT = {
  revenue_quality: [
    { title: 'Formalize recurring contracts', effort: 'Medium', timeline: '60–90 days', ev_impact: 'High', description: 'Convert month-to-month clients to annual contracts to reduce concentration risk.' },
    { title: 'Implement CRM pipeline tracker', effort: 'Low', timeline: '30 days', ev_impact: 'Medium', description: 'Document all revenue relationships in a CRM to create institutional visibility.' },
  ],
  operational_independence: [
    { title: 'Document all core operating procedures', effort: 'Medium', timeline: '60 days', ev_impact: 'High', description: 'Create SOPs for client onboarding, service delivery, and account management.' },
    { title: 'Hire or promote an operations manager', effort: 'High', timeline: '60–120 days', ev_impact: 'Critical', description: 'A credible GM/COO running day-to-day removes the largest PE valuation discount.' },
  ],
  customer_risk: [
    { title: 'Reduce top-customer revenue concentration', effort: 'High', timeline: '6–12 months', ev_impact: 'High', description: 'Target: no single customer > 20% of revenue.' },
    { title: 'Add customer reference letters to VDR', effort: 'Low', timeline: '14 days', ev_impact: 'Medium', description: 'Written references reduce buyer concern about post-close customer attrition.' },
  ],
  management_team: [
    { title: 'Hire fractional CFO', effort: 'Medium', timeline: '30–60 days', ev_impact: 'High', description: 'Financial leadership independent of the owner removes a major red flag for PE buyers.' },
    { title: 'Execute retention agreements for key managers', effort: 'Low', timeline: '14 days', ev_impact: 'High', description: 'Retention bonuses tied to transaction close remove key-person deal risk.' },
  ],
  financial_integrity: [
    { title: 'Commission a CPA review or audit', effort: 'Low', timeline: '30–60 days', ev_impact: 'Critical', description: 'An independent CPA review dramatically increases buyer confidence.' },
    { title: 'Prepare 3-year normalized EBITDA schedule', effort: 'Low', timeline: '14 days', ev_impact: 'High', description: 'Document each add-back with supporting receipts to reduce buyer skepticism.' },
  ],
  growth_drivers: [
    { title: 'Build and document a 3-year growth plan', effort: 'Low', timeline: '30 days', ev_impact: 'Medium', description: 'A credible, data-backed growth plan increases strategic value to potential buyers.' },
    { title: 'Launch structured outbound sales motion', effort: 'Medium', timeline: '60–90 days', ev_impact: 'High', description: 'Adding a repeatable new-client acquisition channel improves growth score.' },
  ],
}

export default function InitiativeImpact() {
  const companyId = useCompanyId()
  const [selected, setSelected] = useState(new Set())
  const [gapData, setGapData] = useState(null)
  const [customInits, setCustomInits] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [newCat, setNewCat] = useState('revenue_quality')

  useEffect(() => {
    apiClient.get(`/api/analytics/value-gap/${companyId}`)
      .then(setGapData)
      .catch(() => {})
  }, [companyId])

  const [libraryInits, setLibraryInits] = useState([])

  useEffect(() => {
    if (companyId == null || companyId < 1) return
    Promise.all([
      apiClient.get(`/api/analytics/initiatives/${companyId}`).catch(() => ({ initiatives: [] })),
      apiClient.get(`/api/library/?item_type=initiative&is_active=true`).catch(() => ({ items: [] })),
    ]).then(([d, lib]) => {
      setCustomInits(d.initiatives ?? [])
      setLibraryInits(lib.items ?? [])
    })
  }, [companyId])

  const toggle = (id) => {
    const s = new Set(selected)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelected(s)
  }

  // Scale individual uplifts so they sum to total_value_gap before distributing across sub-initiatives
  const rawUpliftSum = gapData?.gaps?.reduce((s, g) => s + g.ev_uplift, 0) ?? 0
  const gapTotal     = gapData?.total_value_gap ?? rawUpliftSum
  const upliftScale  = rawUpliftSum > 0 ? gapTotal / rawUpliftSum : 1

  // Build per-category initiative lookup — prefer library items, fall back to static map
  const initsByCat = Object.fromEntries(
    Object.keys(INITIATIVES_BY_CAT).map(cat => {
      const libItems = libraryInits.filter(i => i.category === cat)
      return [cat, libItems.length > 0 ? libItems : INITIATIVES_BY_CAT[cat]]
    })
  )

  const DRIVERS = gapData?.gaps?.length
    ? [
        ...gapData.gaps.flatMap((g) => {
          const inits = initsByCat[g.category] ?? INITIATIVES_BY_CAT[g.category] ?? []
          const scaledUplift = g.ev_uplift * upliftScale
          const n = inits.length || 1
          return inits.map((init) => ({
            initiative: init.title,
            detail:    init.description,
            valueMin:  Math.round(scaledUplift * 0.75 / n),
            valueMax:  Math.round(scaledUplift / n),
            timeline:  init.timeline,
            severity:  g.priority === 1 ? 'critical' : g.priority <= 3 ? 'high' : 'medium',
            category:  g.category,
            months:    g.priority <= 1 ? 18 : g.priority <= 3 ? 12 : 6,
          }))
        }),
        ...customInits.map(c => ({
          initiative: c.title,
          detail:    `Custom · ${c.timeline || 'Timeline TBD'}`,
          valueMin:  c.advisor_ev_override != null
            ? Math.round(c.advisor_ev_override * 0.9)
            : c.ev_impact_estimate != null
              ? Math.round(Number(c.ev_impact_estimate) * 0.75)
              : 0,
          valueMax:  c.advisor_ev_override != null
            ? Math.round(c.advisor_ev_override)
            : c.ev_impact_estimate != null
              ? Math.round(Number(c.ev_impact_estimate))
              : 0,
          timeline:  c.timeline || '—',
          severity:  'medium',
          category:  c.category || 'growth_drivers',
          months:    12,
          customId:  c.id,
        })),
      ]
    : customInits.map(c => ({
        initiative: c.title,
        detail:    'Advisor-defined initiative',
        valueMin:  c.advisor_ev_override != null ? Math.round(c.advisor_ev_override * 0.9) : 0,
        valueMax:  c.advisor_ev_override != null ? Math.round(c.advisor_ev_override) : Math.round(Number(c.ev_impact_estimate || 0)),
        timeline:  c.timeline || '—',
        severity:  'medium',
        category:  c.category || 'growth_drivers',
        months:    12,
        customId:  c.id,
      }))

  const active = DRIVERS.filter((_, i) => selected.has(i))
  const totalEVMin = active.reduce((s, d) => s + (d.valueMin || 0), 0)
  const totalEVMax = active.reduce((s, d) => s + (d.valueMax || 0), 0)
  const maxMonths = active.length > 0 ? Math.max(...active.map(d => d.months || 9)) : 0
  const maxVal = DRIVERS.length ? Math.max(...DRIVERS.map(d => d.valueMax || 1)) : 1

  async function addCustomInitiative(e) {
    e.preventDefault()
    if (!newTitle.trim() || companyId == null || companyId < 1) return
    try {
      const created = await apiClient.post(`/api/analytics/initiatives/${companyId}`, {
        title: newTitle.trim(),
        category: newCat,
        ev_impact_estimate: null,
      })
      setCustomInits((prev) => [created, ...prev])
      setNewTitle('')
      toast.success('Initiative added')
    } catch (err) {
      toast.error(err?.message || 'Could not add initiative')
    }
  }

  return (
    <div className="space-y-4 max-w-[1400px]">
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-0.5">Value Creation</p>
        <h1 className="text-xl font-bold text-foreground">Initiative Impact Modeling</h1>
        <p className="text-sm text-muted-foreground">Select initiatives to model combined enterprise value impact and projected timeline</p>
      </div>

      {selected.size > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">EV Increase</p>
                <p className="text-xl font-bold text-emerald-400">+{fmtM(totalEVMin)}–{fmtM(totalEVMax)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Time to Realize</p>
                <p className="text-xl font-bold text-foreground">{maxMonths} months</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold px-2 py-1 rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                {selected.size} of {DRIVERS.length} selected
              </span>
              <button onClick={() => setSelected(new Set())}
                className="text-xs px-2.5 py-1 rounded border border-border text-muted-foreground hover:bg-muted/30 transition-colors">
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        {/* Initiative list */}
        <div className="col-span-12 lg:col-span-7 space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Value Creation Initiatives · Ranked by Impact</p>
          {DRIVERS.length === 0 && (
            <p className="text-sm text-muted-foreground rounded-xl border border-border bg-card p-6 text-center">
              No initiatives to show — resolve value-gap data or add a custom initiative below.
            </p>
          )}
          {DRIVERS.map((d, i) => {
            const isActive = selected.has(i)
            return (
              <button key={i} onClick={() => toggle(i)}
                className={cn('w-full text-left rounded-xl border p-4 transition-all',
                  isActive ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-card hover:bg-muted/20')}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {isActive ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4 text-muted-foreground/40" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <p className="text-sm font-semibold text-foreground">{d.initiative}</p>
                      <span className="text-sm font-bold text-emerald-400 flex-shrink-0">
                        +{fmtM(d.valueMin)}–{fmtM(d.valueMax)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-2">{d.detail}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={cn('text-[11px] font-semibold px-1.5 py-0.5 rounded border', drsCategoryBadgeClass(d.category))}>{d.category?.replace(/_/g, ' ')}</span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded border border-border text-muted-foreground flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />{d.timeline}
                      </span>
                      {d.severity && <span className={cn('text-[11px] px-1.5 py-0.5 rounded border font-semibold',
                        d.severity === 'critical' ? 'border-red-500/20 bg-red-500/10 text-red-400' :
                        d.severity === 'high' ? 'border-amber-500/20 bg-amber-500/10 text-amber-400' :
                        'border-border text-muted-foreground')}>{d.severity}</span>}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Right panel */}
        <div className="col-span-12 lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold text-foreground mb-3">Value Creation by Initiative</p>
            {DRIVERS.map((d, i) => {
              const isActive = selected.has(i)
              const widthPct = (d.valueMax / maxVal) * 100
              return (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] text-muted-foreground w-28 truncate flex-shrink-0">{d.initiative.split(' ').slice(0, 2).join(' ')}</span>
                  <div className="flex-1 h-4 bg-muted/30 rounded relative">
                    <div className={cn('h-full rounded transition-all', isActive ? 'bg-emerald-500/70' : 'bg-muted/60')}
                      style={{ width: `${widthPct}%` }} />
                    <span className="absolute right-1 top-0 h-full flex items-center text-[11px] text-muted-foreground">+{fmtM(d.valueMax)}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold text-foreground mb-3">Implementation Timeline</p>
            <div className="flex justify-between text-[11px] text-muted-foreground mb-3">
              {[0, 3, 6, 9, 12].map(m => <span key={m}>{m}mo</span>)}
            </div>
            {DRIVERS.map((d, i) => {
              const isActive = selected.has(i)
              const widthPct = Math.min(((d.months || 9) / 12) * 100, 100)
              return (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] text-muted-foreground w-28 truncate flex-shrink-0">{d.initiative.split(' ').slice(0, 2).join(' ')}</span>
                  <div className="flex-1 h-4 bg-muted/30 rounded relative">
                    <div className={cn('h-full rounded transition-all', isActive ? 'bg-emerald-500/40' : 'bg-muted/60')}
                      style={{ width: `${widthPct}%` }} />
                    <span className="absolute right-1 top-0 h-full flex items-center text-[11px] text-muted-foreground">{d.months || 9}mo</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold text-foreground mb-3">EV Bridge Summary</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Enterprise Value</span>
                <span className="font-bold text-foreground">{fmtM((gapData?.current_ev_midpoint ?? 0))}</span>
              </div>
              {selected.size > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Selected initiatives</span>
                  <span className="font-bold">+{fmtM(totalEVMin)}–{fmtM(totalEVMax)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 mt-2">
                <span className="font-semibold text-foreground">Projected EV</span>
                <span className="font-bold text-emerald-400 text-sm">
                  {selected.size > 0
                    ? `${fmtM((gapData?.current_ev_midpoint ?? 0) + totalEVMin)}–${fmtM((gapData?.current_ev_midpoint ?? 0) + totalEVMax)}`
                    : fmtM((gapData?.current_ev_midpoint ?? 0))}
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={addCustomInitiative} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="text-xs font-semibold text-foreground">Add custom initiative</p>
            <p className="text-[11px] text-muted-foreground">
              Stored per company and shown alongside template initiatives from the value gap.
            </p>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[160px]">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Title</label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-muted-foreground placeholder:text-muted-foreground/45 focus:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                  placeholder="e.g. Implement weekly KPI cadence"
                />
              </div>
              <div className="w-44">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Category</label>
                <select
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-muted-foreground focus:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                >
                  {Object.keys(INITIATIVES_BY_CAT).map((k) => (
                    <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="text-xs font-semibold px-3 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
