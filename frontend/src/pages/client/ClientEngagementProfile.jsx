/**
 * ClientEngagementProfile — business owner fills in their exit goals and preferences.
 *
 * This is the client-facing counterpart to the advisor's EngagementIntake page.
 * Clients can view and update their own goals, timeline, motivations, and post-exit plans.
 * The data is shared with the advisor and influences the engagement strategy.
 */

import { useState, useEffect } from 'react'
import {
  NotebookPen, Save, CheckCircle, Clock, DollarSign,
  Target, Users, Briefcase, TrendingUp, ChevronDown,
} from 'lucide-react'
import { apiClient } from '../../lib/apiClient'
import { toast } from '../../lib/notify'
import { cn } from '../../lib/utils'
import { Skeleton } from '../../components/ui/Skeleton'
import { useUserRole } from '../../context/UserRoleContext'
import { usePageTitle } from '../../hooks/usePageTitle'
import SectionHeader from '../../components/ui/SectionHeader'

const TX_TYPES = [
  { value: '',                  label: '— Select —' },
  { value: 'strategic_sale',    label: 'Strategic sale' },
  { value: 'esop',              label: 'ESOP' },
  { value: 'mbo',               label: 'Management buyout (MBO)' },
  { value: 'recapitalization',  label: 'Recapitalization' },
  { value: 'other',             label: 'Other / undecided' },
]

const BUYER_TYPES = [
  { id: 'PE',         label: 'Private equity',                   desc: 'Institutional financial sponsors' },
  { id: 'Strategic',  label: 'Strategic / trade buyer',          desc: 'Industry acquirers seeking synergy' },
  { id: 'Financial',  label: 'Independent sponsor / search fund', desc: 'Funded search or family office' },
]

const TIMELINE_PRESETS = [
  '6–12 months',
  '12–18 months',
  '18–24 months',
  '24–36 months',
  '36+ months (long horizon)',
]

const OWNER_MOTIVATIONS = [
  { id: 'maximize_proceeds',  label: 'Maximize after-tax proceeds' },
  { id: 'preserve_culture',   label: 'Preserve company culture' },
  { id: 'protect_employees',  label: 'Protect employee jobs' },
  { id: 'family_successor',   label: 'Keep in family / select successor' },
  { id: 'speed_of_close',     label: 'Speed of transaction' },
  { id: 'earn_out_upside',    label: 'Participate in post-close upside' },
  { id: 'retain_management',  label: 'Retain existing management team' },
  { id: 'geographic_presence', label: 'Maintain local / geographic presence' },
]

