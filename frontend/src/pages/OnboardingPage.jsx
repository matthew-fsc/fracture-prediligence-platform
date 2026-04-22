import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cloud, CheckCircle, Circle, CheckCircle2 } from 'lucide-react'
import { useCompany, useCompanyId } from '../context/CompanyContext'
import { apiUrl, apiClient } from '../lib/apiClient'
import { withCompanyQuery } from '../lib/navLinks'
import { marketingColors as COLORS } from '../theme/marketingColors'
import { toast } from '../lib/notify'

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

const INPUT_STYLE = {
  width: '100%',
  background: COLORS.inputBg,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 8,
  padding: '12px 14px',
  color: COLORS.offWhite,
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}

const LABEL_STYLE = {
  display: 'block',
  color: COLORS.muted,
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 12,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 6,
}

const BTN_PRIMARY = {
  background: COLORS.gold,
  color: COLORS.bg,
  fontFamily: "'DM Sans', sans-serif",
  fontWeight: 700,
  fontSize: 15,
  padding: '13px 28px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  display: 'inline-block',
}

const BTN_GHOST = {
  background: 'transparent',
  border: 'none',
  color: COLORS.muted,
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 14,
  cursor: 'pointer',
  padding: '10px 0',
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
  '$1M-$2.5M',
  '$2.5M-$5M',
  '$5M-$10M',
  '$10M+',
]

