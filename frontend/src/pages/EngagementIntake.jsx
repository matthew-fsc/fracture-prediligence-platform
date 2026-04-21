import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  NotebookPen, Save, CheckCircle, AlertCircle, Clock, Circle,
  DollarSign, Target, Users, ArrowRight, Briefcase, TrendingUp,
  Cog, ChevronDown, ChevronRight, History,
} from 'lucide-react'
import SectionHeader from '../components/ui/SectionHeader'
import { usePageTitle } from '../hooks/usePageTitle'
import { useCompany, useCompanyId } from '../context/CompanyContext'
import { apiClient } from '../lib/apiClient'
import { toast } from '../lib/notify'
import { cn } from '../lib/utils'
import { Skeleton } from '../components/ui/Skeleton'
import { withCompanyQuery, resolvePath } from '../lib/navLinks'
import { drsCategoryStyles } from '../lib/drsCategoryColors'

// ─── Constants ───────────────────────────────────────────────────────────────

const TX_TYPES = [
  { value: '', label: '— Select —' },
  { value: 'strategic_sale', label: 'Strategic sale' },
  { value: 'esop', label: 'ESOP' },
  { value: 'mbo', label: 'Management buyout (MBO)' },
  { value: 'recapitalization', label: 'Recapitalization' },
  { value: 'other', label: 'Other / undecided' },
]

const BUYER_TYPES = [
  { id: 'PE', label: 'Private equity', desc: 'Institutional financial sponsors' },
  { id: 'Strategic', label: 'Strategic / trade buyer', desc: 'Industry acquirers seeking synergy' },
  { id: 'Financial', label: 'Independent sponsor / search fund', desc: 'Funded search or family office' },
]

const TIMELINE_PRESETS = [
  '6–12 months',
  '12–18 months',
  '18–24 months',
  '24–36 months',
  '36+ months (long horizon)',
]

const OWNER_MOTIVATIONS = [
  { id: 'maximize_proceeds', label: 'Maximize after-tax proceeds' },
  { id: 'preserve_culture', label: 'Preserve company culture' },
  { id: 'protect_employees', label: 'Protect employee jobs' },
  { id: 'family_successor', label: 'Keep in family / select successor' },
  { id: 'speed_of_close', label: 'Speed of transaction' },
  { id: 'earn_out_upside', label: 'Participate in post-close upside' },
  { id: 'retain_management', label: 'Retain existing management team' },
  { id: 'geographic_presence', label: 'Maintain local / geographic presence' },
]

const POST_EXIT_OPTIONS = [
  { value: 'retire', label: 'Retire' },
  { value: 'new_venture', label: 'Start a new venture' },
  { value: 'stay_advisor', label: 'Stay on as advisor / board member' },
  { value: 'consulting', label: 'Independent consulting' },
  { value: 'undecided', label: 'Undecided' },
]

const TIER_OPTIONS = [
  { value: 0,   label: 'None',          desc: '0%' },
  { value: 25,  label: 'Some',          desc: '~25%' },
  { value: 50,  label: 'Moderate',      desc: '~50%' },
  { value: 75,  label: 'Strong',        desc: '~75%' },
  { value: 100, label: 'Comprehensive', desc: '100%' },
]

const MARKET_OPTIONS = [
  { value: 'defined', label: 'Defined ICP + clear differentiation + repeatable sales motion', score: 80 },
  { value: 'moderate', label: 'Moderate positioning — some differentiation, inconsistent execution', score: 45 },
  { value: 'undifferentiated', label: 'Undifferentiated or unclear — competing on price/availability', score: 10 },
]

const CONTRACT_TYPES = [
  { value: 'msa', label: 'MSA / Annual Contract', sub: 'Highest buyer confidence' },
  { value: 'retainer', label: 'Retainer / Subscription', sub: 'Recurring — strong signal' },
  { value: 'project', label: 'Project-Based', sub: 'Lower predictability' },
  { value: 'mix', label: 'Mix of Above', sub: 'Document each relationship' },
]

const MGMT_FUNCTIONS = [
  { id: 'sales', label: 'Sales / BD', desc: 'Revenue generation, pipeline, client acquisition' },
  { id: 'delivery', label: 'Service Delivery', desc: 'Core product/service execution' },
  { id: 'finance', label: 'Finance / Accounting', desc: 'Books, reporting, cash flow, compliance' },
  { id: 'operations', label: 'Operations', desc: 'Day-to-day processes, scheduling, logistics' },
  { id: 'hr', label: 'HR / Admin', desc: 'Hiring, payroll, employee management' },
  { id: 'technology', label: 'Technology / IT', desc: 'Systems, tools, infrastructure' },
]

// ─── Shared UI ───────────────────────────────────────────────────────────────

function SectionCard({ icon: Icon, title, subtitle, badge, accentColor, children }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/60 bg-muted/20">
        {Icon && (
          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
            accentColor || 'bg-muted/50')}>
            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-card-foreground">{title}</h3>
          {subtitle && <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{subtitle}</p>}
        </div>
        {badge && <span className="flex-shrink-0">{badge}</span>}
      </div>
      <div className="p-5 space-y-5">{children}</div>
    </div>
  )
}

function FieldLabel({ children, optional }) {
  return (
    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
      {children}
      {optional && <span className="text-muted-foreground/50 normal-case tracking-normal font-normal">(optional)</span>}
    </label>
  )
}

