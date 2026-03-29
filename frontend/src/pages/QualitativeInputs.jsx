import { useState, useEffect } from 'react'
import SectionHeader from '../components/ui/SectionHeader'
import { cn } from '../lib/utils'
import { CheckCircle, Circle, Save, ClipboardList, ChevronDown, ChevronRight, History } from 'lucide-react'
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
    sop_pct: 50,
    automation_pct: 30,
    mgmt_qualified: 0,
    mgmt_total_functions: 4,
    pipeline_value: '',
    market_positioning: '',
    repeatability_pct: 50,
    contract_pct: 50,
    customer_contract_type: '',
    key_person_revenue_pct: 50,
  })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [auditEntries, setAuditEntries] = useState([])

  useEffect(() => {
    apiClient.get(`/api/analytics/qualitative/${companyId}`)
      .then(d => {
        if (d?.inputs) {
          setForm({
            owner_hours_per_week:   d.inputs.owner_hours_per_week ?? '',
            sop_pct:                d.inputs.sop_pct ?? 50,
            automation_pct:         d.inputs.automation_pct ?? 30,
            mgmt_qualified:         d.inputs.mgmt_qualified ?? 0,
            mgmt_total_functions:   d.inputs.mgmt_total_functions ?? 4,
            pipeline_value:         d.inputs.pipeline_value ?? '',
            market_positioning:     d.inputs.market_positioning ?? '',
            repeatability_pct:      d.inputs.repeatability_pct ?? 50,
            contract_pct:           d.inputs.contract_pct ?? 50,
            customer_contract_type: d.inputs.customer_contract_type ?? '',
            key_person_revenue_pct: d.inputs.key_person_revenue_pct ?? 50,
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

  const a4Complete = form.owner_hours_per_week !== ''
  // Sliders default to numeric values, so only the explicit-choice field gates completion
  const a3Complete = form.customer_contract_type !== ''
  const a7Complete = form.pipeline_value !== '' && form.market_positioning !== '' && form.repeatability_pct !== ''
  const allComplete = a4Complete && a3Complete && a7Complete

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        owner_hours_per_week:   form.owner_hours_per_week !== '' ? Number(form.owner_hours_per_week) : null,
        sop_pct:                Number(form.sop_pct),
        automation_pct:         Number(form.automation_pct),
        mgmt_qualified:         form.mgmt_qualified !== '' ? Number(form.mgmt_qualified) : null,
        mgmt_total_functions:   form.mgmt_total_functions !== '' ? Number(form.mgmt_total_functions) : null,
        pipeline_value:         form.pipeline_value !== '' ? Number(form.pipeline_value) : null,
        market_positioning:     form.market_positioning || null,
        repeatability_pct:      Number(form.repeatability_pct),
        contract_pct:           Number(form.contract_pct),
        customer_contract_type: form.customer_contract_type || null,
        key_person_revenue_pct: Number(form.key_person_revenue_pct),
      }
      await apiClient.post(`/api/analytics/qualitative/${companyId}`, payload)
      setSaved(true)
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
        subtitle="Advisor-sourced data for sub-scores that financial data cannot capture. These inputs feed directly into Operational Independence and Growth Drivers scoring."
        action={
          <div className="flex items-center gap-2">
            <StatusBadge complete={a3Complete} label="Rev Contracts" categoryKey="revenue_quality" />
            <StatusBadge complete={a4Complete} label="Ops Independence" categoryKey="operational_independence" />
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
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>0% — all handshake / verbal</span>
              <span className="font-bold text-foreground">{form.contract_pct}%</span>
              <span>100% — fully contracted</span>
            </div>
            <input type="range" min={0} max={100} step={5} value={form.contract_pct}
              onChange={e => set('contract_pct', e.target.value)}
              className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary" />
            {form.contract_pct !== '' && (
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
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>0% — no personal dependency</span>
              <span className="font-bold text-foreground">{form.key_person_revenue_pct}%</span>
              <span>100% — fully owner-dependent</span>
            </div>
            <input type="range" min={0} max={100} step={5} value={form.key_person_revenue_pct}
              onChange={e => set('key_person_revenue_pct', e.target.value)}
              className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary" />
            {form.key_person_revenue_pct !== '' && (
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
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>0% — none documented</span>
              <span className="font-bold text-foreground">{form.sop_pct}%</span>
              <span>100% — fully documented</span>
            </div>
            <input type="range" min={0} max={100} step={5} value={form.sop_pct}
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
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>0% — fully manual</span>
              <span className="font-bold text-foreground">{form.automation_pct}%</span>
              <span>100% — fully automated</span>
            </div>
            <input type="range" min={0} max={100} step={5} value={form.automation_pct}
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
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>0% — fully custom</span>
              <span className="font-bold text-foreground">{form.repeatability_pct}%</span>
              <span>100% — fully standardized</span>
            </div>
            <input type="range" min={0} max={100} step={5} value={form.repeatability_pct}
              onChange={e => set('repeatability_pct', e.target.value)}
              className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary" />
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
              Saved — DRS will recompute on next page load
            </div>
          )}
        </div>
        {!allComplete && (
          <p className="text-[11px] text-muted-foreground">
            {[!a3Complete && 'Revenue Contracts', !a4Complete && 'Operational Independence', !a7Complete && 'Growth Drivers']
              .filter(Boolean).join(' · ')} incomplete — finish to activate full qualitative scoring
          </p>
        )}
      </div>

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