const ENTITY_TYPES = [
  'LLC',
  'S-Corp',
  'C-Corp',
  'Partnership',
  'Sole Proprietor',
]

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------
function ProgressBar({ step }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 40 }}>
      {[1, 2, 3].map((n) => ( // 1=Client, 2=Upload, 3=Interview
        <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: n <= step ? COLORS.gold : COLORS.border,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              fontWeight: 700,
              color: n <= step ? COLORS.bg : COLORS.muted,
              transition: 'background 0.3s ease',
            }}
          >
            {n < step ? '✓' : n}
          </div>
          {n < 3 && (
            <div
              style={{
                width: 60,
                height: 2,
                background: n < step ? COLORS.gold : COLORS.border,
                transition: 'background 0.3s ease',
              }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1 — Add first client
// ---------------------------------------------------------------------------
function Step1({ onNext, submitting, submitError }) {
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
      <h2
        style={{
          color: COLORS.offWhite,
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 30,
          fontWeight: 600,
          margin: '0 0 8px 0',
        }}
      >
        Add your first client
      </h2>
      <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14, margin: '0 0 32px 0' }}>
        This creates your first client engagement and pre-diligence workspace.
      </p>

      <div style={{ marginBottom: 20 }}>
        <label style={LABEL_STYLE}>Client Name</label>
        <input
          type="text"
          placeholder="e.g. Lakeside HVAC Services LLC"
          value={form.name}
          onChange={set('name')}
          style={INPUT_STYLE}
          required
          aria-invalid={nameError ? 'true' : 'false'}
          aria-describedby={nameError ? 'client-name-error' : undefined}
        />
        {nameError && (
          <p id="client-name-error" role="alert" style={{ color: '#F87171', fontFamily: "'DM Sans', sans-serif", fontSize: 12, marginTop: 8 }}>
            {nameError}
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div>
          <label style={LABEL_STYLE}>Industry</label>
          <select value={form.industry} onChange={set('industry')} style={{ ...INPUT_STYLE, appearance: 'none' }}>
            <option value="">Select industry</option>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div>
          <label style={LABEL_STYLE}>Revenue Range</label>
          <select value={form.revenueRange} onChange={set('revenueRange')} style={{ ...INPUT_STYLE, appearance: 'none' }}>
            <option value="">Select range</option>
            {REVENUE_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <label style={LABEL_STYLE}>Entity Type</label>
        <select value={form.entityType} onChange={set('entityType')} style={{ ...INPUT_STYLE, appearance: 'none' }}>
          <option value="">Select entity type</option>
          {ENTITY_TYPES.map((et) => <option key={et} value={et}>{et}</option>)}
        </select>
      </div>

      {submitError && (
        <p role="alert" style={{ color: '#F87171', fontFamily: "'DM Sans', sans-serif", fontSize: 12, margin: '0 0 12px 0' }}>
          {submitError}
        </p>
      )}
      <button type="submit" disabled={submitting} style={{ ...BTN_PRIMARY, opacity: submitting ? 0.7 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>
        {submitting ? 'Adding Client...' : 'Add Client and Continue'}
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Step 2 — Upload first document
// ---------------------------------------------------------------------------
function Step2({ onNext, onSkip }) {
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
    const f = e.dataTransfer.files[0]
    handleFile(f)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = () => setDragging(false)

  return (
    <div>
      <h2
        style={{
          color: COLORS.offWhite,
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 30,
          fontWeight: 600,
          margin: '0 0 8px 0',
        }}
      >
        Upload your first document
      </h2>
      <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14, margin: '0 0 32px 0' }}>
        For now, the uploaded file will be analyzed in your first engagement.
        Accepted: PDF, XLSX, CSV, DOCX.
      </p>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? COLORS.gold : COLORS.border}`,
          borderRadius: 10,
          padding: '48px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? 'rgba(201,151,58,0.05)' : COLORS.inputBg,
          transition: 'all 0.2s ease',
          marginBottom: 20,
        }}
      >
        <Cloud
          style={{
            color: file ? COLORS.gold : COLORS.muted,
            width: 40,
            height: 40,
            margin: '0 auto 12px',
            display: 'block',
          }}
        />
        {file ? (
          <p style={{ color: COLORS.offWhite, fontFamily: "'DM Sans', sans-serif", fontSize: 14, margin: 0, fontWeight: 500 }}>
            {file.name}
          </p>
        ) : (
          <>
            <p style={{ color: COLORS.offWhite, fontFamily: "'DM Sans', sans-serif", fontSize: 14, margin: '0 0 4px 0', fontWeight: 500 }}>
              Drag & drop or click to browse
            </p>
            <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 12, margin: 0 }}>
              PDF, XLSX, CSV, DOCX - Max 25MB
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.xlsx,.csv,.docx"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          onClick={() => onNext(file)}
          disabled={!file}
          style={{
            ...BTN_PRIMARY,
            opacity: file ? 1 : 0.5,
            cursor: file ? 'pointer' : 'not-allowed',
          }}
        >
          Upload and Continue
        </button>
        <button onClick={onSkip} style={BTN_GHOST}>
          Skip for now
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
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <label style={LABEL_STYLE}>{label}</label>
        <span style={{ color: COLORS.offWhite, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700 }}>{value}%</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', accentColor: COLORS.gold, cursor: 'pointer' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 11 }}>{leftLabel}</span>
        <span style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 11 }}>{rightLabel}</span>
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
  { value: 'moderate',         label: 'Moderate - some differentiation, inconsistent execution', score: 45 },
  { value: 'undifferentiated', label: 'Undifferentiated - competing on price or availability', score: 10 },
]

function Step3({ onNext, onSkip }) {
  const companyId = useCompanyId()
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
    if (!companyId || companyId === 1) {
      toast.message('Finish setup on your own client company before saving interview inputs.')
      onNext()
      return
    }
    setSaving(true)
    try {
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
    } catch (_) { /* non-blocking */ }
    setSaving(false)
    onNext()
  }

  const SectionTitle = ({ children }) => (
    <p style={{ color: COLORS.gold, fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.1em', margin: '24px 0 14px 0', borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 8 }}>
      {children}
    </p>
  )

  return (
    <div>
      <h2 style={{ color: COLORS.offWhite, fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: 28, fontWeight: 600, margin: '0 0 6px 0' }}>
        Advisor Interview
      </h2>
      <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13, margin: '0 0 4px 0' }}>
        These answers feed directly into the Readiness Score for metrics that financials cannot capture.
      </p>
      <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 11, margin: '0 0 6px 0' }}>
        All inputs can be updated later in Engagement Intake.
      </p>

      {/* Scrollable form area */}
      <div style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 4, marginBottom: 20 }}>

        <SectionTitle>Owner &amp; Operations</SectionTitle>

        <div style={{ marginBottom: 20 }}>
          <label style={LABEL_STYLE}>Owner hours in day-to-day operations (per week)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="number" min={0} max={80} placeholder="e.g. 30"
              value={form.owner_hours_per_week}
              onChange={e => set('owner_hours_per_week', e.target.value)}
              style={{ ...INPUT_STYLE, width: 100 }} />
            <span style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>hrs/week</span>
          </div>
        </div>

        <SliderRow label="SOP Documentation" value={form.sop_pct}
          onChange={v => set('sop_pct', v)} leftLabel="0% - none" rightLabel="100% - fully documented" />

        <div style={{ marginBottom: 20 }}>
          <label style={LABEL_STYLE}>Management Depth (qualified managers / total core functions)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="number" min={0} max={10} placeholder="0"
              value={form.mgmt_qualified}
              onChange={e => set('mgmt_qualified', e.target.value)}
              style={{ ...INPUT_STYLE, width: 70, textAlign: 'center' }} />
            <span style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>/</span>
            <input type="number" min={1} max={10} placeholder="4"
              value={form.mgmt_total_functions}
              onChange={e => set('mgmt_total_functions', e.target.value)}
              style={{ ...INPUT_STYLE, width: 70, textAlign: 'center' }} />
            <span style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>functions</span>
          </div>
        </div>

        <SectionTitle>Revenue Contracts &amp; Key Person</SectionTitle>

        <SliderRow label="% customers with formal contract or MSA" value={form.contract_pct}
          onChange={v => set('contract_pct', v)} leftLabel="0% - verbal only" rightLabel="100% - fully contracted" />

        <div style={{ marginBottom: 20 }}>
          <label style={LABEL_STYLE}>Primary contract type</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {CONTRACT_TYPES.map(opt => (
              <button key={opt.value} type="button"
                onClick={() => set('customer_contract_type', opt.value)}
                style={{
                  background: form.customer_contract_type === opt.value ? 'rgba(201,151,58,0.12)' : COLORS.inputBg,
                  border: `1px solid ${form.customer_contract_type === opt.value ? COLORS.gold : COLORS.border}`,
                  borderRadius: 8, padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                {form.customer_contract_type === opt.value
                  ? <CheckCircle size={14} color={COLORS.gold} />
                  : <Circle size={14} color={COLORS.muted} />}
                <span style={{ color: COLORS.offWhite, fontFamily: "'DM Sans', sans-serif", fontSize: 12 }}>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <SliderRow label="% revenue tied to owner's personal relationships" value={form.key_person_revenue_pct}
          onChange={v => set('key_person_revenue_pct', v)} leftLabel="0% - institutionalized" rightLabel="100% - fully owner-dependent" />

        <SectionTitle>Growth</SectionTitle>

        <div style={{ marginBottom: 20 }}>
          <label style={LABEL_STYLE}>Qualified sales pipeline ($)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>$</span>
            <input type="number" min={0} placeholder="e.g. 500000"
              value={form.pipeline_value}
              onChange={e => set('pipeline_value', e.target.value)}
              style={{ ...INPUT_STYLE, width: '100%' }} />
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={LABEL_STYLE}>Market positioning</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MARKET_OPTS.map(opt => (
              <button key={opt.value} type="button"
                onClick={() => set('market_positioning', opt.value)}
                style={{
                  background: form.market_positioning === opt.value ? 'rgba(201,151,58,0.12)' : COLORS.inputBg,
                  border: `1px solid ${form.market_positioning === opt.value ? COLORS.gold : COLORS.border}`,
                  borderRadius: 8, padding: '10px 14px', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                {form.market_positioning === opt.value
                  ? <CheckCircle size={14} color={COLORS.gold} />
                  : <Circle size={14} color={COLORS.muted} />}
                <span style={{ color: COLORS.offWhite, fontFamily: "'DM Sans', sans-serif", fontSize: 12, flex: 1 }}>{opt.label}</span>
                <span style={{ color: opt.score >= 70 ? '#4ABEA4' : opt.score >= 40 ? COLORS.gold : '#EF4444',
                  fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                  {opt.score} pts
                </span>
              </button>
            ))}
          </div>
        </div>

      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={handleSave} disabled={saving} style={{ ...BTN_PRIMARY, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving...' : 'Save and Continue'}
        </button>
        <button onClick={onSkip} style={BTN_GHOST}>
          Skip - complete later
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Success state
// ---------------------------------------------------------------------------
function Success({ toIntake }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <CheckCircle2
        style={{ color: 'hsl(160, 84%, 39%)', width: 52, height: 52, margin: '0 auto 20px' }}
      />
      <h2
        style={{
          color: COLORS.offWhite,
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 30,
          fontWeight: 600,
          margin: '0 0 12px 0',
        }}
      >
        You're all set.
      </h2>
      <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 15, margin: '0 0 32px 0' }}>
        {toIntake
          ? 'Next: capture owner goals and exit timeline in Engagement Intake.'
          : 'Taking you to your dashboard...'}
      </p>
      <div
        style={{
          width: 40,
          height: 40,
          border: '3px solid hsl(160, 84%, 39%)',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function OnboardingPage() {
  const navigate = useNavigate()
  const { setCompanyId } = useCompany()
  const companyId = useCompanyId()
  const [step, setStep] = useState(() => {
    const s = readOnboarding().step
    return typeof s === 'number' && s >= 1 && s <= 3 ? s : 1
  })
  const [done, setDone] = useState(false)
  const [creatingCompany, setCreatingCompany] = useState(false)
  const [step1SubmitError, setStep1SubmitError] = useState('')

  const handleStep1Next = async (form) => {
    if (creatingCompany) return
    setCreatingCompany(true)
    setStep1SubmitError('')
    try {
      const created = await apiClient.post('/api/companies', {
        name: form.name?.trim(),
        industry: form.industry || null,
        entity_type: form.entityType || null,
      })
      if (created?.id) {
        setCompanyId(created.id)
        setStep(2)
      } else {
        setStep1SubmitError('Could not create company. Please try again.')
      }
    } catch (err) {
      setStep1SubmitError(err?.message || 'Could not create company. Please try again.')
    } finally {
      setCreatingCompany(false)
    }
  }

  useEffect(() => {
    writeOnboarding({ step })
  }, [step])

  const finish = () => {
    setDone(true)
    setTimeout(() => {
      if (companyId != null && Number.isFinite(companyId) && companyId > 0) {
        navigate(withCompanyQuery('/EngagementIntake', companyId), { replace: true })
      } else {
        navigate('/Home', { replace: true })
      }
    }, 1800)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: COLORS.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 24px',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          width: '100%',
          maxWidth: step === 3 ? 640 : 520,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 48,
          transition: 'max-width 0.3s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              background: COLORS.gold,
              borderRadius: 6,
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: COLORS.bg, fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 15 }}>F</span>
          </div>
          <span style={{ color: COLORS.offWhite, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 15 }}>
            Fracture Systems
          </span>
        </div>
        <span
          style={{
            color: COLORS.muted,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            padding: '4px 12px',
            borderRadius: 20,
          }}
        >
          Setup
        </span>
      </div>

      {/* Card — wider on step 3 to accommodate questionnaire */}
      <div
        style={{
          width: '100%',
          maxWidth: step === 3 ? 640 : 520,
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: '40px 36px',
          transition: 'max-width 0.3s ease',
        }}
      >
        {done ? (
          <Success toIntake={companyId != null && Number.isFinite(companyId) && companyId > 0} />
        ) : (
          <>
            <ProgressBar step={step} />

            {step === 1 && (
              <Step1
                onNext={handleStep1Next}
                submitting={creatingCompany}
                submitError={step1SubmitError}
              />
            )}
            {step === 2 && (
              <Step2
                onNext={() => setStep(3)}
                onSkip={() => setStep(3)}
              />
            )}
            {step === 3 && (
              <Step3
                onNext={() => finish()}
                onSkip={() => finish()}
              />
            )}
          </>
        )}
      </div>

      {/* Footer note */}
      {!done && (
        <p
          style={{
            color: COLORS.muted,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            marginTop: 24,
            textAlign: 'center',
          }}
        >
          Step {step} of 3 - {step === 3 ? 'Interview answers can be updated later in Engagement Intake' : 'You can always finish this later from Settings'}
        </p>
      )}
    </div>
  )
}