function CompletionBadge({ complete, label }) {
  return (
    <div className={cn('flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border',
      complete ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-400')}>
      {complete ? <CheckCircle className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
      {label ?? (complete ? 'Complete' : 'Incomplete')}
    </div>
  )
}

function SliderField({ label, sublabel, hint, min = 0, max = 100, step = 5, value, onChange, formatter }) {
  return (
    <div>
      {label && <label className="block text-xs font-semibold text-foreground mb-1">{label}</label>}
      {sublabel && <p className="text-[11px] text-muted-foreground mb-2">{sublabel}</p>}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{min}%</span>
          <span className="font-bold text-foreground">{value}%</span>
          <span>{max}%</span>
        </div>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary" />
        {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
      </div>
      {formatter && formatter(Number(value))}
    </div>
  )
}

function TierSelector({ label, sublabel, value, onChange, formatter }) {
  return (
    <div>
      {label && <label className="block text-xs font-semibold text-foreground mb-1">{label}</label>}
      {sublabel && <p className="text-[11px] text-muted-foreground mb-2">{sublabel}</p>}
      <div className="flex gap-2 flex-wrap">
        {TIER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 min-w-[80px] rounded-lg border px-2 py-2 text-center transition-all',
              Number(value) === opt.value
                ? 'border-primary/40 bg-primary/10 ring-1 ring-primary/20'
                : 'border-border bg-muted/20 hover:bg-muted/40',
            )}
          >
            <p className={cn('text-xs font-semibold', Number(value) === opt.value ? 'text-primary' : 'text-foreground')}>{opt.label}</p>
            <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
          </button>
        ))}
      </div>
      {formatter && formatter(Number(value))}
    </div>
  )
}

const inputCls = 'mt-1.5 w-full bg-muted/60 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-colors'
const textareaCls = cn(inputCls, 'resize-none')
const numInputCls = 'text-sm bg-muted/60 border border-border rounded-lg px-3 py-1.5 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-colors'

// ─── Main Component ──────────────────────────────────────────────────────────

