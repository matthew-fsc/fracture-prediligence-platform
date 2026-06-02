/**
 * OwnerOnboardingWizard — guided 3-step wizard for business owners.
 *
 * Step 1: About Your Business (company basics)
 * Step 2: Your Exit Goals (engagement profile)
 * Step 3: All set — what to expect + optional document upload prompt
 *
 * Accessible at /owner-onboarding (requires CLIENT role).
 * On completion, marks owner_onboarding_completed_at and redirects to /client/dashboard.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, Target, CheckCircle, ArrowRight, ArrowLeft,
  DollarSign, Clock, Briefcase, TrendingUp, ChevronDown,
  Save, RefreshCw, Upload, Folder,
} from 'lucide-react'
import { apiClient, ApiError } from '../../lib/apiClient'
import { toast } from '../../lib/notify'
import { cn } from '../../lib/utils'
import { useUserRole } from '../../context/UserRoleContext'
import { usePageTitle } from '../../hooks/usePageTitle'

// ── Shared constants (same as ClientEngagementProfile) ─────────────────────

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
  { id: 'maximize_proceeds',   label: 'Maximize after-tax proceeds' },
  { id: 'preserve_culture',    label: 'Preserve company culture' },
  { id: 'protect_employees',   label: 'Protect employee jobs' },
  { id: 'family_successor',    label: 'Keep in family / select successor' },
  { id: 'speed_of_close',      label: 'Speed of transaction' },
  { id: 'earn_out_upside',     label: 'Participate in post-close upside' },
  { id: 'retain_management',   label: 'Retain existing management team' },
  { id: 'geographic_presence', label: 'Maintain local / geographic presence' },
]

const POST_EXIT_OPTIONS = [
  { value: 'retire',       label: 'Retire' },
  { value: 'new_venture',  label: 'Start a new venture' },
  { value: 'stay_advisor', label: 'Stay on as advisor / board member' },
  { value: 'consulting',   label: 'Independent consulting' },
  { value: 'undecided',    label: 'Undecided' },
]

const INDUSTRIES = [
  { value: 'technology',            label: 'Technology / Software' },
  { value: 'manufacturing',         label: 'Manufacturing' },
  { value: 'healthcare',            label: 'Healthcare' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'retail',                label: 'Retail' },
  { value: 'construction',          label: 'Construction' },
  { value: 'financial_services',    label: 'Financial Services' },
  { value: 'distribution',          label: 'Distribution / Wholesale' },
  { value: 'food_beverage',         label: 'Food & Beverage' },
  { value: 'real_estate',           label: 'Real Estate' },
  { value: 'education',             label: 'Education' },
  { value: 'media_entertainment',   label: 'Media & Entertainment' },
  { value: 'transportation',        label: 'Transportation / Logistics' },
  { value: 'energy',                label: 'Energy / Utilities' },
  { value: 'agriculture',           label: 'Agriculture' },
  { value: 'other',                 label: 'Other' },
]

const ENTITY_TYPES = ['LLC', 'S-Corp', 'C-Corp', 'Sole Proprietorship', 'Partnership', 'Other']

const STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

// ── Reusable Field wrapper ─────────────────────────────────────────────────

function Field({ label, hint, required, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12px] font-semibold text-card-foreground">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
        {hint && <span className="ml-2 text-[11px] font-normal text-muted-foreground">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

// ── Step progress bar ──────────────────────────────────────────────────────

function StepBar({ step, total }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 flex-1 rounded-full transition-colors duration-300',
            i < step ? 'bg-primary' : i === step ? 'bg-primary/50' : 'bg-muted',
          )}
        />
      ))}
    </div>
  )
}

// ── Step 1: Company Basics ─────────────────────────────────────────────────

function StepBasics({ companyId, companyName, form, setForm, onNext, saving }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-card-foreground flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          Tell us about your business
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Basic details help us tailor the readiness analysis to your industry and structure.
        </p>
      </div>

      {/* Company name — readonly */}
      <Field label="Company name">
        <div className="bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-sm text-muted-foreground">
          {companyName}
        </div>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Industry */}
        <Field label="Industry" required>
          <div className="relative">
            <select
              value={form.industry}
              onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">— Select industry —</option>
              {INDUSTRIES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </Field>

        {/* Entity type */}
        <Field label="Business structure">
          <div className="relative">
            <select
              value={form.entity_type}
              onChange={(e) => setForm((f) => ({ ...f, entity_type: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">— Select —</option>
              {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </Field>

        {/* Founded */}
        <Field label="Year founded">
          <input
            type="number"
            value={form.founded}
            onChange={(e) => setForm((f) => ({ ...f, founded: e.target.value }))}
            placeholder="e.g. 2008"
            min="1800"
            max={new Date().getFullYear()}
            className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>

        {/* State */}
        <Field label="State">
          <div className="relative">
            <select
              value={form.state}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">— Select state —</option>
              {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </Field>
      </div>

      {/* Headcount */}
      <Field label="Total full-time employees (approx)">
        <input
          type="number"
          value={form.total_headcount}
          onChange={(e) => setForm((f) => ({ ...f, total_headcount: e.target.value }))}
          placeholder="e.g. 42"
          min="1"
          className="w-full sm:w-48 bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </Field>

      {/* Business description */}
      <Field label="What does your business do?" hint="Optional — 1-2 sentences">
        <textarea
          value={form.business_description}
          onChange={(e) => setForm((f) => ({ ...f, business_description: e.target.value }))}
          rows={3}
          className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          placeholder="e.g. We provide cloud-based HR software to mid-market manufacturers…"
        />
      </Field>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onNext}
          disabled={saving || !form.industry}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
          Next: Exit Goals
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Step 2: Exit Goals ─────────────────────────────────────────────────────

function StepGoals({ form, setForm, onNext, onBack, saving }) {
  function toggle(field, value) {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(value)
        ? f[field].filter((v) => v !== value)
        : [...f[field], value],
    }))
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-card-foreground flex items-center gap-2">
          <Target className="w-5 h-5 text-amber-400" />
          Your exit goals
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          This information is shared directly with your advisor to shape the engagement strategy.
        </p>
      </div>

      {/* Goals narrative */}
      <Field label="What does a successful exit look like to you?" hint="In your own words">
        <textarea
          value={form.owner_goals_narrative}
          onChange={(e) => setForm((f) => ({ ...f, owner_goals_narrative: e.target.value }))}
          rows={4}
          className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          placeholder="Describe what a successful outcome looks like to you…"
        />
      </Field>

      {/* Timeline */}
      <Field label="Target exit timeline">
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

      {/* Valuation + Financial Gap */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Target valuation" hint="Optional">
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
        <Field label="Personal financial need" hint="How much do you need net?">
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

      {/* Transaction type */}
      <Field label="Preferred transaction type">
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

      {/* Buyer types */}
      <Field label="Preferred buyer types">
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
                  active ? 'bg-primary/10 border-primary/30' : 'border-border hover:border-primary/20',
                )}
              >
                <p className={cn('text-[12px] font-semibold', active ? 'text-primary' : 'text-card-foreground')}>{label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
              </button>
            )
          })}
        </div>
      </Field>

      {/* Motivations */}
      <Field label="What matters most to you in the transaction?">
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
                  {active && (
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                      <path d="M1 3L3 5L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                {label}
              </button>
            )
          })}
        </div>
      </Field>

      {/* Post-exit plans */}
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

      {/* Non-negotiables */}
      <Field label="Non-negotiables" hint="Things that must be true for you to move forward">
        <textarea
          value={form.non_negotiables}
          onChange={(e) => setForm((f) => ({ ...f, non_negotiables: e.target.value }))}
          rows={2}
          className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          placeholder="e.g. Must keep local jobs, prefer no all-cash deal…"
        />
      </Field>

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-card-foreground hover:bg-muted/30 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
          Save & Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Step 3: All Done ───────────────────────────────────────────────────────

