import { useState, useEffect } from 'react'
import SectionHeader from '../components/ui/SectionHeader'
import { cn } from '../lib/utils'
import { CheckCircle, Circle, Save, ClipboardList, ChevronDown, ChevronRight, History, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useCompanyId } from '../context/CompanyContext'
import { apiClient } from '../lib/apiClient'
import { toast } from '../lib/notify'
import { getDrsCategoryStyle } from '../lib/drsCategoryColors'

const MARKET_OPTIONS = [
  { value: 'defined',          label: 'Defined ICP + clear differentiation + repeatable sales motion', score: 80 },
  { value: 'moderate',         label: 'Moderate positioning — some differentiation, inconsistent execution', score: 45 },
  { value: 'undifferentiated', label: 'Undifferentiated or unclear — competing on price/availability', score: 10 },
]

export default function QualitativeInputs() {
  const companyId = useCompanyId()
  const [form, setForm] = useState({
    owner_hours_per_week: '',
    sop_pct: null,
    automation_pct: null,
    mgmt_qualified: '',
    mgmt_total_functions: 4,
    pipeline_value: '',
    market_positioning: '',
    repeatability_pct: null,
    contract_pct: null,
    customer_contract_type: '',
    key_person_revenue_pct: null,
    // A6 management fields
    has_crm_pipeline: null,
    non_compete_pct: '',
    voluntary_turnover: '',
    comp_vs_market: '',
  })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [auditEntries, setAuditEntries] = useState([])
  const [drsDiff, setDrsDiff] = useState(null)  // {baseline, current, advisory_delta, category_scores}

  useEffect(() => {
    if (!companyId) return
    apiClient.get(`/api/analytics/qualitative/${companyId}`)
      .then(d => {
        if (d?.inputs) {
          setForm({
            owner_hours_per_week:   d.inputs.owner_hours_per_week ?? '',
            sop_pct:                d.inputs.sop_pct ?? null,
            automation_pct:         d.inputs.automation_pct ?? null,
            mgmt_qualified:         d.inputs.mgmt_qualified ?? '',
            mgmt_total_functions:   d.inputs.mgmt_total_functions ?? 4,
            pipeline_value:         d.inputs.pipeline_value ?? '',
            market_positioning:     d.inputs.market_positioning ?? '',
            repeatability_pct:      d.inputs.repeatability_pct ?? null,
            contract_pct:           d.inputs.contract_pct ?? null,
            customer_contract_type: d.inputs.customer_contract_type ?? '',
            key_person_revenue_pct: d.inputs.key_person_revenue_pct ?? null,
            has_crm_pipeline:       d.inputs.has_crm_pipeline ?? null,
            non_compete_pct:        d.inputs.non_compete_pct ?? '',
            voluntary_turnover:     d.inputs.voluntary_turnover ?? '',
            comp_vs_market:         d.inputs.comp_vs_market ?? '',
          })
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [companyId])

  useEffect(() => {
    if (companyId == null || companyId < 1) return
    apiClient.get(`/api/analytics/qualitative-audit/${companyId}?limit=15`)
      .then(d => setAuditEntries(d.entries ?? []))
      .catch(() => setAuditEntries([]))
  }, [companyId, saved])

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setSaved(false) }

  // A section is complete only when all required fields are explicitly set (not null/empty defaults)
  const a4Complete = form.owner_hours_per_week !== '' && form.sop_pct !== null && form.automation_pct !== null
  const a3Complete = form.customer_contract_type !== '' && form.contract_pct !== null && form.key_person_revenue_pct !== null
  const a7Complete = form.pipeline_value !== '' && form.market_positioning !== '' && form.repeatability_pct !== null
  const a6Complete = form.non_compete_pct !== '' && form.voluntary_turnover !== '' && form.comp_vs_market !== ''
  const allComplete = a4Complete && a3Complete && a7Complete && a6Complete

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        owner_hours_per_week:   form.owner_hours_per_week !== '' ? Number(form.owner_hours_per_week) : null,
        sop_pct:                form.sop_pct !== null ? Number(form.sop_pct) : null,
        automation_pct:         form.automation_pct !== null ? Number(form.automation_pct) : null,
        mgmt_qualified:         form.mgmt_qualified !== '' ? Number(form.mgmt_qualified) : null,
        mgmt_total_functions:   form.mgmt_total_functions !== '' ? Number(form.mgmt_total_functions) : null,
        pipeline_value:         form.pipeline_value !== '' ? Number(form.pipeline_value) : null,
        market_positioning:     form.market_positioning || null,
        repeatability_pct:      form.repeatability_pct !== null ? Number(form.repeatability_pct) : null,
        contract_pct:           form.contract_pct !== null ? Number(form.contract_pct) : null,
        customer_contract_type: form.customer_contract_type || null,
        key_person_revenue_pct: form.key_person_revenue_pct !== null ? Number(form.key_person_revenue_pct) : null,
        has_crm_pipeline:       form.has_crm_pipeline,
        non_compete_pct:        form.non_compete_pct || null,
        voluntary_turnover:     form.voluntary_turnover || null,
        comp_vs_market:         form.comp_vs_market || null,
      }
      await apiClient.post(`/api/analytics/qualitative/${companyId}`, payload)
      setSaved(true)
      // Fetch the new DRS to display the before/after diff
      try {
        const scores = await apiClient.get(`/api/analytics/scores/${companyId}`)
        if (scores?.drs) {
          setDrsDiff({
            baseline:        scores.drs.baseline,
            current:         { base: scores.drs.base, conservative: scores.drs.conservative, optimistic: scores.drs.optimistic, tier: scores.drs.tier },
            advisory_delta:  scores.drs.advisory_delta,
            category_scores: scores.category_scores,
          })
        }
      } catch { /* non-critical */ }
    } catch (e) {
      toast.error(e?.message || 'Save failed')
    } finally { setSaving(false) }
  }

  const StatusBadge = ({ complete, label, categoryKey }) => {
    const c = getDrsCategoryStyle(categoryKey)
    return (
      <div className={cn('flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border',
        complete ? cn(c.border, c.bg, c.text) : 'border-amber-500/30 bg-amber-500/10 text-amber-400')}>
        {complete ? <CheckCircle className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
        {label}: {complete ? 'Complete' : 'Incomplete'}
      </div>
    )
  }

  if (!loaded) return <div className="space-y-4 max-w-[900px]"><div className="h-8 w-64 bg-muted rounded animate-pulse" /></div>

  return (
    <div className="space-y-6 max-w-[900px]">
      <SectionHeader
        title="Qualitative Inputs"
        subtitle="Advisor-sourced data for sub-scores that financial data cannot capture. These inputs feed directly into A4, A6, and A7 scoring."
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge complete={a3Complete} label="Rev Contracts" categoryKey="revenue_quality" />
            <StatusBadge complete={a4Complete} label="Ops Independence" categoryKey="operational_independence" />
            <StatusBadge complete={a6Complete} label="Management" categoryKey="management_team" />
            <StatusBadge complete={a7Complete} label="Growth Drivers" categoryKey="growth_drivers" />
          </div>
        }
      />

      <div className="rounded-xl border border-border bg-card/50 p-4 text-[11px] text-muted-foreground flex items-start gap-2">
        <ClipboardList className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
        <p>These questions replace conservative default assumptions used when qualitative data is absent. When all inputs in a section are complete, the DRS automatically recomputes using the qualitative sub-scores. Inputs are saved per engagement.</p>
      </div>

      {/* Section A: Revenue Contracts & Key Person */}
      <div className={cn('rounded-xl border border-border bg-card p-5 space-y-5 border-l-2', getDrsCategoryStyle('revenue_quality').accentLine)}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-foreground uppercase tracking-wider">Revenue Contracts &amp; Key Person Risk</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Maps to DRS category: Revenue Quality · Captures contract formalization and owner-dependency that financials cannot show</p>
          </div>
          <div className={cn('flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border',
            a3Complete
              ? cn(getDrsCategoryStyle('revenue_quality').border, getDrsCategoryStyle('revenue_quality').bg, getDrsCategoryStyle('revenue_quality').text)
              : 'border-amber-500/30 bg-amber-500/10 text-amber-400')}>
            {a3Complete ? <CheckCircle className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
            {a3Complete ? 'Complete' : 'Incomplete'}
          </div>
        </div>

        {/* Contract Coverage */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Contract / MSA Coverage
          </label>
          <p className="text-[11px] text-muted-foreground mb-2">
            What percentage of active customers have a signed contract, MSA, or retainer agreement in place?
          </p>
          <div className="space-y-1.5">
            {form.contract_pct === null && (
              <p className="text-[11px] text-amber-400 font-medium">Move the slider to set a value — required for section completion</p>
            )}
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>0% — all handshake / verbal</span>
              <span className="font-bold text-foreground">{form.contract_pct !== null ? `${form.contract_pct}%` : '—'}</span>
              <span>100% — fully contracted</span>
            </div>
            <input type="range" min={0} max={100} step={5} value={form.contract_pct ?? 50}
              onChange={e => set('contract_pct', e.target.value)}
              className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary" />
            {form.contract_pct !== null && (
              <p className={cn('text-[11px] font-semibold',
                Number(form.contract_pct) >= 80 ? 'text-emerald-400' :
                Number(form.contract_pct) >= 50 ? 'text-amber-400' : 'text-red-400')}>
                {Number(form.contract_pct) >= 80 ? 'Strong — buyers will view revenue as secured'
                  : Number(form.contract_pct) >= 50 ? 'Moderate — formalize remaining relationships before sale'
                  : 'Weak — significant buyer risk; contract formalization is a high-priority initiative'}
              </p>
            )}
          </div>
        </div>

        {/* Primary Contract Type */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Primary Contract Type
          </label>
          <p className="text-[11px] text-muted-foreground mb-2">
            How is most revenue structured with customers?
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'msa',      label: 'MSA / Annual Contract',    sub: 'Highest buyer confidence' },
              { value: 'retainer', label: 'Retainer / Subscription',  sub: 'Recurring — strong signal' },
              { value: 'project',  label: 'Project-Based',            sub: 'Lower predictability' },
              { value: 'mix',      label: 'Mix of Above',             sub: 'Document each relationship' },
            ].map(opt => (
              <button key={opt.value} onClick={() => set('customer_contract_type', opt.value)}
                className={cn('text-left rounded-lg border p-3 transition-all',
                  form.customer_contract_type === opt.value
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border bg-muted/20 hover:bg-muted/40')}>
                <div className="flex items-center gap-2 mb-0.5">
                  {form.customer_contract_type === opt.value
                    ? <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    : <Circle className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />}
                  <span className="text-xs font-semibold text-foreground">{opt.label}</span>
                </div>
                <p className="text-[11px] text-muted-foreground pl-5">{opt.sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Key Person Revenue Dependency */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Owner Revenue Dependency
          </label>
          <p className="text-[11px] text-muted-foreground mb-2">
            Approximately what percentage of revenue is attributable to the owner's personal relationships — customers who would follow the owner if they left the business?
          </p>
          <div className="space-y-1.5">
            {form.key_person_revenue_pct === null && (
              <p className="text-[11px] text-amber-400 font-medium">Move the slider to set a value — required for section completion</p>
            )}
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>0% — no personal dependency</span>
              <span className="font-bold text-foreground">{form.key_person_revenue_pct !== null ? `${form.key_person_revenue_pct}%` : '—'}</span>
              <span>100% — fully owner-dependent</span>
            </div>
            <input type="range" min={0} max={100} step={5} value={form.key_person_revenue_pct ?? 50}
              onChange={e => set('key_person_revenue_pct', e.target.value)}
              className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary" />
            {form.key_person_revenue_pct !== null && (
              <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded border inline-block',
                Number(form.key_person_revenue_pct) <= 20 ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10' :
                Number(form.key_person_revenue_pct) <= 50 ? 'border-amber-500/20 text-amber-400 bg-amber-500/10' :
                'border-red-500/20 text-red-400 bg-red-500/10')}>
                {Number(form.key_person_revenue_pct) <= 10 ? 'Low risk — institutionalized relationships'
                  : Number(form.key_person_revenue_pct) <= 20 ? 'Manageable — introduce key account managers'
                  : Number(form.key_person_revenue_pct) <= 50 ? 'Moderate risk — transition plan needed'
                  : 'High risk — major valuation discount; buyer will escrow or reduce offer'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Section B: Operational Independence */}
      <div className={cn('rounded-xl border border-border bg-card p-5 space-y-5 border-l-2', getDrsCategoryStyle('operational_independence').accentLine)}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-foreground uppercase tracking-wider">Operational Independence</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Maps to DRS category weight: 20% · Sub-score weights: owner hours 35%, SOPs 30%, automation 15%, management depth 20%</p>
          </div>
          <div className={cn('flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border',
            a4Complete
              ? cn(getDrsCategoryStyle('operational_independence').border, getDrsCategoryStyle('operational_independence').bg, getDrsCategoryStyle('operational_independence').text)
              : 'border-amber-500/30 bg-amber-500/10 text-amber-400')}>
            {a4Complete ? <CheckCircle className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
            {a4Complete ? 'Complete' : 'Incomplete'}
          </div>
        </div>

        {/* Q1: Owner Hours */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Owner Hours in Operations <span className="text-muted-foreground font-normal">(35% sub-weight)</span>
          </label>
          <p className="text-[11px] text-muted-foreground mb-2">
            On average, how many hours per week does the owner spend in day-to-day operations — not strategy, not external?
          </p>
          <div className="flex items-center gap-3">
            <input type="number" min={0} max={80} value={form.owner_hours_per_week}
              onChange={e => set('owner_hours_per_week', e.target.value)}
              placeholder="e.g. 30"
              className="w-24 text-sm bg-background border border-border rounded-lg px-3 py-1.5 text-muted-foreground placeholder:text-muted-foreground/45 focus:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
            <span className="text-xs text-muted-foreground">hours / week</span>
            {form.owner_hours_per_week !== '' && (
              <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded border',
                Number(form.owner_hours_per_week) <= 15 ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10' :
                Number(form.owner_hours_per_week) <= 30 ? 'border-amber-500/20 text-amber-400 bg-amber-500/10' :
                'border-red-500/20 text-red-400 bg-red-500/10')}>
                {Number(form.owner_hours_per_week) <= 5 ? '90 pts — owner not needed' :
                 Number(form.owner_hours_per_week) <= 15 ? '75 pts — low dependency' :
                 Number(form.owner_hours_per_week) <= 25 ? '55 pts — moderate dependency' :
                 Number(form.owner_hours_per_week) <= 40 ? '35 pts — high dependency' :
                 '10 pts — critical dependency'}
              </span>
            )}
          </div>
        </div>

        {/* Q2: SOP Documentation */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            SOP Documentation Score <span className="text-muted-foreground font-normal">(30% sub-weight)</span>
          </label>
          <p className="text-[11px] text-muted-foreground mb-2">
            What percentage of core operational processes have written SOPs? (onboarding, service delivery, account management, billing)
          </p>
          <div className="space-y-1.5">
            {form.sop_pct === null && (
              <p className="text-[11px] text-amber-400 font-medium">Move the slider to set a value — required for section completion</p>
            )}
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>0% — none documented</span>
              <span className="font-bold text-foreground">{form.sop_pct !== null ? `${form.sop_pct}%` : '—'}</span>
              <span>100% — fully documented</span>
            </div>
            <input type="range" min={0} max={100} step={5} value={form.sop_pct ?? 50}
              onChange={e => set('sop_pct', e.target.value)}
              className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary" />
          </div>
        </div>

        {/* Q3: Process Automation */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Process Automation Level <span className="text-muted-foreground font-normal">(15% sub-weight)</span>
          </label>
          <p className="text-[11px] text-muted-foreground mb-2">
            What percentage of repetitive operational tasks (invoicing, reporting, scheduling) are handled by a system rather than a person?
          </p>
          <div className="space-y-1.5">
            {form.automation_pct === null && (
              <p className="text-[11px] text-amber-400 font-medium">Move the slider to set a value — required for section completion</p>
            )}
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>0% — fully manual</span>
              <span className="font-bold text-foreground">{form.automation_pct !== null ? `${form.automation_pct}%` : '—'}</span>
              <span>100% — fully automated</span>
            </div>
            <input type="range" min={0} max={100} step={5} value={form.automation_pct ?? 30}
              onChange={e => set('automation_pct', e.target.value)}
              className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary" />
          </div>
        </div>

        {/* Q4: Management Depth */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Management Depth Ratio <span className="text-muted-foreground font-normal">(20% sub-weight)</span>
          </label>
          <p className="text-[11px] text-muted-foreground mb-2">
            How many of the company's core business functions (sales, delivery, finance, operations) have a qualified manager who could run that function without the owner?
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={10} value={form.mgmt_qualified}
                onChange={e => set('mgmt_qualified', e.target.value)}
                placeholder="0"
                className="w-16 text-sm bg-background border border-border rounded-lg px-2 py-1.5 text-muted-foreground text-center placeholder:text-muted-foreground/45 focus:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
              <span className="text-xs text-muted-foreground">qualified</span>
              <span className="text-xs text-muted-foreground">/</span>
              <input type="number" min={1} max={10} value={form.mgmt_total_functions}
                onChange={e => set('mgmt_total_functions', e.target.value)}
                placeholder="4"
                className="w-16 text-sm bg-background border border-border rounded-lg px-2 py-1.5 text-muted-foreground text-center placeholder:text-muted-foreground/45 focus:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
              <span className="text-xs text-muted-foreground">total functions</span>
            </div>
            {form.mgmt_qualified !== '' && form.mgmt_total_functions !== '' && Number(form.mgmt_total_functions) > 0 && (
              <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded border',
                Number(form.mgmt_qualified)/Number(form.mgmt_total_functions) >= 0.75 ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10' :
                Number(form.mgmt_qualified)/Number(form.mgmt_total_functions) >= 0.50 ? 'border-amber-500/20 text-amber-400 bg-amber-500/10' :
                'border-red-500/20 text-red-400 bg-red-500/10')}>
                {Math.round(Number(form.mgmt_qualified)/Number(form.mgmt_total_functions)*100)}% coverage
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Section C: Growth Drivers */}
      <div className={cn('rounded-xl border border-border bg-card p-5 space-y-5 border-l-2', getDrsCategoryStyle('growth_drivers').accentLine)}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-foreground uppercase tracking-wider">Growth Drivers</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Maps to DRS category weight: 10% · Sub-score weights: pipeline 30%, market positioning 20%, repeatability 15% (CAGR 35% from financial data)</p>
          </div>
          <div className={cn('flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border',
            a7Complete
              ? cn(getDrsCategoryStyle('growth_drivers').border, getDrsCategoryStyle('growth_drivers').bg, getDrsCategoryStyle('growth_drivers').text)
              : 'border-amber-500/30 bg-amber-500/10 text-amber-400')}>
            {a7Complete ? <CheckCircle className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
            {a7Complete ? 'Complete' : 'Incomplete'}
          </div>
        </div>

        {/* Q5: Pipeline Value */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Pipeline Coverage Ratio <span className="text-muted-foreground font-normal">(30% sub-weight)</span>
          </label>
          <p className="text-[11px] text-muted-foreground mb-2">
            What is the estimated dollar value of qualified pipeline (prospects with identified need, budget, and timeline)?
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">$</span>
            <input type="number" min={0} value={form.pipeline_value}
              onChange={e => set('pipeline_value', e.target.value)}
              placeholder="e.g. 500000"
              className="w-40 text-sm bg-background border border-border rounded-lg px-3 py-1.5 text-muted-foreground placeholder:text-muted-foreground/45 focus:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
            <span className="text-xs text-muted-foreground">qualified pipeline</span>
          </div>
        </div>

        {/* Q6: Market Positioning */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Market Positioning <span className="text-muted-foreground font-normal">(20% sub-weight)</span>
          </label>
          <p className="text-[11px] text-muted-foreground mb-2">
            How would you characterize the company's market positioning?
          </p>
          <div className="space-y-2">
            {MARKET_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => set('market_positioning', opt.value)}
                className={cn('w-full text-left rounded-lg border p-3 transition-all',
                  form.market_positioning === opt.value
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border bg-muted/20 hover:bg-muted/40')}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {form.market_positioning === opt.value
                      ? <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      : <Circle className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />}
                    <span className="text-xs text-foreground">{opt.label}</span>
                  </div>
                  <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded flex-shrink-0',
                    opt.score >= 70 ? 'text-emerald-400 bg-emerald-500/10' :
                    opt.score >= 40 ? 'text-amber-400 bg-amber-500/10' :
                    'text-red-400 bg-red-500/10')}>
                    {opt.score} pts
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Q7: Product Repeatability */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Product/Service Repeatability <span className="text-muted-foreground font-normal">(15% sub-weight)</span>
          </label>
          <p className="text-[11px] text-muted-foreground mb-2">
            What percentage of revenue comes from standardized, repeatable offerings vs. fully custom work?
          </p>
          <div className="space-y-1.5">
            {form.repeatability_pct === null && (
              <p className="text-[11px] text-amber-400 font-medium">Move the slider to set a value — required for section completion</p>
            )}
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>0% — fully custom</span>
              <span className="font-bold text-foreground">{form.repeatability_pct !== null ? `${form.repeatability_pct}%` : '—'}</span>
              <span>100% — fully standardized</span>
            </div>
            <input type="range" min={0} max={100} step={5} value={form.repeatability_pct ?? 50}
              onChange={e => set('repeatability_pct', e.target.value)}
              className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary" />
          </div>
        </div>
      </div>

      {/* Section D: Management & Team */}
      <div className={cn('rounded-xl border border-border bg-card p-5 space-y-5 border-l-2', getDrsCategoryStyle('management_team').accentLine)}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-foreground uppercase tracking-wider">Management &amp; Team</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Maps to DRS category weight: 10% · Blended 60% financial / 40% qualitative when all inputs provided</p>
          </div>
          <div className={cn('flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border',
            a6Complete
              ? cn(getDrsCategoryStyle('management_team').border, getDrsCategoryStyle('management_team').bg, getDrsCategoryStyle('management_team').text)
              : 'border-amber-500/30 bg-amber-500/10 text-amber-400')}>
            {a6Complete ? <CheckCircle className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
            {a6Complete ? 'Complete' : 'Incomplete'}
          </div>
        </div>

        {/* Q8: Non-compete coverage */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Key Person Non-Compete Coverage <span className="text-muted-foreground font-normal">(15% of A6 sub-weight)</span>
          </label>
          <p className="text-[11px] text-muted-foreground mb-2">
            What percentage of key employees (those who would materially impact revenue or operations if they left) have signed non-compete or non-solicitation agreements?
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { value: '0',     label: '0%',       sub: 'No protection' },
              { value: '1-50',  label: '1–50%',    sub: 'Partial coverage' },
              { value: '51-75', label: '51–75%',   sub: 'Moderate' },
              { value: '76-99', label: '76–99%',   sub: 'Strong coverage' },
              { value: '100',   label: '100%',     sub: 'Fully protected' },
            ].map(opt => (
              <button key={opt.value} onClick={() => set('non_compete_pct', opt.value)}
                className={cn('text-left rounded-lg border p-2.5 transition-all',
                  form.non_compete_pct === opt.value
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border bg-muted/20 hover:bg-muted/40')}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  {form.non_compete_pct === opt.value
                    ? <CheckCircle className="w-3 h-3 text-primary flex-shrink-0" />
                    : <Circle className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />}
                  <span className="text-xs font-semibold text-foreground">{opt.label}</span>
                </div>
                <p className="text-[11px] text-muted-foreground pl-4.5">{opt.sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Q9: Voluntary turnover */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Annual Voluntary Turnover Rate <span className="text-muted-foreground font-normal">(15% of A6 sub-weight)</span>
          </label>
          <p className="text-[11px] text-muted-foreground mb-2">
            Over the last 12 months, what was the annual voluntary turnover rate for non-owner employees? (voluntary departures ÷ average headcount)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: '<10',   label: 'Under 10%',   sub: 'Excellent retention', color: 'emerald' },
              { value: '10-15', label: '10–15%',       sub: 'Industry average', color: 'blue' },
              { value: '15-25', label: '15–25%',       sub: 'Elevated — investigate', color: 'amber' },
              { value: '>25',   label: 'Over 25%',    sub: 'High risk signal', color: 'red' },
            ].map(opt => (
              <button key={opt.value} onClick={() => set('voluntary_turnover', opt.value)}
                className={cn('text-left rounded-lg border p-3 transition-all',
                  form.voluntary_turnover === opt.value
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border bg-muted/20 hover:bg-muted/40')}>
                <div className="flex items-center gap-2 mb-0.5">
                  {form.voluntary_turnover === opt.value
                    ? <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    : <Circle className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />}
                  <span className="text-xs font-semibold text-foreground">{opt.label}</span>
                </div>
                <p className="text-[11px] text-muted-foreground pl-5">{opt.sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Q10: Comp vs. market */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Total Compensation vs. Market <span className="text-muted-foreground font-normal">(10% of A6 sub-weight)</span>
          </label>
          <p className="text-[11px] text-muted-foreground mb-2">
            How does total compensation (salary + benefits + incentives) for key roles compare to market rates in the company's geography and industry?
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'below_25',  label: '>25% below market',  sub: 'High flight risk' },
              { value: 'below_15',  label: '15–25% below',       sub: 'Moderate risk' },
              { value: 'within_15', label: 'Within ±15%',        sub: 'Competitive — retentive' },
              { value: 'above',     label: 'Above market',       sub: 'Strong retention signal' },
            ].map(opt => (
              <button key={opt.value} onClick={() => set('comp_vs_market', opt.value)}
                className={cn('text-left rounded-lg border p-3 transition-all',
                  form.comp_vs_market === opt.value
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border bg-muted/20 hover:bg-muted/40')}>
                <div className="flex items-center gap-2 mb-0.5">
                  {form.comp_vs_market === opt.value
                    ? <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    : <Circle className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />}
                  <span className="text-xs font-semibold text-foreground">{opt.label}</span>
                </div>
                <p className="text-[11px] text-muted-foreground pl-5">{opt.sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Optional: CRM pipeline toggle */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Active CRM Pipeline <span className="text-muted-foreground font-normal">(optional — enriches growth signal)</span>
          </label>
          <p className="text-[11px] text-muted-foreground mb-2">
            Does the sales team actively maintain a CRM pipeline with deal stages, estimated values, and expected close dates?
          </p>
          <div className="flex gap-2">
            {[{ v: true, label: 'Yes' }, { v: false, label: 'No' }, { v: null, label: 'Unknown' }].map(opt => (
              <button key={String(opt.v)} onClick={() => set('has_crm_pipeline', opt.v)}
                className={cn('px-4 py-1.5 rounded-lg border text-xs font-semibold transition-all',
                  form.has_crm_pipeline === opt.v
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40')}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity">
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save Qualitative Inputs'}
          </button>
          {saved && (
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
              <CheckCircle className="w-4 h-4" />
              Saved — DRS recomputed
            </div>
          )}
        </div>
        {!allComplete && (
          <p className="text-[11px] text-muted-foreground">
            {[!a3Complete && 'Revenue Contracts', !a4Complete && 'Ops Independence', !a6Complete && 'Management & Team', !a7Complete && 'Growth Drivers']
              .filter(Boolean).join(' · ')} incomplete — finish to activate full qualitative scoring
          </p>
        )}
      </div>

      {/* DRS Diff Panel — shown after save when advisory_delta is available */}
      {drsDiff && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <p className="text-sm font-bold text-foreground">Advisory Input Impact on DRS</p>
            <span className="text-[11px] text-muted-foreground ml-auto">After vs. before qualitative inputs</span>
          </div>

          {/* Headline DRS comparison */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Financial-Only Baseline', drs: drsDiff.baseline, variant: 'muted' },
              { label: 'With Qualitative Inputs', drs: drsDiff.current, variant: 'primary' },
            ].map((col, i) => (
              <div key={i} className={cn('col-span-1 rounded-lg border p-3 text-center',
                col.variant === 'primary' ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/20')}>
                <p className="text-[11px] text-muted-foreground mb-1">{col.label}</p>
                <p className={cn('text-2xl font-black', col.variant === 'primary' ? 'text-primary' : 'text-muted-foreground')}>
                  {col.drs?.base ?? '—'}
                </p>
                {col.drs?.conservative != null && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {col.drs.conservative}–{col.drs.optimistic} range
                  </p>
                )}
                {col.drs?.tier && (
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{col.drs.tier}</span>
                )}
              </div>
            ))}
            {/* Net delta */}
            <div className="col-span-1 rounded-lg border border-dashed border-border p-3 text-center flex flex-col items-center justify-center">
              {(() => {
                const delta = (drsDiff.current?.base ?? 0) - (drsDiff.baseline?.base ?? 0)
                const positive = delta > 0
                const neutral = delta === 0
                return (
                  <>
                    {positive ? <TrendingUp className="w-5 h-5 text-emerald-400 mb-1" />
                      : neutral ? <Minus className="w-5 h-5 text-muted-foreground mb-1" />
                      : <TrendingDown className="w-5 h-5 text-red-400 mb-1" />}
                    <p className={cn('text-xl font-black', positive ? 'text-emerald-400' : neutral ? 'text-muted-foreground' : 'text-red-400')}>
                      {delta > 0 ? '+' : ''}{delta}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Net DRS Lift</p>
                  </>
                )
              })()}
            </div>
          </div>

          {/* Per-category delta */}
          {drsDiff.advisory_delta && Object.keys(drsDiff.advisory_delta).length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Category deltas</p>
              <div className="space-y-1.5">
                {Object.entries(drsDiff.advisory_delta)
                  .filter(([, v]) => v !== 0)
                  .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                  .map(([key, delta]) => {
                    const style = getDrsCategoryStyle(key)
                    const positive = delta > 0
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <div className={cn('w-2 h-2 rounded-full flex-shrink-0', style.dot)} />
                        <span className="text-[11px] text-foreground capitalize flex-1">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span className={cn('text-[11px] font-bold tabular-nums',
                          positive ? 'text-emerald-400' : 'text-red-400')}>
                          {positive ? '+' : ''}{delta.toFixed(1)} pts
                        </span>
                        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full', positive ? 'bg-emerald-500' : 'bg-red-500')}
                            style={{ width: `${Math.min(Math.abs(delta) * 5, 100)}%` }} />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setAuditOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/20 transition-colors"
        >
          <span className="text-sm font-semibold text-foreground flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            Change history
            {auditEntries.length > 0 && (
              <span className="text-[10px] font-normal text-muted-foreground">({auditEntries.length} recent)</span>
            )}
          </span>
          {auditOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </button>
        {auditOpen && (
          <div className="px-4 pb-4 border-t border-border pt-3 space-y-2 text-[11px] text-muted-foreground max-h-72 overflow-y-auto">
            {auditEntries.length === 0 && <p>No saved versions yet — history is recorded each time you save.</p>}
            {auditEntries.map(e => (
              <div key={e.id} className="rounded-lg border border-border/80 bg-muted/10 p-2">
                <p className="text-[10px] font-semibold text-foreground mb-1">
                  {e.created_at ? new Date(e.created_at).toLocaleString() : '—'}
                </p>
                <pre className={cn('text-[10px] font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto text-muted-foreground')}>
                  {JSON.stringify(e.snapshot ?? {}, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