export default function EngagementIntake() {
  usePageTitle('Client Profile')
  const { setCompanyId } = useCompany()
  const companyId = useCompanyId()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const [loading, setLoading] = useState(true)
  const [hydratingCompany, setHydratingCompany] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState(null)

  // Engagement profile fields
  const [goals, setGoals] = useState('')
  const [motivations, setMotivations] = useState([])
  const [postExit, setPostExit] = useState('')
  const [nonNegotiables, setNonNegotiables] = useState('')
  const [engagementStartDate, setEngagementStartDate] = useState('')
  const [exitTimeline, setExitTimeline] = useState('')
  const [targetVal, setTargetVal] = useState('')
  const [gap, setGap] = useState('')
  const [txType, setTxType] = useState('')
  const [buyerNotes, setBuyerNotes] = useState('')
  const [buyers, setBuyers] = useState([])

  // Company overview fields
  const [employeeCount, setEmployeeCount] = useState('')
  const [foundedYear, setFoundedYear] = useState('')
  const [industry, setIndustry] = useState('')

  // Qualitative input fields
  const [qual, setQual] = useState({
    owner_hours_per_week: '',
    sop_pct: 50,
    automation_pct: 30,
    mgmt_covered: [],
    pipeline_value: '',
    market_positioning: '',
    repeatability_pct: 50,
    contract_pct: 50,
    customer_contract_type: '',
    key_person_revenue_pct: 50,
  })

  // Audit trail
  const [auditOpen, setAuditOpen] = useState(false)
  const [auditEntries, setAuditEntries] = useState([])

  const ready = companyId != null && companyId > 0
  const setQ = useCallback((k, v) => { setQual(f => ({ ...f, [k]: v })); setSaved(false) }, [])
  const markDirty = useCallback(() => setSaved(false), [])

  // Recover from missing company context by hydrating from the first accessible company.
  useEffect(() => {
    if (ready || hydratingCompany) return
    setHydratingCompany(true)
    apiClient.get('/api/companies')
      .then((rows) => {
        if (Array.isArray(rows) && rows.length > 0 && rows[0]?.id) {
          setCompanyId(rows[0].id)
        }
      })
      .catch(() => {})
      .finally(() => setHydratingCompany(false))
  }, [ready, hydratingCompany, setCompanyId])

  // Load data from three endpoints in parallel
  useEffect(() => {
    if (!ready) { setLoading(false); return }
    setLoading(true)
    setLoadError('')
    Promise.allSettled([
      apiClient.get(`/api/analytics/engagement-profile/${companyId}`),
      apiClient.get(`/api/analytics/qualitative/${companyId}`),
      apiClient.get(`/api/companies/${companyId}`),
    ])
      .then(([epRes, qdRes, companyRes]) => {
        const ep = epRes.status === 'fulfilled' ? epRes.value : null
        const qd = qdRes.status === 'fulfilled' ? qdRes.value : null
        const company = companyRes.status === 'fulfilled' ? companyRes.value : null

        if (ep) {
          setGoals(ep.owner_goals_narrative ?? '')
          setMotivations(Array.isArray(ep.owner_motivations) ? ep.owner_motivations : [])
          setPostExit(ep.post_exit_plans ?? '')
          setNonNegotiables(ep.non_negotiables ?? '')
          setEngagementStartDate(ep.engagement_start_date ?? '')
          setExitTimeline(ep.exit_timeline ?? '')
          setTargetVal(ep.target_valuation != null ? String(ep.target_valuation) : '')
          setGap(ep.personal_financial_gap != null ? String(ep.personal_financial_gap) : '')
          setTxType(ep.transaction_type ?? '')
          setBuyerNotes(ep.buyer_universe_notes ?? '')
          setBuyers(Array.isArray(ep.preferred_buyer_types) ? ep.preferred_buyer_types : [])
          if (ep.updated_at) setLastSavedAt(new Date(ep.updated_at))
        }
        if (qd?.inputs) {
          const i = qd.inputs
          setQual({
            owner_hours_per_week: i.owner_hours_per_week ?? '',
            sop_pct: i.sop_pct ?? 50,
            automation_pct: i.automation_pct ?? 30,
            mgmt_covered: i.mgmt_covered_functions ? i.mgmt_covered_functions.split(',').filter(Boolean) : [],
            pipeline_value: i.pipeline_value ?? '',
            market_positioning: i.market_positioning ?? '',
            repeatability_pct: i.repeatability_pct ?? 50,
            contract_pct: i.contract_pct ?? 50,
            customer_contract_type: i.customer_contract_type ?? '',
            key_person_revenue_pct: i.key_person_revenue_pct ?? 50,
          })
        }
        if (company) {
          setEmployeeCount(company.total_headcount != null ? String(company.total_headcount) : '')
          setFoundedYear(company.founded != null ? String(company.founded) : '')
          setIndustry(company.industry ?? '')
        }

        if (!ep && !qd && !company) {
          setLoadError('Could not load engagement data for this company.')
        } else if (!company) {
          setLoadError('Company profile could not be loaded. Some intake sections may be incomplete.')
        }
      })
      .finally(() => setLoading(false))
  }, [companyId, ready])

  // Load audit entries
  useEffect(() => {
    if (!ready) return
    apiClient.get(`/api/analytics/qualitative-audit/${companyId}?limit=15`)
      .then(d => setAuditEntries(d.entries ?? []))
      .catch(() => setAuditEntries([]))
  }, [companyId, ready, saved])

  const toggleBuyer = useCallback((id) => { setBuyers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); setSaved(false) }, [])

  // Section completion checks
  const engagementComplete = !!(motivations.length > 0 && exitTimeline.trim() && targetVal.trim() && txType && buyers.length > 0)
  const opsComplete = qual.owner_hours_per_week !== ''
  const revComplete = qual.customer_contract_type !== ''
  const growthComplete = qual.pipeline_value !== '' && qual.market_positioning !== ''
  const companyComplete = employeeCount !== '' && foundedYear !== '' && industry.trim() !== ''
  const allSections = [engagementComplete, companyComplete, revComplete, opsComplete, growthComplete]
  const filledCount = allSections.filter(Boolean).length
  const pct = Math.round((filledCount / allSections.length) * 100)

  // Save all three endpoints
  async function save() {
    if (!ready) return
    setSaving(true)
    try {
      await Promise.all([
        apiClient.patch(`/api/analytics/engagement-profile/${companyId}`, {
          owner_goals_narrative: goals.trim() || null,
          owner_motivations: motivations,
          post_exit_plans: postExit || null,
          non_negotiables: nonNegotiables.trim() || null,
          engagement_start_date: engagementStartDate || null,
          exit_timeline: exitTimeline.trim() || null,
          target_valuation: targetVal.trim() === '' ? null : parseFloat(targetVal),
          personal_financial_gap: gap.trim() === '' ? null : parseFloat(gap),
          transaction_type: txType || null,
          buyer_universe_notes: buyerNotes.trim() || null,
          preferred_buyer_types: buyers,
        }),
        apiClient.post(`/api/analytics/qualitative/${companyId}`, {
          owner_hours_per_week: qual.owner_hours_per_week !== '' ? Number(qual.owner_hours_per_week) : null,
          sop_pct: Number(qual.sop_pct),
          automation_pct: Number(qual.automation_pct),
          mgmt_qualified: qual.mgmt_covered.length,
          mgmt_total_functions: MGMT_FUNCTIONS.length,
          mgmt_covered_functions: qual.mgmt_covered.length > 0 ? qual.mgmt_covered.join(',') : null,
          pipeline_value: qual.pipeline_value !== '' ? Number(qual.pipeline_value) : null,
          market_positioning: qual.market_positioning || null,
          repeatability_pct: Number(qual.repeatability_pct),
          contract_pct: Number(qual.contract_pct),
          customer_contract_type: qual.customer_contract_type || null,
          key_person_revenue_pct: Number(qual.key_person_revenue_pct),
        }),
        (() => {
          const patch = {}
          if (employeeCount.trim() !== '') patch.total_headcount = parseInt(employeeCount)
          if (foundedYear.trim() !== '') patch.founded = parseInt(foundedYear)
          if (industry.trim() !== '') patch.industry = industry.trim()
          return Object.keys(patch).length > 0
            ? apiClient.patch(`/api/companies/${companyId}`, patch)
            : Promise.resolve()
        })(),
      ])
      queryClient.invalidateQueries({ queryKey: ['analytics-value-gap', companyId] })
      queryClient.invalidateQueries({ queryKey: ['analytics-scores', companyId] })
      queryClient.invalidateQueries({ queryKey: ['analytics-metrics', companyId] })
      queryClient.invalidateQueries({ queryKey: ['company', companyId] })
      apiClient.get(`/api/companies/${companyId}`)
        .then((c) => {
          if (c) {
            setEmployeeCount(c.total_headcount != null ? String(c.total_headcount) : '')
            setFoundedYear(c.founded != null ? String(c.founded) : '')
            setIndustry(c.industry ?? '')
          }
        })
        .catch(() => {})
      toast.success('Client profile saved')
      setSaved(true)
      setLastSavedAt(new Date())
    } catch (e) {
      toast.error(e?.message || 'Save failed')
    }
    setSaving(false)
  }

  if (!ready) {
    return (
      <div className="space-y-5 max-w-[960px]">
        <SectionHeader title="Client Profile" subtitle="All advisor-sourced context that financial data cannot capture." />
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <NotebookPen className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">
            {hydratingCompany ? 'Loading client context...' : 'No client selected'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {hydratingCompany
              ? 'Finding your first available client.'
              : 'Select or create a client in the header to begin intake.'}
          </p>
        </div>
      </div>
    )
  }

  const lastSavedLabel = lastSavedAt
    ? `Last saved ${lastSavedAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
    : null

  const statusBadge = saved
    ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400"><CheckCircle className="w-3 h-3" /> Saved</span>
    : pct === 0 && !lastSavedAt
      ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"><AlertCircle className="w-3 h-3" /> Not started</span>
      : <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400"><Clock className="w-3 h-3" /> {pct}% complete</span>

  return (
    <div className="space-y-5 max-w-[960px]">
      <SectionHeader
        title="Client Profile"
        subtitle="Owner objectives, qualitative business context, and operational detail that financial data cannot capture. These inputs directly drive DRS scoring, valuation, and buyer targeting."
        action={
          <div className="flex items-center gap-3">
            {statusBadge}
            <button type="button" onClick={save} disabled={saving || loading}
              className={cn(
                'inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50',
                'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/25',
              )}>
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving…' : 'Save All'}
            </button>
          </div>
        }
      />

      {/* ── Workflow stage rail ──────────────────────────────────────────── */}
      {(() => {
        const STAGES = [
          { n: 1, label: 'Client Profile',  path: '/EngagementIntake', current: true },
          { n: 2, label: 'Upload Data',     path: '/DataMapping',      current: false },
          { n: 3, label: 'DRS Score',       path: '/Readiness',        current: false },
          { n: 4, label: 'Valuation',       path: '/Valuation',        current: false },
          { n: 5, label: 'Value Gap',       path: '/ValueGap',         current: false },
          { n: 6, label: 'Buyer Prep',      path: '/BuyerLens',        current: false },
          { n: 7, label: 'Reports',         path: '/Reports',          current: false },
        ]
        return (
          <div className="rounded-xl border border-border bg-card/50 px-4 py-3 overflow-x-auto">
            <div className="flex items-center min-w-max gap-0">
              {STAGES.map((s, idx) => (
                <div key={s.n} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => navigate(resolvePath(s.path, pathname))}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors',
                      s.current
                        ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
                    )}
                  >
                    <span className={cn(
                      'w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0',
                      s.current ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground',
                    )}>{s.n}</span>
                    {s.label}
                  </button>
                  {idx < STAGES.length - 1 && (
                    <ArrowRight className="w-3 h-3 text-muted-foreground/30 flex-shrink-0 mx-0.5" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Completion progress */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-card-foreground">Intake Completion</p>
          <span className={cn('text-sm font-bold', pct === 100 ? 'text-emerald-400' : pct > 0 ? 'text-primary' : 'text-muted-foreground')}>
            {filledCount} / {allSections.length} sections
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className={cn('h-1.5 rounded-full transition-all duration-500', pct === 100 ? 'bg-emerald-500' : 'bg-primary')}
            style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex flex-wrap gap-1.5">
            {[
              { ok: engagementComplete, label: 'Engagement' },
              { ok: companyComplete, label: 'Company' },
              { ok: revComplete, label: 'Revenue' },
              { ok: opsComplete, label: 'Operations' },
              { ok: growthComplete, label: 'Growth' },
            ].map(s => (
              <span key={s.label} className={cn(
                'text-[10px] font-semibold px-1.5 py-0.5 rounded border',
                s.ok ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' : 'border-border bg-muted/30 text-muted-foreground/60',
              )}>
                {s.ok ? '✓' : '○'} {s.label}
              </span>
            ))}
          </div>
          {lastSavedLabel && <p className="text-[10px] text-muted-foreground/60 flex-shrink-0">{lastSavedLabel}</p>}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {loadError && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-xs text-amber-300">{loadError}</p>
            </div>
          )}

          {/* ── SECTION 1: Owner Goals ──────────────────────────────── */}
          <SectionCard
            icon={Target}
            title="Owner Goals & Success Criteria"
            accentColor="bg-blue-500/10"
            badge={motivations.length > 0 ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : null}
          >
            {/* Primary motivations multi-select */}
            <div>
              <FieldLabel>Primary motivations <span className="normal-case font-normal text-muted-foreground/60">(select all that apply)</span></FieldLabel>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {OWNER_MOTIVATIONS.map(m => {
                  const active = motivations.includes(m.id)
                  return (
                    <button key={m.id} type="button"
                      onClick={() => { setMotivations(prev => active ? prev.filter(x => x !== m.id) : [...prev, m.id]); markDirty() }}
                      className={cn('text-left rounded-lg border px-3 py-2 transition-all',
                        active ? 'border-primary/40 bg-primary/10 ring-1 ring-primary/20' : 'border-border bg-muted/20 hover:bg-muted/40')}>
                      <div className="flex items-center gap-2">
                        <div className={cn('w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                          active ? 'border-primary bg-primary' : 'border-muted-foreground/30')}>
                          {active && <CheckCircle className="w-2 h-2 text-primary-foreground" />}
                        </div>
                        <span className={cn('text-xs', active ? 'text-primary font-semibold' : 'text-foreground')}>{m.label}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Post-exit plans */}
            <div>
              <FieldLabel optional>Post-exit plans</FieldLabel>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mt-2">
                {POST_EXIT_OPTIONS.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => { setPostExit(opt.value); markDirty() }}
                    className={cn('rounded-lg border px-2 py-2 text-center transition-all',
                      postExit === opt.value ? 'border-primary/40 bg-primary/10 ring-1 ring-primary/20' : 'border-border bg-muted/20 hover:bg-muted/40')}>
                    <span className={cn('text-xs', postExit === opt.value ? 'text-primary font-semibold' : 'text-foreground')}>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Non-negotiables */}
            <div>
              <FieldLabel optional>Non-negotiables</FieldLabel>
              <textarea value={nonNegotiables} onChange={e => { setNonNegotiables(e.target.value); markDirty() }}
                rows={3}
                placeholder="Deal structure requirements that cannot be compromised — e.g. no earnouts, no PE rollup, employees must be retained for 24 months, keep HQ in current city…"
                className={textareaCls} />
            </div>

            {/* Narrative (optional freeform) */}
            <div>
              <FieldLabel optional>Additional context / narrative</FieldLabel>
              <textarea value={goals} onChange={e => { setGoals(e.target.value); markDirty() }}
                rows={3}
                placeholder="Any additional background on the owner's situation, personal circumstances, or qualitative expectations not captured above…"
                className={textareaCls} />
            </div>
          </SectionCard>

          {/* ── SECTION 2: Transaction & Valuation ─────────────────── */}
          <SectionCard icon={DollarSign} title="Transaction & Valuation" accentColor="bg-emerald-500/10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FieldLabel optional>Engagement start date</FieldLabel>
                <input type="date" value={engagementStartDate} onChange={e => { setEngagementStartDate(e.target.value); markDirty() }}
                  className={inputCls} />
                <p className="text-[10px] text-muted-foreground/60 mt-1">Used as the timeline anchor for projected close markers.</p>
              </div>
              <div>
                <FieldLabel>Exit timeline</FieldLabel>
                <select value={exitTimeline} onChange={e => { setExitTimeline(e.target.value); markDirty() }} className={inputCls}>
                  <option value="">— Select horizon —</option>
                  {TIMELINE_PRESETS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Transaction type preference</FieldLabel>
                <select value={txType} onChange={e => { setTxType(e.target.value); markDirty() }} className={inputCls}>
                  {TX_TYPES.map(t => <option key={t.value || 'x'} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel optional>Target valuation ($)</FieldLabel>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-[calc(0.375rem+50%)] -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                  <input type="number" value={targetVal} onChange={e => { setTargetVal(e.target.value); markDirty() }}
                    placeholder="e.g. 15000000" className={cn(inputCls, 'pl-8')} />
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-1">Owner's target enterprise value. Compared against DRS-based EV range.</p>
              </div>
              <div>
                <FieldLabel optional>Personal financial gap ($)</FieldLabel>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-[calc(0.375rem+50%)] -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                  <input type="number" value={gap} onChange={e => { setGap(e.target.value); markDirty() }}
                    placeholder="After-tax proceeds needed vs. current estimate" className={cn(inputCls, 'pl-8')} />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ── SECTION 3: Buyer Universe ───────────────────────────── */}
          <SectionCard icon={Users} title="Buyer Universe" accentColor="bg-purple-500/10"
            badge={buyers.length > 0 ? <span className="text-[11px] font-semibold text-primary">{buyers.length} selected</span> : null}>
            <div>
              <FieldLabel>Preferred buyer types</FieldLabel>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                {BUYER_TYPES.map(b => {
                  const active = buyers.includes(b.id)
                  return (
                    <button key={b.id} type="button" onClick={() => toggleBuyer(b.id)}
                      className={cn('text-left rounded-lg border p-3 transition-all',
                        active ? 'border-primary/40 bg-primary/10 ring-1 ring-primary/20' : 'border-border bg-muted/30 hover:bg-muted/50')}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                          active ? 'border-primary bg-primary' : 'border-muted-foreground/30')}>
                          {active && <CheckCircle className="w-2.5 h-2.5 text-primary-foreground" />}
                        </div>
                        <span className={cn('text-xs font-semibold', active ? 'text-primary' : 'text-foreground')}>{b.label}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground pl-6">{b.desc}</p>
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <FieldLabel optional>Buyer universe notes</FieldLabel>
              <textarea value={buyerNotes} onChange={e => { setBuyerNotes(e.target.value); markDirty() }}
                rows={3}
                placeholder="e.g. Prefer operator with field services experience; avoid rollup platforms. Prior conversations with XYZ Capital."
                className={textareaCls} />
            </div>
          </SectionCard>

          {/* ── SECTION 4: Company Overview ─────────────────────────── */}
          <SectionCard icon={Briefcase} title="Company Overview" accentColor="bg-cyan-500/10"
            subtitle="Key facts that supplement ingested financials"
            badge={<CompletionBadge complete={companyComplete} />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <FieldLabel>Total number of employees</FieldLabel>
                <div className="flex items-center gap-2 mt-1.5">
                  <Users className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                  <input type="number" min={0} value={employeeCount}
                    onChange={e => { setEmployeeCount(e.target.value); markDirty() }}
                    placeholder="e.g. 45"
                    className={cn(numInputCls, 'w-32')} />
                  <span className="text-xs text-muted-foreground">FTE</span>
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-1.5">Revenue per employee, management ratio, and team score.</p>
              </div>
              <div>
                <FieldLabel>Founded year</FieldLabel>
                <input type="number" min={1900} max={2099} value={foundedYear}
                  onChange={e => { setFoundedYear(e.target.value); markDirty() }}
                  placeholder="e.g. 2015"
                  className={cn(numInputCls, 'w-32 mt-1.5')} />
                <p className="text-[10px] text-muted-foreground/60 mt-1.5">Displayed on the company profile and reports.</p>
              </div>
              <div>
                <FieldLabel>Industry</FieldLabel>
                <input type="text" value={industry}
                  onChange={e => { setIndustry(e.target.value); markDirty() }}
                  placeholder="e.g. IT Services, Healthcare"
                  className={cn(inputCls, 'mt-0')} />
                <p className="text-[10px] text-muted-foreground/60 mt-1.5">Used for market benchmarking and buyer targeting.</p>
              </div>
            </div>
          </SectionCard>

          {/* ── Group divider: Qualitative Scoring ──────────────────── */}
          <div className="flex items-center gap-3 pt-2">
            <div className="h-px flex-1 bg-border/60" />
            <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest flex-shrink-0">Qualitative DRS Inputs</p>
            <div className="h-px flex-1 bg-border/60" />
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2">
            These inputs replace conservative default assumptions in the Deal Readiness Score. When all fields in a section are complete, the DRS automatically recomputes using the qualitative sub-scores.
          </p>

          {/* ── SECTION 5: Revenue Contracts & Key Person ──────────── */}
          <SectionCard icon={DollarSign} title="Revenue Contracts & Key Person Risk" accentColor={drsCategoryStyles.revenue_quality.bg}
            subtitle="Maps to DRS: Revenue Quality — captures contract formalization and owner-dependency"
            badge={<CompletionBadge complete={revComplete} />}>

            {/* Contract Coverage tier selector */}
            <TierSelector
              label="Contract / MSA Coverage"
              sublabel="What percentage of active customers have a signed contract, MSA, or retainer agreement in place?"
              value={qual.contract_pct}
              onChange={v => setQ('contract_pct', v)}
              formatter={v => (
                <p className={cn('text-[11px] font-semibold mt-2',
                  v >= 75 ? 'text-emerald-400' : v >= 50 ? 'text-amber-400' : 'text-red-400')}>
                  {v >= 75 ? 'Strong — buyers will view revenue as secured'
                    : v >= 50 ? 'Moderate — formalize remaining relationships before sale'
                    : 'Weak — significant buyer risk; contract formalization is a high-priority initiative'}
                </p>
              )}
            />

            {/* Primary contract type */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Primary Contract Type</label>
              <p className="text-[11px] text-muted-foreground mb-2">How is most revenue structured with customers?</p>
              <div className="grid grid-cols-2 gap-2">
                {CONTRACT_TYPES.map(opt => (
                  <button key={opt.value} onClick={() => setQ('customer_contract_type', opt.value)}
                    className={cn('text-left rounded-lg border p-3 transition-all',
                      qual.customer_contract_type === opt.value
                        ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/20 hover:bg-muted/40')}>
                    <div className="flex items-center gap-2 mb-0.5">
                      {qual.customer_contract_type === opt.value
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
            <SliderField
              label="Owner Revenue Dependency"
              sublabel="Approximately what percentage of revenue is attributable to the owner's personal relationships?"
              value={qual.key_person_revenue_pct}
              onChange={v => setQ('key_person_revenue_pct', v)}
              formatter={v => (
                <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded border inline-block mt-1',
                  v <= 20 ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10' :
                  v <= 50 ? 'border-amber-500/20 text-amber-400 bg-amber-500/10' :
                  'border-red-500/20 text-red-400 bg-red-500/10')}>
                  {v <= 10 ? 'Low risk — institutionalized relationships'
                    : v <= 20 ? 'Manageable — introduce key account managers'
                    : v <= 50 ? 'Moderate risk — transition plan needed'
                    : 'High risk — major valuation discount; buyer will escrow or reduce offer'}
                </span>
              )}
            />
          </SectionCard>

          {/* ── SECTION 6: Operational Independence ─────────────────── */}
          <SectionCard icon={Cog} title="Operational Independence" accentColor={drsCategoryStyles.operational_independence.bg}
            subtitle="DRS weight: 20% — owner hours 35%, SOPs 30%, automation 15%, management depth 20%"
            badge={<CompletionBadge complete={opsComplete} />}>

            {/* Owner Hours */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Owner Hours in Operations</label>
              <p className="text-[11px] text-muted-foreground mb-2">
                On average, how many hours per week does the owner spend in day-to-day operations?
              </p>
              <div className="flex items-center gap-3">
                <input type="number" min={0} max={80} value={qual.owner_hours_per_week}
                  onChange={e => setQ('owner_hours_per_week', e.target.value)}
                  placeholder="e.g. 30"
                  className={cn(numInputCls, 'w-24')} />
                <span className="text-xs text-muted-foreground">hours / week</span>
                {qual.owner_hours_per_week !== '' && (
                  <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded border',
                    Number(qual.owner_hours_per_week) <= 15 ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10' :
                    Number(qual.owner_hours_per_week) <= 30 ? 'border-amber-500/20 text-amber-400 bg-amber-500/10' :
                    'border-red-500/20 text-red-400 bg-red-500/10')}>
                    {Number(qual.owner_hours_per_week) <= 5 ? '90 pts — owner not needed' :
                     Number(qual.owner_hours_per_week) <= 15 ? '75 pts — low dependency' :
                     Number(qual.owner_hours_per_week) <= 25 ? '55 pts — moderate dependency' :
                     Number(qual.owner_hours_per_week) <= 40 ? '35 pts — high dependency' :
                     '10 pts — critical dependency'}
                  </span>
                )}
              </div>
            </div>

            {/* SOP Documentation */}
            <TierSelector
              label="SOP Documentation"
              sublabel="How well are core operational processes documented with written SOPs? (onboarding, service delivery, account management, billing)"
              value={qual.sop_pct}
              onChange={v => setQ('sop_pct', v)}
              formatter={v => (
                <p className={cn('text-[11px] font-semibold mt-2',
                  v >= 75 ? 'text-emerald-400' : v >= 50 ? 'text-amber-400' : 'text-red-400')}>
                  {v >= 75 ? 'Buyer-ready — processes survive ownership transition'
                    : v >= 25 ? 'Partial — prioritize documenting delivery and billing processes'
                    : 'Low — creates key-person risk; documentation is a critical pre-sale initiative'}
                </p>
              )}
            />

            {/* Process Automation */}
            <TierSelector
              label="Process Automation Level"
              sublabel="How much of the repetitive operational work (invoicing, reporting, scheduling) runs through systems rather than people?"
              value={qual.automation_pct}
              onChange={v => setQ('automation_pct', v)}
              formatter={v => (
                <p className={cn('text-[11px] font-semibold mt-2',
                  v >= 75 ? 'text-emerald-400' : v >= 50 ? 'text-amber-400' : 'text-red-400')}>
                  {v >= 75 ? 'Strong — scalable infrastructure buyers will value'
                    : v >= 25 ? 'Developing — identify highest-ROI automation opportunities'
                    : 'Manual — increases integration cost and risk for acquirer'}
                </p>
              )}
            />

            {/* Management Depth — function checklist */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-foreground">Management Depth</label>
                {(() => {
                  const n = qual.mgmt_covered.length
                  const total = MGMT_FUNCTIONS.length
                  const pct = Math.round(n / total * 100)
                  return (
                    <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded border',
                      pct >= 75 ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10' :
                      pct >= 50 ? 'border-amber-500/20 text-amber-400 bg-amber-500/10' :
                      'border-red-500/20 text-red-400 bg-red-500/10')}>
                      {n}/{total} covered — {pct}%
                    </span>
                  )
                })()}
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Which core business functions have a qualified non-owner manager who could run that function independently?
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {MGMT_FUNCTIONS.map(fn => {
                  const active = qual.mgmt_covered.includes(fn.id)
                  return (
                    <button key={fn.id} type="button"
                      onClick={() => {
                        setQual(prev => ({
                          ...prev,
                          mgmt_covered: active
                            ? prev.mgmt_covered.filter(x => x !== fn.id)
                            : [...prev.mgmt_covered, fn.id],
                        }))
                        setSaved(false)
                      }}
                      className={cn('text-left rounded-lg border p-2.5 transition-all',
                        active ? 'border-primary/40 bg-primary/10 ring-1 ring-primary/20' : 'border-border bg-muted/20 hover:bg-muted/40')}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className={cn('w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                          active ? 'border-primary bg-primary' : 'border-muted-foreground/30')}>
                          {active && <CheckCircle className="w-2 h-2 text-primary-foreground" />}
                        </div>
                        <span className={cn('text-xs font-semibold', active ? 'text-primary' : 'text-foreground')}>{fn.label}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground pl-5 leading-tight">{fn.desc}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          </SectionCard>

          {/* ── SECTION 7: Growth Drivers ───────────────────────────── */}
          <SectionCard icon={TrendingUp} title="Growth Drivers" accentColor={drsCategoryStyles.growth_drivers.bg}
            subtitle="DRS weight: 10% — pipeline 30%, market positioning 20%, repeatability 15% (CAGR 35% from financial data)"
            badge={<CompletionBadge complete={growthComplete} />}>

            {/* Pipeline Value */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Pipeline Coverage Ratio</label>
              <p className="text-[11px] text-muted-foreground mb-2">
                What is the estimated dollar value of qualified pipeline (prospects with identified need, budget, and timeline)?
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <input type="number" min={0} value={qual.pipeline_value}
                  onChange={e => setQ('pipeline_value', e.target.value)}
                  placeholder="e.g. 500000"
                  className={cn(numInputCls, 'w-40')} />
                <span className="text-xs text-muted-foreground">qualified pipeline</span>
              </div>
            </div>

            {/* Market Positioning */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Market Positioning</label>
              <p className="text-[11px] text-muted-foreground mb-2">How would you characterize the company's market positioning?</p>
              <div className="space-y-2">
                {MARKET_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setQ('market_positioning', opt.value)}
                    className={cn('w-full text-left rounded-lg border p-3 transition-all',
                      qual.market_positioning === opt.value
                        ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/20 hover:bg-muted/40')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {qual.market_positioning === opt.value
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

            {/* Product Repeatability */}
            <SliderField
              label="Product/Service Repeatability"
              sublabel="What percentage of revenue comes from standardized, repeatable offerings vs. fully custom work?"
              value={qual.repeatability_pct}
              onChange={v => setQ('repeatability_pct', v)}
            />
          </SectionCard>

          {/* ── Audit trail ──────────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <button type="button" onClick={() => setAuditOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/20 transition-colors">
              <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                Qualitative input change history
                {auditEntries.length > 0 && (
                  <span className="text-[10px] font-normal text-muted-foreground">({auditEntries.length} recent)</span>
                )}
              </span>
              {auditOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </button>
            {auditOpen && (() => {
              const FIELD_LABELS = {
                owner_hours_per_week: 'Owner Hours',
                sop_pct: 'SOP Documentation',
                automation_pct: 'Process Automation',
                mgmt_qualified: 'Mgmt Functions Covered',
                mgmt_total_functions: 'Mgmt Total Functions',
                mgmt_covered_functions: 'Covered Functions',
                pipeline_value: 'Pipeline Value',
                market_positioning: 'Market Positioning',
                repeatability_pct: 'Repeatability',
                contract_pct: 'Contract Coverage',
                customer_contract_type: 'Contract Type',
                key_person_revenue_pct: 'Owner Revenue Dep.',
              }
              const fmtVal = (k, v) => {
                if (v == null) return '—'
                if (k === 'pipeline_value') return `$${Number(v).toLocaleString()}`
                if (k.endsWith('_pct') || k === 'sop_pct' || k === 'automation_pct' || k === 'repeatability_pct' || k === 'contract_pct' || k === 'key_person_revenue_pct') return `${v}%`
                if (k === 'owner_hours_per_week') return `${v} hrs/wk`
                if (k === 'market_positioning') return String(v).replace(/_/g, ' ')
                if (k === 'mgmt_covered_functions') return String(v).replace(/,/g, ', ')
                return String(v)
              }
              const diffEntries = auditEntries.map((e, idx) => {
                const snap = e.snapshot ?? {}
                const prev = idx < auditEntries.length - 1 ? (auditEntries[idx + 1]?.snapshot ?? {}) : null
                const changes = []
                for (const [k, label] of Object.entries(FIELD_LABELS)) {
                  const cur = snap[k]
                  if (cur == null) continue
                  if (prev && prev[k] != null && String(prev[k]) !== String(cur)) {
                    changes.push({ label, from: fmtVal(k, prev[k]), to: fmtVal(k, cur) })
                  } else if (!prev) {
                    changes.push({ label, from: null, to: fmtVal(k, cur) })
                  }
                }
                return { ...e, changes }
              })
              return (
                <div className="px-4 pb-4 border-t border-border pt-3 space-y-2 text-[11px] text-muted-foreground max-h-72 overflow-y-auto">
                  {auditEntries.length === 0 && <p>No saved versions yet — history is recorded each time you save.</p>}
                  {diffEntries.map(e => (
                    <div key={e.id} className="rounded-lg border border-border/80 bg-muted/10 p-2.5">
                      <p className="text-[10px] font-semibold text-foreground mb-1.5">
                        {e.created_at ? new Date(e.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                      </p>
                      {e.changes.length > 0 ? (
                        <div className="space-y-0.5">
                          {e.changes.map((c, i) => (
                            <p key={i} className="text-[10px]">
                              <span className="text-muted-foreground/70">{c.label}:</span>{' '}
                              {c.from != null ? (
                                <><span className="text-red-400/70 line-through">{c.from}</span> <span className="text-muted-foreground/40">&rarr;</span> <span className="text-emerald-400">{c.to}</span></>
                              ) : (
                                <span className="text-foreground">{c.to}</span>
                              )}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground/50 italic">No field changes vs. prior version</p>
                      )}
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>

          {/* ── Save + navigate CTA ──────────────────────────────────── */}
          <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
            <button type="button" onClick={save} disabled={saving || loading}
              className={cn(
                'inline-flex items-center gap-1.5 text-xs font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50',
                'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/25',
              )}>
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving…' : 'Save All'}
            </button>
            <button type="button"
              onClick={() => navigate(withCompanyQuery(resolvePath('/AdvisoryWorkflow', pathname), companyId))}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              Continue to Advisory Workflow <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