const POST_EXIT_OPTIONS = [
  { value: 'retire',       label: 'Retire' },
  { value: 'new_venture',  label: 'Start a new venture' },
  { value: 'stay_advisor', label: 'Stay on as advisor / board member' },
  { value: 'consulting',   label: 'Independent consulting' },
  { value: 'undecided',    label: 'Undecided' },
]

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12px] font-semibold text-card-foreground">
        {label}
        {hint && <span className="ml-2 text-[11px] font-normal text-muted-foreground">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

export default function ClientEngagementProfile() {
  usePageTitle('My Goals & Exit Profile')
  const { clientCompany } = useUserRole()
  const companyId = clientCompany?.id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [form, setForm] = useState({
    owner_goals_narrative: '',
    exit_timeline: '',
    target_valuation: '',
    personal_financial_gap: '',
    transaction_type: '',
    buyer_universe_notes: '',
    preferred_buyer_types: [],
    owner_motivations: [],
    post_exit_plans: '',
    non_negotiables: '',
  })

  useEffect(() => {
    if (!companyId) return
    apiClient.get(`/api/analytics/engagement-profile/${companyId}`)
      .then((data) => {
        if (!data) return
        setForm({
          owner_goals_narrative:  data.owner_goals_narrative ?? '',
          exit_timeline:          data.exit_timeline ?? '',
          target_valuation:       data.target_valuation != null ? String(data.target_valuation) : '',
          personal_financial_gap: data.personal_financial_gap != null ? String(data.personal_financial_gap) : '',
          transaction_type:       data.transaction_type ?? '',
          buyer_universe_notes:   data.buyer_universe_notes ?? '',
          preferred_buyer_types:  data.preferred_buyer_types_json ? JSON.parse(data.preferred_buyer_types_json) : [],
          owner_motivations:      data.owner_motivations_json ? JSON.parse(data.owner_motivations_json) : [],
          post_exit_plans:        data.post_exit_plans ?? '',
          non_negotiables:        data.non_negotiables ?? '',
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [companyId])

  function toggle(field, value) {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(value)
        ? f[field].filter((v) => v !== value)
        : [...f[field], value],
    }))
  }

  async function handleSave() {
    if (!companyId) return
    setSaving(true)
    try {
      await apiClient.patch(`/api/analytics/engagement-profile/${companyId}`, {
        owner_goals_narrative:      form.owner_goals_narrative || null,
        exit_timeline:              form.exit_timeline || null,
        target_valuation:           form.target_valuation ? parseFloat(form.target_valuation) : null,
        personal_financial_gap:     form.personal_financial_gap ? parseFloat(form.personal_financial_gap) : null,
        transaction_type:           form.transaction_type || null,
        buyer_universe_notes:       form.buyer_universe_notes || null,
        preferred_buyer_types_json: JSON.stringify(form.preferred_buyer_types),
        owner_motivations_json:     JSON.stringify(form.owner_motivations),
        post_exit_plans:            form.post_exit_plans || null,
        non_negotiables:            form.non_negotiables || null,
      })
      setSaved(true)
      toast.success('Profile saved')
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      toast.error(err?.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <SectionHeader
        icon={<NotebookPen className="w-5 h-5" />}
        title="My Goals & Exit Profile"
        subtitle="Share your objectives, timeline, and preferences to help your advisor tailor the engagement."
      />

      {/* ── Goals narrative ─────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" /> My Goals
        </h3>
        <Field label="What are you hoping to achieve?" hint="In your own words">
          <textarea
            value={form.owner_goals_narrative}
            onChange={(e) => setForm((f) => ({ ...f, owner_goals_narrative: e.target.value }))}
            rows={4}
            className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            placeholder="Describe what a successful outcome looks like to you…"
          />
        </Field>
        <Field label="Non-negotiables" hint="Things that must be true for you to move forward">
          <textarea
            value={form.non_negotiables}
            onChange={(e) => setForm((f) => ({ ...f, non_negotiables: e.target.value }))}
            rows={2}
            className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            placeholder="e.g., must keep local jobs, no all-cash deal only…"
          />
        </Field>
      </div>

      {/* ── Timeline & Valuation ─────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" /> Timeline & Valuation
        </h3>
        <Field label="Target Exit Timeline">
          <div className="flex flex-wrap gap-2">
            {TIMELINE_PRESETS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, exit_timeline: f.exit_timeline === t ? '' : t }))}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-full border transition-colors',
                  form.exit_timeline === t
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/20 hover:text-card-foreground',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Target Valuation" hint="Optional">
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="number"
                value={form.target_valuation}
                onChange={(e) => setForm((f) => ({ ...f, target_valuation: e.target.value }))}
                className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="e.g. 5000000"
              />
            </div>
          </Field>
          <Field label="Personal Financial Gap" hint="How much do you need?">
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="number"
                value={form.personal_financial_gap}
                onChange={(e) => setForm((f) => ({ ...f, personal_financial_gap: e.target.value }))}
                className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="e.g. 3500000"
              />
            </div>
          </Field>
        </div>
      </div>

      {/* ── Transaction & Buyer preferences ─────────────────────── */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-blue-400" /> Transaction Preferences
        </h3>
        <Field label="Transaction Type">
          <div className="relative">
            <select
              value={form.transaction_type}
              onChange={(e) => setForm((f) => ({ ...f, transaction_type: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {TX_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </Field>
        <Field label="Preferred Buyer Types">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {BUYER_TYPES.map(({ id, label, desc }) => {
              const active = form.preferred_buyer_types.includes(id)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle('preferred_buyer_types', id)}
                  className={cn(
                    'text-left rounded-lg border p-3 transition-colors',
                    active
                      ? 'bg-primary/10 border-primary/30'
                      : 'border-border hover:border-primary/20',
                  )}
                >
                  <p className={cn('text-[12px] font-semibold', active ? 'text-primary' : 'text-card-foreground')}>{label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
                </button>
              )
            })}
          </div>
        </Field>
        <Field label="Notes on ideal buyer" hint="Optional">
          <textarea
            value={form.buyer_universe_notes}
            onChange={(e) => setForm((f) => ({ ...f, buyer_universe_notes: e.target.value }))}
            rows={2}
            className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            placeholder="e.g., prefer a buyer who will keep the team intact…"
          />
        </Field>
      </div>

      {/* ── Motivations & post-exit ──────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" /> Motivations & Post-Exit
        </h3>
        <Field label="What matters most to you?">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {OWNER_MOTIVATIONS.map(({ id, label }) => {
              const active = form.owner_motivations.includes(id)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle('owner_motivations', id)}
                  className={cn(
                    'text-left flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors text-[12px]',
                    active
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/20 hover:text-card-foreground',
                  )}
                >
                  <div className={cn('w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center', active ? 'bg-primary border-primary' : 'border-muted-foreground/40')}>
                    {active && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                  {label}
                </button>
              )
            })}
          </div>
        </Field>
        <Field label="What do you plan to do after the sale?">
          <div className="flex flex-wrap gap-2">
            {POST_EXIT_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, post_exit_plans: f.post_exit_plans === value ? '' : value }))}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-full border transition-colors',
                  form.post_exit_plans === value
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/20 hover:text-card-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
      </div>

      {/* ── Save ─────────────────────────────────────────────────── */}
      <div className="flex justify-end pb-8">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors',
            saved
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-primary text-primary-foreground hover:bg-primary/90',
          )}
        >
          {saved ? (
            <><CheckCircle className="w-4 h-4" /> Saved</>
          ) : saving ? (
            'Saving…'
          ) : (
            <><Save className="w-4 h-4" /> Save Profile</>
          )}
        </button>
      </div>
    </div>
  )
}
