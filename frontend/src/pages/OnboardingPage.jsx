import { useState, useRef } from 'react'
import { Cloud } from 'lucide-react'

const COLORS = {
  bg: '#0A1628',
  gold: '#C9973A',
  lightGold: '#E8B96A',
  offWhite: '#F0EDE8',
  muted: '#8A9BB0',
  card: '#0F2040',
  border: '#1E3A5F',
}

const INPUT_STYLE = {
  width: '100%',
  background: COLORS.bg,
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
  '$1M–$2.5M',
  '$2.5M–$5M',
  '$5M–$10M',
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
      {[1, 2, 3].map((n) => (
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
function Step1({ onNext }) {
  const [form, setForm] = useState({
    name: '',
    industry: '',
    revenueRange: '',
    entityType: '',
  })

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
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
        />
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

      <button type="submit" style={BTN_PRIMARY}>
        Add Client & Continue →
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
          background: dragging ? 'rgba(201,151,58,0.05)' : COLORS.bg,
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
              PDF, XLSX, CSV, DOCX · Max 25MB
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
          Upload & Continue →
        </button>
        <button onClick={onSkip} style={BTN_GHOST}>
          Skip for now →
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3 — Invite team member
// ---------------------------------------------------------------------------
function Step3({ onNext, onSkip }) {
  const [email, setEmail] = useState('')

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
        Invite a team member{' '}
        <span style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 400 }}>
          (optional)
        </span>
      </h2>
      <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14, margin: '0 0 32px 0' }}>
        Bring in a co-advisor, associate, or client contact.
      </p>

      <div style={{ marginBottom: 28 }}>
        <label style={LABEL_STYLE}>Email address</label>
        <input
          type="email"
          placeholder="colleague@yourfirm.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={INPUT_STYLE}
        />
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => onNext(email)}
          disabled={!email.trim()}
          style={{
            ...BTN_PRIMARY,
            opacity: email.trim() ? 1 : 0.5,
            cursor: email.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Send Invite →
        </button>
        <button onClick={onSkip} style={BTN_GHOST}>
          Skip — I'll set up solo →
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Success state
// ---------------------------------------------------------------------------
function Success() {
  return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <div style={{ fontSize: 48, marginBottom: 20 }}>🎉</div>
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
        Taking you to your dashboard...
      </p>
      <div
        style={{
          width: 40,
          height: 40,
          border: `3px solid ${COLORS.gold}`,
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
  const [step, setStep] = useState(1)
  const [done, setDone] = useState(false)

  const finish = () => {
    setDone(true)
    setTimeout(() => {
      window.location.href = '/Home'
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
          maxWidth: 520,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 48,
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

      {/* Card */}
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: '40px 36px',
        }}
      >
        {done ? (
          <Success />
        ) : (
          <>
            <ProgressBar step={step} />

            {step === 1 && (
              <Step1
                onNext={() => setStep(2)}
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
          Step {step} of 3 · You can always finish this later from Settings
        </p>
      )}
    </div>
  )
}
