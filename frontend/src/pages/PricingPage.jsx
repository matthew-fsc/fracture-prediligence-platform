import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'
import { apiRequest } from '../lib/apiClient'

const COLORS = {
  bg: '#0A1628', gold: '#17a773', lightGold: '#4ABEA4', offWhite: '#F0EDE8',
  muted: '#8A9BB0', card: '#0F2040', border: '#1E3A5F',
}

// ---------------------------------------------------------------------------
// Tier definitions — prices are display strings only.
// Actual billing amounts come from Stripe price IDs configured server-side.
// ---------------------------------------------------------------------------
const TIERS = [
  {
    id: 'founding',
    name: 'Founding Advisor',
    monthlyPrice: '$179',
    annualMonthlyEquiv: '$149',   // display: annual total ÷ 12
    annualTotal: '$1,490',        // display: 10 months × $149
    per: '/mo',
    badge: 'Limited — 20 spots',
    highlight: true,
    tagline: 'Rate locked for life',
    features: [
      'All Pro features',
      'Founding member rate locked for life',
      'White-glove onboarding call',
      'Direct access to product roadmap',
      'Founding member badge',
    ],
    cta: 'Claim Founding Access →',
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: '$299',
    annualMonthlyEquiv: '$249',
    annualTotal: '$2,490',
    per: '/mo',
    badge: null,
    highlight: false,
    tagline: 'For active CEPA advisors',
    features: [
      'Unlimited client engagements',
      'Full DRS scoring engine',
      'PDF report generation',
      'Data room organization',
      'Priority support',
    ],
    cta: 'Start Free Trial →',
  },
  {
    id: 'team',
    name: 'Team',
    monthlyPrice: '$799',
    annualMonthlyEquiv: '$665',
    annualTotal: '$6,650',
    per: '/mo',
    badge: null,
    highlight: false,
    tagline: 'For advisory firms',
    features: [
      'Up to 5 advisors',
      'Shared client workspace',
      'Team reporting dashboard',
      'Custom branding on reports',
      'API access',
    ],
    cta: 'Contact Us →',
    mailto: 'hello@exitblueprint.net',
  },
]

