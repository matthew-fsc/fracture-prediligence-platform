import { useState, useEffect } from 'react'
import SectionHeader from '../components/ui/SectionHeader'
import { cn } from '../lib/utils'
import { CheckCircle, Circle, Save, ClipboardList } from 'lucide-react'

const COMPANY_ID = 1

const MARKET_OPTIONS = [
  { value: 'defined',          label: 'Defined ICP + clear differentiation + repeatable sales motion', score: 80 },
  { value: 'moderate',         label: 'Moderate positioning — some differentiation, inconsistent execution', score: 45 },
  { value: 'undifferentiated', label: 'Undifferentiated or unclear — competing on price/availability', score: 10 },
]

export default function QualitativeInputs() {
  const [form, setForm] = useState({
    owner_hours_per_week: '',
    sop_pct: 50,
    automation_pct: 30,
    mgmt_qualified: '',
    mgmt_total_functions: '',
    pipeline_value: '',
    market_positioning: '',
    repeatability_pct: 50,
  })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`/api/analytics/qualitative/${COMPANY_ID}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.inputs) {
          setForm({
            owner_hours_per_week: d.inputs.owner_hours_per_week ?? '',
            sop_pct:              d.inputs.sop_pct ?? 50,
            automation_pct:       d.inputs.automation_pct ?? 30,
            mgmt_qualified:       d.inputs.mgmt_qualified ?? '',
            mgmt_total_functions: d.inputs.mgmt_total_functions ?? '',
            pipeline_value:       d.inputs.pipeline_value ?? '',
            market_positioning:   d.inputs.market_positioning ?? '',
            repeatability_pct:    d.inputs.repeatability_pct ?? 50,
          })
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setSaved(false) }

  const a4Complete = form.owner_hours_per_week !== '' && form.sop_pct !== '' &&
    form.automation_pct !== '' && form.mgmt_qualified !== '' && form.mgmt_total_functions !== ''
  const a7Complete = form.pipeline_value !== '' && form.market_positioning !== '' && form.repeatability_pct !== ''
  const allComplete = a4Complete && a7Complete

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        owner_hours_per_week:  form.owner_hours_per_week !== '' ? Number(form.owner_hours_per_week) : null,
        sop_pct:               Number(form.sop_pct),
        automation_pct:        Number(form.automation_pct),
        mgmt_qualified:        form.mgmt_qualified !== '' ? Number(form.mgmt_qualified) : null,
        mgmt_total_functions:  form.mgmt_total_functions !== '' ? Number(form.mgmt_total_functions) : null,
        pipeline_value:        form.pipeline_value !== '' ? Number(form.pipeline_value) : null,
        market_positioning:    form.market_positioning || null,
        repeatability_pct:     Number(form.repeatability_pct),
      }
      await fetch(`/api/analytics/qualitative/${COMPANY_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setSaved(true)
    } finally { setSaving(false) }
  }

  const StatusBadge = ({ complete, label }) => (
    <div className={cn('flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border',
      complete ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-400')}>
      {complete ? <CheckCircle className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
      {label}: {complete ? 'Complete' : 'Incomplete'}
    </div>
  )

  if (!loaded) return <div className="space-y-4 max-w-[900px]"><div className="h-8 w-64 bg-muted rounded animate-pulse" /></div>

  return (
    <div className="space-y-6 max-w-[900px]">
      <SectionHeader
        title="Qualitative Inputs"
        subtitle="Advisor-sourced data for sub-scores that financial data cannot capture. These inputs feed directly into Operational Independence and Growth Drivers scoring."
        action={
          <div className="flex items-center gap-2">
            <StatusBadge complete={a4Complete} label="Ops Independence" />
            <StatusBadge complete={a7Complete} label="Growth Drivers" />
          </div>
        }
      />

      <div className="rounded-xl border border-border bg-card/50 p-4 text-[11px] text-muted-foreground flex items-start gap-2">
        <ClipboardList className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
        <p>These questions replace conservative default assumptions used when qualitative data is absent. When all inputs in a section are complete, the DRS automatically recomputes using the qualitative sub-scores. Inputs are saved per engagement.</p>
      </div>

      {/* Section A: Operational Independence */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-foreground uppercase tracking-wider">Operational Independence</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Maps to DRS category weight: 20% · Sub-score weights: owner hours 35%, SOPs 30%, automation 15%, management depth 20%</p>
          </div>
          <div className={cn('flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border',
            a4Complete ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-400')}>
            {a4Complete ? <CheckCircle className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
            {a4Complete ? 'Complete' : 'Incomplete'}
          </div>
        </div>

        {/* Q1: Owner Hours */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Owner Hours in Operations <span className="text-muted-foreground font-normal">(35% sub-weight)</span>
          </label>
          <p className="text-[10px] text-muted-foreground mb-2">
            On average, how many hours per week does the owner spend in day-to-day operations — not strategy, not external?
          </p>
          <div className="flex items-center gap-3">
            <input type="number" min={0} max={80} value={form.owner_hours_per_week}
              onChange={e => set('owner_hours_per_week', e.target.value)}
              placeholder="e.g. 30"
              className="w-24 text-sm bg-background border border-border rounded-lg px-3 py-1.5 text-foreground" />
            <span className="text-xs text-muted-foreground">hours / week</span>
            {form.owner_hours_per_week !== '' && (
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded border',
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
          <p className="text-[10px] text-muted-foreground mb-2">
            What percentage of core operational processes have written SOPs? (onboarding, service delivery, account management, billing)
          </p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-muted-foreground">
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
          <p className="text-[10px] text-muted-foreground mb-2">
            What percentage of repetitive operational tasks (invoicing, reporting, scheduling) are handled by a system rather than a person?
          </p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-muted-foreground">
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
          <p className="text-[10px] text-muted-foreground mb-2">
            How many of the company's core business functions (sales, delivery, finance, operations) have a qualified manager who could run that function without the owner?
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={10} value={form.mgmt_qualified}
                onChange={e => set('mgmt_qualified', e.target.value)}
                placeholder="0"
                className="w-16 text-sm bg-background border border-border rounded-lg px-2 py-1.5 text-foreground text-center" />
              <span className="text-xs text-muted-foreground">qualified</span>
              <span className="text-xs text-muted-foreground">/</span>
              <input type="number" min={1} max={10} value={form.mgmt_total_functions}
                onChange={e => set('mgmt_total_functions', e.target.value)}
                placeholder="4"
                className="w-16 text-sm bg-background border border-border rounded-lg px-2 py-1.5 text-foreground text-center" />
              <span className="text-xs text-muted-foreground">total functions</span>
            </div>
            {form.mgmt_qualified !== '' && form.mgmt_total_functions !== '' && Number(form.mgmt_total_functions) > 0 && (
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded border',
                Number(form.mgmt_qualified)/Number(form.mgmt_total_functions) >= 0.75 ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10' :
                Number(form.mgmt_qualified)/Number(form.mgmt_total_functions) >= 0.50 ? 'border-amber-500/20 text-amber-400 bg-amber-500/10' :
                'border-red-500/20 text-red-400 bg-red-500/10')}>
                {Math.round(Number(form.mgmt_qualified)/Number(form.mgmt_total_functions)*100)}% coverage
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Section B: Growth Drivers */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-foreground uppercase tracking-wider">Growth Drivers</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Maps to DRS category weight: 10% · Sub-score weights: pipeline 30%, market positioning 20%, repeatability 15% (CAGR 35% from financial data)</p>
          </div>
          <div className={cn('flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border',
            a7Complete ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-400')}>
            {a7Complete ? <CheckCircle className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
            {a7Complete ? 'Complete' : 'Incomplete'}
          </div>
        </div>

        {/* Q5: Pipeline Value */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Pipeline Coverage Ratio <span className="text-muted-foreground font-normal">(30% sub-weight)</span>
          </label>
          <p className="text-[10px] text-muted-foreground mb-2">
            What is the estimated dollar value of qualified pipeline (prospects with identified need, budget, and timeline)?
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">$</span>
            <input type="number" min={0} value={form.pipeline_value}
              onChange={e => set('pipeline_value', e.target.value)}
              placeholder="e.g. 500000"
              className="w-40 text-sm bg-background border border-border rounded-lg px-3 py-1.5 text-foreground" />
            <span className="text-xs text-muted-foreground">qualified pipeline</span>
          </div>
        </div>

        {/* Q6: Market Positioning */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Market Positioning <span className="text-muted-foreground font-normal">(20% sub-weight)</span>
          </label>
          <p className="text-[10px] text-muted-foreground mb-2">
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
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0',
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
          <p className="text-[10px] text-muted-foreground mb-2">
            What percentage of revenue comes from standardized, repeatable offerings vs. fully custom work?
          </p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-muted-foreground">
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
        {!allComplete && (
          <p className="text-[10px] text-muted-foreground">
            {!a4Complete && !a7Complete ? 'Complete all inputs to activate qualitative scoring' :
             !a4Complete ? 'Complete Operational Independence inputs to activate that section' :
             'Complete Growth Drivers inputs to activate that section'}
          </p>
        )}
      </div>
    </div>
  )
}
