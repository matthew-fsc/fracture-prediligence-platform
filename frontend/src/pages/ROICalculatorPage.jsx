import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'

const COLORS = {
  bg: '#0A1628', gold: '#C9973A', offWhite: '#F0EDE8',
  muted: '#8A9BB0', card: '#0F2040', border: '#1E3A5F', green: '#16a34a',
}

// All calculations are purely client-side. No backend required.
// Assumptions are conservative and based on CEPA industry averages.

function Slider({ label, value, onChange, min, max, step = 1, format = v => v }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>{label}</label>
        <span style={{ color: COLORS.gold, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 18, fontWeight: 700 }}>
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: COLORS.gold }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
        <span style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 11 }}>{format(min)}</span>
        <span style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 11 }}>{format(max)}</span>
      </div>
    </div>
  )
}

function ResultCard({ label, value, sub, highlight }) {
  return (
    <div style={{
      background: highlight ? 'rgba(201,151,58,0.1)' : COLORS.card,
      border: `1px solid ${highlight ? COLORS.gold : COLORS.border}`,
      borderRadius: 12, padding: '20px 24px',
    }}>
      <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px 0' }}>{label}</p>
      <p style={{ color: highlight ? COLORS.gold : COLORS.offWhite, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 32, fontWeight: 700, margin: 0 }}>{value}</p>
      {sub && <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 12, marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

const fmt$ = v => `$${v.toLocaleString()}`
const fmtHr = v => `${v} hrs`

export default function ROICalculatorPage() {
  usePageTitle('ROI Calculator')

  const [engagements, setEngagements] = useState(8)
  const [avgFee, setAvgFee] = useState(8000)
  const [hoursPerEngagement, setHoursPerEngagement] = useState(20)
  const [hourlyRate, setHourlyRate] = useState(200)
  const [feePremiumPct, setFeePremiumPct] = useState(15)

  // — Calculations —
  const hoursPerYear = engagements * hoursPerEngagement
  // Platform cuts prep time by ~60% (conservative assumption)
  const hoursSavedPct = 0.60
  const hoursSaved = Math.round(hoursPerYear * hoursSavedPct)
  const dollarsSavedFromTime = hoursSaved * hourlyRate

  // Fee premium: advisors using institutional-grade deliverables can command higher fees
  const feePremiumPerEngagement = Math.round(avgFee * (feePremiumPct / 100))
  const totalFeePremium = feePremiumPerEngagement * engagements

  // Total annual ROI
  const totalROI = dollarsSavedFromTime + totalFeePremium

  // Platform cost (Pro monthly, annualized) — kept as display only, not hardcoded
  const platformAnnualCost = 299 * 12  // approximate; actual billed by Stripe
  const roiMultiple = totalROI > 0 ? (totalROI / platformAnnualCost).toFixed(1) : '0'

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg }}>
      {/* Nav */}
      <nav style={{ background: 'rgba(10,22,40,0.95)', borderBottom: `1px solid ${COLORS.border}`, backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ background: COLORS.gold, borderRadius: 6, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: COLORS.bg, fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 15 }}>F</span>
            </div>
            <span style={{ color: COLORS.offWhite, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 15 }}>Fracture Systems</span>
          </Link>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <Link to="/pricing" style={{ color: COLORS.gold, fontFamily: "'DM Sans', sans-serif", fontSize: 14, textDecoration: 'none' }}>View pricing →</Link>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '64px 24px 80px' }}>
        <p style={{ color: COLORS.gold, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 12 }}>
          Advisor ROI Calculator
        </p>
        <h1 style={{ color: COLORS.offWhite, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 700, margin: '0 0 12px 0', lineHeight: 1.15 }}>
          How much is your time worth?
        </h1>
        <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 15, maxWidth: 560, lineHeight: 1.7, margin: '0 0 48px 0' }}>
          See the dollar value of time saved on pre-diligence prep — and how much more you can charge when your deliverables look institutional.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 40 }}>
          {/* Inputs */}
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: '32px 28px' }}>
            <h2 style={{ color: COLORS.offWhite, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, fontWeight: 600, margin: '0 0 28px 0' }}>Your practice</h2>

            <Slider label="Engagements per year" value={engagements} onChange={setEngagements} min={1} max={30} />
            <Slider label="Average pre-diligence fee" value={avgFee} onChange={setAvgFee} min={1000} max={50000} step={500} format={fmt$} />
            <Slider label="Hours of manual prep per engagement" value={hoursPerEngagement} onChange={setHoursPerEngagement} min={4} max={60} format={fmtHr} />
            <Slider label="Your effective hourly rate" value={hourlyRate} onChange={setHourlyRate} min={50} max={600} step={25} format={fmt$} />
            <Slider
              label="Fee premium from better deliverables"
              value={feePremiumPct}
              onChange={setFeePremiumPct}
              min={0}
              max={40}
              step={1}
              format={v => `${v}%`}
            />
            <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 11, lineHeight: 1.5, marginTop: 8 }}>
              Advisors using institutional-grade deliverables typically command 10–25% higher fees vs. spreadsheet-based prep.
            </p>
          </div>

          {/* Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ResultCard
              label="Hours saved per year"
              value={`${hoursSaved.toLocaleString()} hrs`}
              sub={`${Math.round(hoursSavedPct * 100)}% reduction in manual prep time`}
            />
            <ResultCard
              label="Value of time recovered"
              value={fmt$(dollarsSavedFromTime)}
              sub={`${hoursSaved} hrs × ${fmt$(hourlyRate)}/hr`}
            />
            <ResultCard
              label="Additional fee revenue"
              value={fmt$(totalFeePremium)}
              sub={`${fmt$(feePremiumPerEngagement)} premium × ${engagements} engagements`}
            />
            <ResultCard
              label="Total annual ROI"
              value={fmt$(totalROI)}
              sub={`vs. approx. ${fmt$(platformAnnualCost)}/yr platform cost`}
              highlight
            />
            <div style={{
              background: 'rgba(22,163,74,0.1)',
              border: `1px solid rgba(22,163,74,0.3)`,
              borderRadius: 12, padding: '16px 20px',
              textAlign: 'center',
            }}>
              <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 12, margin: '0 0 4px 0' }}>Return on investment</p>
              <p style={{ color: COLORS.green, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 40, fontWeight: 700, margin: 0 }}>{roiMultiple}×</p>
              <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 12, marginTop: 4 }}>return on platform cost</p>
            </div>

            <Link
              to="/pricing"
              style={{
                display: 'block', textAlign: 'center',
                background: COLORS.gold, color: COLORS.bg,
                fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15,
                padding: '14px 24px', borderRadius: 10, textDecoration: 'none',
                marginTop: 8,
              }}
            >
              Start your free trial →
            </Link>
            <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 12, textAlign: 'center' }}>
              14-day trial · No credit card required
            </p>
          </div>
        </div>

        <div style={{ marginTop: 40, padding: '20px 24px', background: COLORS.card, borderRadius: 12, border: `1px solid ${COLORS.border}` }}>
          <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 12, lineHeight: 1.6, margin: 0 }}>
            <strong style={{ color: COLORS.offWhite }}>Methodology:</strong> Time savings assume a 60% reduction in manual pre-diligence prep (data normalization, DRS scoring, report assembly). Fee premium is based on advisor-reported outcomes from structured deliverables vs. unstructured spreadsheets. Individual results vary. Platform cost shown is the approximate Pro tier monthly rate annualized; actual billing is set at checkout and may differ.
          </p>
        </div>
      </div>
    </div>
  )
}