// ---------------------------------------------------------------------------
// Checkout handler
// ---------------------------------------------------------------------------
async function startCheckout(tierId, billingInterval, userEmail, refCode, partnerSlug) {
  const body = { tier: tierId, billing_interval: billingInterval, email: userEmail }
  if (refCode) body.ref_code = refCode
  if (partnerSlug) body.partner_slug = partnerSlug
  const data = await apiRequest('/api/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  window.location.href = data.checkout_url
}

// ---------------------------------------------------------------------------
// Billing interval toggle
// ---------------------------------------------------------------------------
function BillingToggle({ interval, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 40 }}>
      <button
        onClick={() => onChange('monthly')}
        style={{
          background: interval === 'monthly' ? COLORS.gold : 'transparent',
          color: interval === 'monthly' ? COLORS.bg : COLORS.muted,
          border: `1.5px solid ${interval === 'monthly' ? COLORS.gold : COLORS.border}`,
          fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 13,
          padding: '7px 20px', borderRadius: '8px 0 0 8px', cursor: 'pointer',
        }}
      >
        Monthly
      </button>
      <button
        onClick={() => onChange('annual')}
        style={{
          background: interval === 'annual' ? COLORS.gold : 'transparent',
          color: interval === 'annual' ? COLORS.bg : COLORS.muted,
          border: `1.5px solid ${interval === 'annual' ? COLORS.gold : COLORS.border}`,
          borderLeft: 'none',
          fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 13,
          padding: '7px 20px', borderRadius: '0 8px 8px 0', cursor: 'pointer',
          position: 'relative',
        }}
      >
        Annual
        <span style={{
          position: 'absolute', top: -10, right: -4,
          background: '#16a34a', color: '#fff',
          fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 800,
          padding: '2px 6px', borderRadius: 10, letterSpacing: '0.05em',
        }}>
          2 MONTHS FREE
        </span>
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pricing card
// ---------------------------------------------------------------------------
function TierCard({ tier, billingInterval, refCode, partnerSlug }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const displayPrice = billingInterval === 'annual' ? tier.annualMonthlyEquiv : tier.monthlyPrice
  const subline = billingInterval === 'annual'
    ? `Billed ${tier.annualTotal}/yr — save 2 months`
    : null

  const handleCTA = async () => {
    if (tier.mailto) {
      window.location.href = `mailto:${tier.mailto}?subject=Exit Blueprint Team Plan Inquiry`
      return
    }
    setLoading(true)
    setError('')
    try {
      await startCheckout(tier.id, billingInterval, '', refCode, partnerSlug)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        background: COLORS.card,
        border: tier.highlight ? `2px solid ${COLORS.gold}` : `1px solid ${COLORS.border}`,
        borderRadius: 14,
        padding: '36px 28px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {tier.badge && (
        <div
          style={{
            position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
            background: COLORS.gold, color: COLORS.bg, fontFamily: "'DM Sans', sans-serif",
            fontSize: 11, fontWeight: 700, padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap', letterSpacing: '0.05em',
          }}
        >
          {tier.badge}
        </div>
      )}

      <h3 style={{ color: COLORS.offWhite, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 24, fontWeight: 600, margin: '0 0 4px 0' }}>
        {tier.name}
      </h3>
      <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13, margin: '0 0 20px 0' }}>
        {tier.tagline}
      </p>

      <div style={{ marginBottom: subline ? 8 : 24 }}>
        <span style={{ color: tier.highlight ? COLORS.gold : COLORS.offWhite, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 44, fontWeight: 700 }}>
          {displayPrice}
        </span>
        <span style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>{tier.per}</span>
      </div>
      {subline && (
        <p style={{ color: '#16a34a', fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, margin: '0 0 20px 0' }}>
          {subline}
        </p>
      )}

      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px 0', flex: 1 }}>
        {tier.features.map((feat) => (
          <li key={feat} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
            <span style={{ color: COLORS.gold, fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
            <span style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14, lineHeight: 1.5 }}>{feat}</span>
          </li>
        ))}
      </ul>

      {error && (
        <p style={{ color: '#f87171', fontFamily: "'DM Sans', sans-serif", fontSize: 12, marginBottom: 12 }}>{error}</p>
      )}

      <button
        onClick={handleCTA}
        disabled={loading}
        style={{
          display: 'block', width: '100%', textAlign: 'center',
          background: tier.highlight ? COLORS.gold : 'transparent',
          color: tier.highlight ? COLORS.bg : COLORS.gold,
          border: tier.highlight ? 'none' : `1.5px solid ${COLORS.gold}`,
          fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 14,
          padding: '13px 20px', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s',
        }}
      >
        {loading ? 'Redirecting...' : tier.cta}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function PricingPage() {
  usePageTitle('Pricing')
  const [searchParams] = useSearchParams()
  const [billingInterval, setBillingInterval] = useState('monthly')

  // Pass referral and partner context from URL query params through to checkout
  const refCode = searchParams.get('ref') || ''
  const partnerSlug = searchParams.get('partner') || ''

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg }}>
      {/* Nav */}
      <nav style={{ background: 'rgba(10,22,40,0.95)', borderBottom: `1px solid ${COLORS.border}`, backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ background: COLORS.gold, borderRadius: 6, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: COLORS.bg, fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 15 }}>F</span>
            </div>
            <span style={{ color: COLORS.offWhite, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 15 }}>Exit Blueprint</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Link to="/roi-calculator" style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14, textDecoration: 'none' }}>Calculate your ROI</Link>
            <Link to="/request-demo" style={{ color: COLORS.gold, fontFamily: "'DM Sans', sans-serif", fontSize: 14, textDecoration: 'none' }}>Request live demo</Link>
            <Link to="/sign-in" style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14, textDecoration: 'none' }}>Sign In</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: '80px 24px 40px', textAlign: 'center' }}>
        <p style={{ color: COLORS.gold, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 16 }}>
          Simple, transparent pricing
        </p>
        <h1 style={{ color: COLORS.offWhite, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 700, margin: '0 0 16px 0', lineHeight: 1.1 }}>
          Lock in your advisor rate today.
        </h1>
        <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 16, maxWidth: 480, margin: '0 auto 12px', lineHeight: 1.7 }}>
          20 founding spots at $179/mo — rate locked for life. Full access to every feature.
        </p>
        <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13, marginBottom: 40 }}>
          All plans include a 14-day free trial. No credit card required to start.
        </p>
        <BillingToggle interval={billingInterval} onChange={setBillingInterval} />
      </section>

      {/* Pricing grid */}
      <section style={{ padding: '0 24px 100px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
          {TIERS.map((tier) => (
            <TierCard
              key={tier.id}
              tier={tier}
              billingInterval={billingInterval}
              refCode={refCode}
              partnerSlug={partnerSlug}
            />
          ))}
        </div>
      </section>

      {/* ROI teaser strip */}
      <section style={{ background: 'rgba(23,167,115,0.07)', borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}`, padding: '36px 24px', textAlign: 'center' }}>
        <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14, margin: '0 0 10px 0' }}>
          One additional engagement per year pays for a full year of the Pro plan — often many times over.
        </p>
        <Link to="/roi-calculator" style={{ color: COLORS.gold, fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
          Calculate your ROI →
        </Link>
      </section>

      {/* FAQ strip */}
      <section style={{ background: '#0F2040', borderTop: `1px solid ${COLORS.border}`, padding: '60px 24px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ color: COLORS.offWhite, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 28, fontWeight: 600, margin: '0 0 32px 0' }}>Questions?</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, textAlign: 'left' }}>
            {[
              { q: 'What happens after the free trial?', a: "You'll be charged your plan rate automatically. Cancel anytime before the trial ends and you won't be charged." },
              { q: 'What is the difference between monthly and annual billing?', a: 'Annual billing is equivalent to 10 months — you get two months free compared to paying monthly. Your card is charged once per year.' },
              { q: 'Can I switch plans?', a: 'Yes. Upgrade or downgrade at any time from your account settings.' },
              { q: 'What is a Founding Advisor spot?', a: 'The first 20 advisors who subscribe lock in $179/mo for life — even when the Pro tier increases to market rate.' },
            ].map(({ q, a }) => (
              <div key={q} style={{ borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 20 }}>
                <p style={{ color: COLORS.offWhite, fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, margin: '0 0 6px 0' }}>{q}</p>
                <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14, lineHeight: 1.6, margin: 0 }}>{a}</p>
              </div>
            ))}
          </div>
          <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14, marginTop: 28 }}>
            Still have questions?{' '}
            <a href="mailto:hello@exitblueprint.net" style={{ color: COLORS.gold, textDecoration: 'none' }}>Email us →</a>
          </p>
        </div>
      </section>
    </div>
  )
}
