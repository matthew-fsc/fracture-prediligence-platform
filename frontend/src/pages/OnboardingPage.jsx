import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cloud, CheckCircle, Circle, AlertTriangle } from 'lucide-react'
import { apiClient } from '../lib/apiClient'
import { withCompanyQuery } from '../lib/navLinks'
import { cn } from '../lib/utils'

const ONBOARDING_STORAGE_KEY = 'fracture_onboarding_v1'

function readOnboarding() {
  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeOnboarding(patch) {
  try {
    const prev = readOnboarding()
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({ ...prev, ...patch }))
  } catch {
    /* ignore quota / private mode */
  }
}

const INDUSTRIES = [
  'Professional Services',
  'HVAC/Trade',
  'Healthcare',
  'Construction',
  'Retail',
  'Technology',
  'Other',
]

const REVENUE_RANGES = [
  'Under $1M',
  '$1M—$2.5M',
  '$2.5M—$5M',
  '$5M—$10M',
  '$10M+',
]

const ENTITY_TYPES = [
  'LLC',
  'S-Corp',
  'C-Corp',
  'Partnership',
  'Sole Proprietor',
]

const inputCls = 'w-full bg-secondary border border-border rounded-lg px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none'
const labelCls = 'block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground mb-1.5'

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------
function ProgressBar({ step }) {
  return (
    <div className="flex items-center gap-2 mb-10">
      {[1, 2, 3].map((n) => (
        <div key={n} className="flex items-center gap-2">
          <div
            className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-300',
              n <= step
                ? 'text-background'
                : 'text-muted-foreground border border-border',
            )}
            style={n <= step ? { background: 'hsl(var(--gold))' } : { background: 'hsl(var(--secondary))' }}
          >
            {n < step ? (
              <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                <path d="M1 4.5L4.5 8L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : n}
          </div>
          {n < 3 && (
            <div
              className="w-14 h-0.5 transition-colors duration-300"
              style={{ background: n < step ? 'hsl(var(--gold))' : 'hsl(var(--border))' }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline error banner
// ---------------------------------------------------------------------------
function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-3.5 py-2.5 mb-5">
      <AlertTriangle size={14} className="text-destructive shrink-0" />
      <span className="text-destructive text-xs">{message}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1 — Add first client
// ---------------------------------------------------------------------------
function Step1({ onNext, saving, error }) {
  const saved = readOnboarding().step1
  const [form, setForm] = useState({
    name: '',
    industry: '',
    revenueRange: '',
    entityType: '',
    ...(saved && typeof saved === 'object' ? saved : {}),
  })
  const [nameError, setNameError] = useState('')

  useEffect(() => {
    writeOnboarding({ step1: form })
  }, [form])

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setNameError('Client name is required.')
      return
    }
    setNameError('')
    onNext(form)
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="font-serif text-3xl font-semibold text-foreground mb-2">
        Add your first client
      </h2>
      <p className="text-sm text-muted-foreground mb-8">
        This creates your first client engagement and pre-diligence workspace.
      </p>

      <ErrorBanner message={error} />

      <div className="mb-5">
        <label className={labelCls}>Client Name</label>
        <input
          type="text"
          placeholder="e.g. Lakeside HVAC Services LLC"
          value={form.name}
          onChange={set('name')}
          className={inputCls}
          required
          aria-invalid={nameError ? 'true' : 'false'}
          aria-describedby={nameError ? 'client-name-error' : undefined}
        />
        {nameError && (
          <p id="client-name-error" role="alert" className="text-xs text-destructive mt-2">
            {nameError}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <label className={labelCls}>Industry</label>
          <select value={form.industry} onChange={set('industry')} className={inputCls}>
            <option value="">Select industry</option>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Revenue Range</label>
          <select value={form.revenueRange} onChange={set('revenueRange')} className={inputCls}>
            <option value="">Select range</option>
            {REVENUE_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-8">
        <label className={labelCls}>Entity Type</label>
        <select value={form.entityType} onChange={set('entityType')} className={inputCls}>
          <option value="">Select entity type</option>
          {ENTITY_TYPES.map((et) => <option key={et} value={et}>{et}</option>)}
        </select>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="px-7 py-3 rounded-lg text-sm font-semibold text-background disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        style={{ background: 'hsl(var(--gold))' }}
      >
        {saving ? 'Creating…' : 'Add Client & Continue →'}
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Step 2 — Upload first document
// ---------------------------------------------------------------------------
function Step2({ onNext, onSkip, uploading, error }) {
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (file?.name) writeOnboarding({ step2FileName: file.name })
  }, [file])

  const handleFile = (f) => {
    if (f) setFile(f)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = () => setDragging(false)

  return (
    <div>
      <h2 className="font-serif text-3xl font-semibold text-foreground mb-2">
        Upload your first document
      </h2>
      <p className="text-sm text-muted-foreground mb-8">
        Upload a QuickBooks export, P&L, or revenue report to seed the analysis.
        Accepted: PDF, XLSX, CSV, DOCX — Max 25MB.
      </p>

      <ErrorBanner message={error} />

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl px-6 py-12 text-center transition-all duration-200 mb-5',
          uploading ? 'cursor-not-allowed' : 'cursor-pointer',
          dragging ? 'border-primary/60 bg-primary/5' : 'border-border bg-secondary/50 hover:border-border/80',
        )}
      >
        <Cloud
          className={cn('w-10 h-10 mx-auto mb-3 block', file ? 'text-primary' : 'text-muted-foreground')}
        />
        {uploading ? (
          <p className="text-sm text-muted-foreground">Uploading…</p>
        ) : file ? (
          <p className="text-sm text-foreground font-medium">{file.name}</p>
        ) : (
          <>
            <p className="text-sm text-foreground font-medium mb-1">Drag & drop or click to browse</p>
            <p className="text-xs text-muted-foreground">PDF, XLSX, CSV, DOCX — Max 25MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.xlsx,.csv,.docx"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => onNext(file)}
          disabled={!file || uploading}
          className="px-7 py-3 rounded-lg text-sm font-semibold text-background disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          style={{ background: 'hsl(var(--gold))' }}
        >
          {uploading ? 'Uploading…' : 'Upload & Continue →'}
        </button>
        <button
          onClick={onSkip}
          disabled={uploading}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        >
          Skip for now →
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reusable slider row
// ---------------------------------------------------------------------------
function SliderRow({ label, value, onChange, min = 0, max = 100, step = 5, leftLabel, rightLabel }) {
  return (
    <div className="mb-5">
      <div className="flex justify-between items-center mb-1.5">
        <label className={labelCls}>{label}</label>
        <span className="text-sm font-bold text-foreground">{value}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full cursor-pointer"
        style={{ accentColor: 'hsl(var(--gold))' }}
      />
      <div className="flex justify-between mt-1">
        <span className="text-[11px] text-muted-foreground">{leftLabel}</span>
        <span className="text-[11px] text-muted-foreground">{rightLabel}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3 — Advisor Interview (qualitative questionnaire)
// ---------------------------------------------------------------------------
const CONTRACT_TYPES = [
  { value: 'msa',      label: 'MSA / Annual Contract' },
  { value: 'retainer', label: 'Retainer / Subscription' },
  { value: 'project',  label: 'Project-Based' },
  { value: 'mix',      label: 'Mix of the Above' },
]

const MARKET_OPTS = [
  { value: 'defined',          label: 'Defined ICP + clear differentiation + repeatable sales motion', score: 80 },
  { value: 'moderate',         label: 'Moderate — some differentiation, inconsistent execution', score: 45 },
  { value: 'undifferentiated', label: 'Undifferentiated — competing on price or availability', score: 10 },
]

function Step3({ onNext, onSkip, companyId }) {
  const saved3 = readOnboarding().step3
  const [form, setForm] = useState({
    owner_hours_per_week: '',
    sop_pct: 50,
    mgmt_qualified: '',
    mgmt_total_functions: '',
    contract_pct: 50,
    customer_contract_type: '',
    key_person_revenue_pct: 50,
    pipeline_value: '',
    market_positioning: '',
    ...(saved3 && typeof saved3 === 'object' ? saved3 : {}),
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    writeOnboarding({ step3: form })
  }, [form])

  const handleSave = async () => {
    setSaving(true)
    try {
      if (companyId) {
        await apiClient.post(`/api/analytics/qualitative/${companyId}`, {
          owner_hours_per_week:   form.owner_hours_per_week !== '' ? Number(form.owner_hours_per_week) : null,
          sop_pct:                Number(form.sop_pct),
          mgmt_qualified:         form.mgmt_qualified !== '' ? Number(form.mgmt_qualified) : null,
          mgmt_total_functions:   form.mgmt_total_functions !== '' ? Number(form.mgmt_total_functions) : null,
          contract_pct:           Number(form.contract_pct),
          customer_contract_type: form.customer_contract_type || null,
          key_person_revenue_pct: Number(form.key_person_revenue_pct),
          pipeline_value:         form.pipeline_value !== '' ? Number(form.pipeline_value) : null,
          market_positioning:     form.market_positioning || null,
        })
      }
    } catch (_) { /* non-blocking — advisor can update in Engagement Intake */ }
    setSaving(false)
    onNext()
  }

  const SectionTitle = ({ children }) => (
    <p
      className="text-[10px] font-bold uppercase tracking-[0.1em] pb-2 mb-3.5 mt-6 border-b border-border"
      style={{ color: 'hsl(var(--gold))' }}
    >
      {children}
    </p>
  )

  const selectedOptionBtn = (active) => cn(
    'rounded-lg px-3 py-2.5 cursor-pointer text-left flex items-center gap-2 border transition-colors',
    active
      ? 'bg-secondary border-border/80 text-foreground'
      : 'bg-secondary/50 border-border/50 text-muted-foreground hover:bg-secondary',
  )

  return (
    <div>
      <h2 className="font-serif text-[28px] font-semibold text-foreground mb-1.5">
        Advisor Interview
      </h2>
      <p className="text-sm text-muted-foreground mb-1">
        These answers feed directly into the Readiness Score for metrics that financials cannot capture.
      </p>
      <p className="text-xs text-muted-foreground mb-4">
        All inputs can be updated later in Engagement Intake.
      </p>

      {/* Scrollable form area */}
      <div className="max-h-[400px] overflow-y-auto pr-1 mb-5">

        <SectionTitle>Owner &amp; Operations</SectionTitle>

        <div className="mb-5">
          <label className={labelCls}>Owner hours in day-to-day operations (per week)</label>
          <div className="flex items-center gap-2.5">
            <input
              type="number"
              min={0}
              max={80}
              placeholder="e.g. 30"
              value={form.owner_hours_per_week}
              onChange={e => set('owner_hours_per_week', e.target.value)}
              className={cn(inputCls, 'w-24')}
            />
            <span className="text-sm text-muted-foreground">hrs/week</span>
          </div>
        </div>

        <SliderRow
          label="SOP Documentation"
          value={form.sop_pct}
          onChange={v => set('sop_pct', v)}
          leftLabel="0% — none"
          rightLabel="100% — fully documented"
        />

        <div className="mb-5">
          <label className={labelCls}>Management Depth (qualified managers / total core functions)</label>
          <div className="flex items-center gap-2.5">
            <input
              type="number"
              min={0}
              max={10}
              placeholder="0"
              value={form.mgmt_qualified}
              onChange={e => set('mgmt_qualified', e.target.value)}
              className={cn(inputCls, 'w-16 text-center')}
            />
            <span className="text-sm text-muted-foreground">/</span>
            <input
              type="number"
              min={1}
              max={10}
              placeholder="4"
              value={form.mgmt_total_functions}
              onChange={e => set('mgmt_total_functions', e.target.value)}
              className={cn(inputCls, 'w-16 text-center')}
            />
            <span className="text-sm text-muted-foreground">functions</span>
          </div>
        </div>

        <SectionTitle>Revenue Contracts &amp; Key Person</SectionTitle>

        <SliderRow
          label="% customers with formal contract or MSA"
          value={form.contract_pct}
          onChange={v => set('contract_pct', v)}
          leftLabel="0% — verbal only"
          rightLabel="100% — fully contracted"
        />

        <div className="mb-5">
          <label className={labelCls}>Primary contract type</label>
          <div className="grid grid-cols-2 gap-2">
            {CONTRACT_TYPES.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set('customer_contract_type', opt.value)}
                className={selectedOptionBtn(form.customer_contract_type === opt.value)}
                style={form.customer_contract_type === opt.value ? { borderColor: 'hsl(var(--gold) / 0.5)', background: 'hsl(var(--gold) / 0.1)' } : undefined}
              >
                {form.customer_contract_type === opt.value
                  ? <CheckCircle size={14} style={{ color: 'hsl(var(--gold))', flexShrink: 0 }} />
                  : <Circle size={14} className="text-muted-foreground shrink-0" />}
                <span className="text-xs text-foreground">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <SliderRow
          label="% revenue tied to owner's personal relationships"
          value={form.key_person_revenue_pct}
          onChange={v => set('key_person_revenue_pct', v)}
          leftLabel="0% — institutionalized"
          rightLabel="100% — fully owner-dependent"
        />

        <SectionTitle>Growth</SectionTitle>

        <div className="mb-5">
          <label className={labelCls}>Qualified sales pipeline ($)</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">$</span>
            <input
              type="number"
              min={0}
              placeholder="e.g. 500000"
              value={form.pipeline_value}
              onChange={e => set('pipeline_value', e.target.value)}
              className={cn(inputCls, 'flex-1')}
            />
          </div>
        </div>

        <div className="mb-2">
          <label className={labelCls}>Market positioning</label>
          <div className="flex flex-col gap-2">
            {MARKET_OPTS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set('market_positioning', opt.value)}
                className={cn(selectedOptionBtn(form.market_positioning === opt.value), 'px-3.5 py-2.5')}
                style={form.market_positioning === opt.value ? { borderColor: 'hsl(var(--gold) / 0.5)', background: 'hsl(var(--gold) / 0.1)' } : undefined}
              >
                {form.market_positioning === opt.value
                  ? <CheckCircle size={14} style={{ color: 'hsl(var(--gold))', flexShrink: 0 }} />
                  : <Circle size={14} className="text-muted-foreground shrink-0" />}
                <span className="text-xs text-foreground flex-1">{opt.label}</span>
                <span
                  className="text-[11px] font-bold shrink-0"
                  style={{
                    color: opt.score >= 70 ? 'hsl(var(--success))' : opt.score >= 40 ? 'hsl(var(--gold))' : 'hsl(var(--destructive))',
                  }}
                >
                  {opt.score} pts
                </span>
              </button>
            ))}
          </div>
        </div>

      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-7 py-3 rounded-lg text-sm font-semibold text-background disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          style={{ background: 'hsl(var(--gold))' }}
        >
          {saving ? 'Saving…' : 'Save & Continue →'}
        </button>
        <button
          onClick={onSkip}
          disabled={saving}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        >
          Skip — complete later →
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Success state
// ---------------------------------------------------------------------------
function Success({ companyId }) {
  const hasCompany = companyId != null && Number.isFinite(companyId) && companyId > 0
  return (
    <div className="text-center py-10">
      <div className="w-16 h-16 rounded-full bg-success/15 border-2 border-success flex items-center justify-center mx-auto mb-5">
        <svg width="28" height="21" viewBox="0 0 28 21" fill="none">
          <path d="M2 10.5L10 18.5L26 2" stroke="hsl(var(--success))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="font-serif text-3xl font-semibold text-foreground mb-3">
        You&rsquo;re all set.
      </h2>
      <p className="text-[15px] text-muted-foreground mb-8">
        {hasCompany
          ? 'Next: capture owner goals and exit timeline in Engagement Intake.'
          : 'Taking you to your dashboard…'}
      </p>
      <div
        className="w-10 h-10 rounded-full border-[3px] border-t-transparent mx-auto animate-spin"
        style={{ borderColor: 'hsl(var(--gold))', borderTopColor: 'transparent' }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(() => {
    const s = readOnboarding().step
    return typeof s === 'number' && s >= 1 && s <= 3 ? s : 1
  })
  const [done, setDone] = useState(false)

  const [createdCompanyId, setCreatedCompanyId] = useState(() => {
    const saved = readOnboarding().createdCompanyId
    return typeof saved === 'number' ? saved : null
  })

  const [step1Saving, setStep1Saving] = useState(false)
  const [step1Error, setStep1Error] = useState(null)
  const [step2Uploading, setStep2Uploading] = useState(false)
  const [step2Error, setStep2Error] = useState(null)

  useEffect(() => {
    writeOnboarding({ step })
  }, [step])

  const handleStep1Next = async (form) => {
    setStep1Saving(true)
    setStep1Error(null)
    try {
      const company = await apiClient.post('/api/companies/', {
        name: form.name.trim(),
        industry: form.industry || null,
        entity_type: form.entityType || null,
      })
      const newId = company?.id ?? null
      setCreatedCompanyId(newId)
      writeOnboarding({ createdCompanyId: newId })
      setStep(2)
    } catch (err) {
      setStep1Error(err?.message ?? 'Failed to create client. Please try again.')
    } finally {
      setStep1Saving(false)
    }
  }

  const handleStep2Next = async (file) => {
    if (!file) {
      setStep(3)
      return
    }
    setStep2Uploading(true)
    setStep2Error(null)
    try {
      if (createdCompanyId) {
        const formData = new FormData()
        formData.append('file', file)
        const ext = file.name.split('.').pop()?.toLowerCase()
        const sourceType = ext === 'csv' || ext === 'xlsx' ? 'quickbooks' : 'other'
        formData.append('source_type', sourceType)
        await apiClient.postMultipart(`/api/ingestion/upload/${createdCompanyId}`, formData)
      }
      setStep(3)
    } catch (err) {
      setStep2Error(err?.message ?? 'Upload failed. You can skip and upload later from the dashboard.')
    } finally {
      setStep2Uploading(false)
    }
  }

  const handleStep2Skip = () => setStep(3)

  const finish = () => {
    try { localStorage.removeItem(ONBOARDING_STORAGE_KEY) } catch { /* ignore */ }
    setDone(true)
    setTimeout(() => {
      if (createdCompanyId != null && Number.isFinite(createdCompanyId) && createdCompanyId > 0) {
        navigate(withCompanyQuery('/EngagementIntake', createdCompanyId), { replace: true })
      } else {
        navigate('/Home', { replace: true })
      }
    }, 1800)
  }

  return (
    <div className="dark min-h-screen bg-background flex flex-col items-center px-6 py-10">
      {/* Top bar */}
      <div
        className="w-full flex items-center justify-between mb-12 transition-all duration-300"
        style={{ maxWidth: step === 3 ? 640 : 520 }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{ background: 'hsl(var(--gold))' }}
          >
            <span className="font-bold text-background font-serif text-base leading-none">F</span>
          </div>
          <span className="text-sm font-semibold text-foreground">Fracture Systems</span>
        </div>
        <span className="text-xs text-muted-foreground bg-card border border-border px-3 py-1 rounded-full">
          Setup
        </span>
      </div>

      {/* Card */}
      <div
        className="w-full bg-card border border-border rounded-2xl p-8 md:p-10 transition-all duration-300"
        style={{ maxWidth: step === 3 ? 640 : 520 }}
      >
        {done ? (
          <Success companyId={createdCompanyId} />
        ) : (
          <>
            <ProgressBar step={step} />

            {step === 1 && (
              <Step1
                onNext={handleStep1Next}
                saving={step1Saving}
                error={step1Error}
              />
            )}
            {step === 2 && (
              <Step2
                onNext={handleStep2Next}
                onSkip={handleStep2Skip}
                uploading={step2Uploading}
                error={step2Error}
              />
            )}
            {step === 3 && (
              <Step3
                onNext={finish}
                onSkip={finish}
                companyId={createdCompanyId}
              />
            )}
          </>
        )}
      </div>

      {!done && (
        <p className="text-xs text-muted-foreground mt-6 text-center">
          Step {step} of 3 — {step === 3 ? 'Interview answers can be updated later in Engagement Intake' : 'You can always finish this later from Settings'}
        </p>
      )}
    </div>
  )
}