function StepDone({ companyName, onGoToDashboard }) {
  return (
    <div className="space-y-6 text-center py-4">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </div>
      </div>
      <div>
        <h2 className="text-xl font-bold text-card-foreground">You're all set!</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
          Your information has been saved and shared with your advisor.
          They'll use it to build your exit-readiness analysis.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left max-w-lg mx-auto">
        {[
          {
            icon: TrendingUp,
            color: 'text-emerald-400',
            title: 'Readiness Score',
            desc: 'See how your business scores across 6 diligence categories',
          },
          {
            icon: DollarSign,
            color: 'text-primary',
            title: 'Valuation Range',
            desc: 'Get an enterprise value estimate based on your financials',
          },
          {
            icon: Folder,
            color: 'text-purple-400',
            title: 'Documents',
            desc: 'Upload or access financial documents your advisor has shared',
          },
        ].map(({ icon: Icon, color, title, desc }) => (
          <div key={title} className="bg-muted/20 rounded-lg border border-border p-3 space-y-1">
            <Icon className={cn('w-4 h-4 mb-1', color)} />
            <p className="text-[12px] font-semibold text-card-foreground">{title}</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onGoToDashboard}
        className="inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
      >
        Go to My Dashboard
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// ── Main wizard component ──────────────────────────────────────────────────

const STEPS = ['Business', 'Goals', 'Done']

export default function OwnerOnboardingWizard() {
  usePageTitle('Business Onboarding')
  const navigate = useNavigate()
  const { clientCompany, refreshProfile } = useUserRole()
  const companyId = clientCompany?.id

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Step 1: company basics
  const [basics, setBasics] = useState({
    industry: '',
    founded: '',
    state: '',
    entity_type: '',
    total_headcount: '',
    business_description: '',
  })

  // Step 2: exit goals
  const [goals, setGoals] = useState({
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

  // Load existing data on mount
  useEffect(() => {
    if (!companyId) return
    Promise.all([
      apiClient.get(`/api/owner-onboarding/${companyId}`).catch(() => null),
      apiClient.get(`/api/analytics/engagement-profile/${companyId}`).catch(() => null),
    ]).then(([company, profile]) => {
      if (company) {
        setBasics({
          industry:             company.industry ?? '',
          founded:              company.founded ?? '',
          state:                company.state ?? '',
          entity_type:          company.entity_type ?? '',
          total_headcount:      company.total_headcount ?? '',
          business_description: '',
        })
        // If already complete, skip to done
        if (company.onboarding_complete) {
          setStep(2)
        }
      }
      if (profile) {
        setGoals({
          owner_goals_narrative:  profile.owner_goals_narrative ?? '',
          exit_timeline:          profile.exit_timeline ?? '',
          target_valuation:       profile.target_valuation != null ? String(profile.target_valuation) : '',
          personal_financial_gap: profile.personal_financial_gap != null ? String(profile.personal_financial_gap) : '',
          transaction_type:       profile.transaction_type ?? '',
          buyer_universe_notes:   profile.buyer_universe_notes ?? '',
          preferred_buyer_types:  profile.preferred_buyer_types_json ? JSON.parse(profile.preferred_buyer_types_json) : [],
          owner_motivations:      profile.owner_motivations_json ? JSON.parse(profile.owner_motivations_json) : [],
          post_exit_plans:        profile.post_exit_plans ?? '',
          non_negotiables:        profile.non_negotiables ?? '',
        })
      }
    }).finally(() => setLoading(false))
  }, [companyId])

  async function saveBasics() {
    setSaving(true)
    try {
      const payload = {}
      if (basics.industry)            payload.industry = basics.industry
      if (basics.founded)             payload.founded = parseInt(basics.founded, 10)
      if (basics.state)               payload.state = basics.state
      if (basics.entity_type)         payload.entity_type = basics.entity_type
      if (basics.total_headcount)     payload.total_headcount = parseInt(basics.total_headcount, 10)
      if (basics.business_description) payload.business_description = basics.business_description

      await apiClient.patch(`/api/owner-onboarding/${companyId}/company`, payload)
      setStep(1)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save business details')
    } finally {
      setSaving(false)
    }
  }

  async function saveGoals() {
    setSaving(true)
    try {
      await apiClient.patch(`/api/analytics/engagement-profile/${companyId}`, {
        owner_goals_narrative:      goals.owner_goals_narrative || null,
        exit_timeline:              goals.exit_timeline || null,
        target_valuation:           goals.target_valuation ? parseFloat(goals.target_valuation) : null,
        personal_financial_gap:     goals.personal_financial_gap ? parseFloat(goals.personal_financial_gap) : null,
        transaction_type:           goals.transaction_type || null,
        buyer_universe_notes:       goals.buyer_universe_notes || null,
        preferred_buyer_types_json: JSON.stringify(goals.preferred_buyer_types),
        owner_motivations_json:     JSON.stringify(goals.owner_motivations),
        post_exit_plans:            goals.post_exit_plans || null,
        non_negotiables:            goals.non_negotiables || null,
      })
      // Mark onboarding complete
      await apiClient.post(`/api/owner-onboarding/${companyId}/complete`)
      setStep(2)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save goals')
    } finally {
      setSaving(false)
    }
  }

  function goToDashboard() {
    refreshProfile?.()
    navigate('/client/dashboard')
  }

  if (!companyId || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start px-4 py-10">
      {/* Card */}
      <div className="w-full max-w-2xl">
        {/* Logo / title */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary mb-3">
            <span className="text-primary-foreground font-bold text-lg">F</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Business Onboarding</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Step {step + 1} of {STEPS.length} — {STEPS[step]}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <StepBar step={step} total={STEPS.length} />
        </div>

        {/* Step content card */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          {step === 0 && (
            <StepBasics
              companyId={companyId}
              companyName={clientCompany?.name}
              form={basics}
              setForm={setBasics}
              onNext={saveBasics}
              saving={saving}
            />
          )}
          {step === 1 && (
            <StepGoals
              form={goals}
              setForm={setGoals}
              onNext={saveGoals}
              onBack={() => setStep(0)}
              saving={saving}
            />
          )}
          {step === 2 && (
            <StepDone
              companyName={clientCompany?.name}
              onGoToDashboard={goToDashboard}
            />
          )}
        </div>
      </div>
    </div>
  )
}
