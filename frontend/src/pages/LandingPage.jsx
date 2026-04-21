import { Link } from 'react-router-dom'
import { Show, SignInButton, SignUpButton } from '@clerk/react'
import { AlertTriangle, Clock, BarChart3, FolderOpen, TrendingUp, FileText, CheckSquare } from 'lucide-react'
import { marketingColors as COLORS } from '../theme/marketingColors'

const HAS_CLERK = Boolean((import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim())

// ---------------------------------------------------------------------------
// Nav
// ---------------------------------------------------------------------------
function Nav() {
  return (
    <nav
      style={{ background: 'rgba(12,14,18,0.95)', borderBottom: `1px solid ${COLORS.border}`, backdropFilter: 'blur(12px)' }}
      className="sticky top-0 z-50 w-full"
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            style={{ background: COLORS.gold, borderRadius: 6, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <span style={{ color: COLORS.bg, fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 16 }}>F</span>
          </div>
          <span style={{ color: COLORS.offWhite, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 15 }}>
            Fracture Systems
          </span>
        </div>

        {/* Right nav — Clerk prebuilt buttons when configured; plain links otherwise */}
        <div className="flex items-center gap-4 sm:gap-6">
          {HAS_CLERK ? (
            <>
              <Show when="signed-out">
                <SignInButton
                  mode="redirect"
                  forceRedirectUrl="/Home"
                  style={{
                    color: COLORS.offWhite,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    fontWeight: 500,
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: `1px solid ${COLORS.border}`,
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  Log in
                </SignInButton>
                <SignUpButton
                  mode="redirect"
                  forceRedirectUrl="/dashboard/onboarding"
                  style={{
                    color: COLORS.bg,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    fontWeight: 600,
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: 'none',
                    background: COLORS.gold,
                    cursor: 'pointer',
                    marginLeft: 8,
                  }}
                >
                  Sign up
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <Link
                  to="/Home"
                  style={{
                    color: COLORS.offWhite,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    fontWeight: 500,
                    textDecoration: 'none',
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: `1px solid ${COLORS.border}`,
                  }}
                >
                  Dashboard
                </Link>
              </Show>
            </>
          ) : (
            <Link
              to="/Home"
              style={{
                color: COLORS.offWhite,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14,
                fontWeight: 500,
                textDecoration: 'none',
                padding: '8px 14px',
                borderRadius: 8,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              Dashboard
            </Link>
          )}
          <Link
            to="/request-demo"
            style={{ color: COLORS.gold, fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, textDecoration: 'none' }}
          >
            Request live demo
          </Link>
        </div>
      </div>
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------
function Hero() {
  return (
    <section
      style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}
    >
      <div style={{ maxWidth: 720, textAlign: 'center' }}>
        {/* Eyebrow */}
        <p
          style={{
            color: COLORS.gold,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom: 28,
          }}
        >
          Built for CEPA Advisors
        </p>

        {/* H1 */}
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", margin: 0, lineHeight: 1.1 }}>
          <span style={{ color: COLORS.offWhite, fontSize: 'clamp(48px, 7vw, 80px)', display: 'block' }}>
            Your clients deserve
          </span>
          <span style={{ color: COLORS.gold, fontSize: 'clamp(48px, 7vw, 80px)', display: 'block' }}>
            a buyer-ready exit.
          </span>
        </h1>

        {/* Subheadline */}
        <p
          style={{
            color: COLORS.muted,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 18,
            lineHeight: 1.7,
            marginTop: 28,
            marginBottom: 44,
            maxWidth: 580,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Fracture Systems gives CEPA advisors the structure, scoring, and reporting to prepare
          SMB clients for diligence—before buyers find the gaps.
        </p>

        {/* CTAs */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Link
            to="/request-demo"
            style={{
              background: COLORS.gold,
              color: COLORS.bg,
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 600,
              fontSize: 15,
              padding: '14px 32px',
              borderRadius: 8,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Request live demo
          </Link>
          <Link
            to="/sign-in"
            style={{
              background: 'transparent',
              color: COLORS.offWhite,
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 600,
              fontSize: 15,
              padding: '14px 28px',
              borderRadius: 8,
              textDecoration: 'none',
              display: 'inline-block',
              border: `1px solid ${COLORS.border}`,
            }}
          >
            Log in to platform
          </Link>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Problem Strip
// ---------------------------------------------------------------------------
function ProblemStrip() {
  const problems = [
    {
      Icon: AlertTriangle,
      title: 'Deals fall apart in diligence',
      description: 'Buyers find gaps that sellers didn\'t know existed. By then, it\'s too late to fix them.',
    },
    {
      Icon: Clock,
      title: 'Manual prep consumes your bandwidth',
      description: 'Advisors spend 40+ hours per engagement chasing documents and building spreadsheets.',
    },
    {
      Icon: BarChart3,
      title: 'Your reports look like spreadsheets',
      description: 'Client-facing deliverables that don\'t reflect the premium service you provide.',
    },
  ]

  return (
    <section style={{ background: COLORS.card, padding: '80px 24px', borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}` }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {problems.map((p) => (
            <div key={p.title} style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <p.Icon style={{ color: COLORS.gold, width: 32, height: 32 }} />
              </div>
              <h3
                style={{
                  color: COLORS.offWhite,
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: 22,
                  fontWeight: 600,
                  marginBottom: 12,
                  margin: '0 0 12px 0',
                }}
              >
                {p.title}
              </h3>
              <p
                style={{
                  color: COLORS.muted,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 15,
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                {p.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------
function Features() {
  const features = [
    {
      Icon: FolderOpen,
      title: 'Structured Data Room',
      description:
        'Organize every engagement into a buyer-ready data room. Track completeness, flag gaps, and generate a clean document index.',
    },
    {
      Icon: TrendingUp,
      title: 'Diligence Gap Scoring',
      description:
        'Our DRS engine scores 6 dimensions of business quality. Know exactly what a buyer will find—and fix it first.',
    },
    {
      Icon: FileText,
      title: 'Advisor Reports & Summaries',
      description:
        'Generate professional PDF reports in one click. DRS Summary, Value Gap Analysis, Buyer Prep Package.',
    },
    {
      Icon: CheckSquare,
      title: 'Guided Checklist Workflow',
      description:
        'A 15-point pre-diligence checklist tailored to your client\'s industry. Track progress, set due dates, escalate gaps.',
    },
  ]

  return (
    <section style={{ background: COLORS.bg, padding: '100px 24px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h2
          style={{
            color: COLORS.offWhite,
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 'clamp(32px, 4vw, 48px)',
            fontWeight: 600,
            textAlign: 'center',
            marginBottom: 60,
            margin: '0 0 60px 0',
          }}
        >
          What Fracture Systems gives you
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              style={{
                background: COLORS.card,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                padding: '32px 28px',
              }}
            >
              <div style={{ marginBottom: 14 }}>
                <f.Icon style={{ color: COLORS.gold, width: 26, height: 26 }} />
              </div>
              <h3
                style={{
                  color: COLORS.offWhite,
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: 22,
                  fontWeight: 600,
                  marginBottom: 10,
                  margin: '0 0 10px 0',
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  color: COLORS.muted,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 15,
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Social Proof
// ---------------------------------------------------------------------------
function SocialProof() {
  const testimonials = [
    { location: 'Columbus, OH' },
    { location: 'Cincinnati, OH' },
    { location: 'Cleveland, OH' },
  ]

  return (
    <section style={{ background: COLORS.card, padding: '100px 24px', borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}` }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h2
          style={{
            color: COLORS.offWhite,
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 'clamp(32px, 4vw, 48px)',
            fontWeight: 600,
            textAlign: 'center',
            marginBottom: 60,
            margin: '0 0 60px 0',
          }}
        >
          Advisors trust Fracture Systems
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div
              key={i}
              style={{
                background: COLORS.bg,
                border: `1px solid ${COLORS.border}`,
                borderLeft: `3px solid ${COLORS.gold}`,
                borderRadius: 10,
                padding: '28px 24px',
              }}
            >
              {/* Avatar placeholder */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: COLORS.border,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600 }}>A</span>
              </div>

              <p
                style={{
                  color: COLORS.muted,
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: 17,
                  fontStyle: 'italic',
                  lineHeight: 1.6,
                  marginBottom: 16,
                  margin: '0 0 16px 0',
                }}
              >
                "[Testimonial coming after pilot program closes]"
              </p>
              <p
                style={{
                  color: COLORS.gold,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12,
                  fontWeight: 500,
                  margin: 0,
                }}
              >
                — CEPA Advisor, {t.location}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------
function Pricing() {
  const tiers = [
    {
      name: 'Founding Advisor',
      price: 'TBD',
      badge: 'Limited — 20 spots',
      highlight: true,
      features: ['All Pro features', 'Rate locked for life', 'White-glove onboarding', 'Founding member badge'],
      cta: 'Claim Founding Access',
      ctaLink: '/pricing',
    },
    {
      name: 'Pro',
      price: 'TBD',
      badge: null,
      highlight: false,
      features: ['Unlimited clients', 'PDF report generation', 'Data room organization', 'Priority support'],
      cta: 'Start Free Trial',
      ctaLink: '/pricing',
    },
    {
      name: 'Team',
      price: 'TBD',
      badge: null,
      highlight: false,
      features: ['Up to 5 advisors', 'Shared client workspace', 'Team reporting', 'API access'],
      cta: 'Contact Us',
      ctaLink: 'mailto:matthew@fracturesystems.com',
    },
  ]

  return (
    <section style={{ background: COLORS.bg, padding: '100px 24px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h2
          style={{
            color: COLORS.offWhite,
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 'clamp(32px, 4vw, 48px)',
            fontWeight: 600,
            textAlign: 'center',
            marginBottom: 12,
            margin: '0 0 12px 0',
          }}
        >
          Simple, transparent pricing
        </h2>
        <p
          style={{
            color: COLORS.muted,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 16,
            textAlign: 'center',
            marginBottom: 56,
          }}
        >
          Pricing details coming soon.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              style={{
                background: COLORS.card,
                border: tier.highlight ? `2px solid ${COLORS.gold}` : `1px solid ${COLORS.border}`,
                borderRadius: 12,
                padding: '36px 28px',
                position: 'relative',
              }}
            >
              {tier.badge && (
                <div
                  style={{
                    position: 'absolute',
                    top: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: COLORS.gold,
                    color: COLORS.bg,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '4px 14px',
                    borderRadius: 20,
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.05em',
                  }}
                >
                  {tier.badge}
                </div>
              )}

              <h3
                style={{
                  color: COLORS.offWhite,
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: 24,
                  fontWeight: 600,
                  marginBottom: 8,
                  margin: '0 0 8px 0',
                }}
              >
                {tier.name}
              </h3>

              <div style={{ marginBottom: 24 }}>
                <span
                  style={{
                    color: tier.highlight ? COLORS.gold : COLORS.offWhite,
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize: 40,
                    fontWeight: 700,
                  }}
                >
                  {tier.price}
                </span>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0' }}>
                {tier.features.map((feat) => (
                  <li
                    key={feat}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 10,
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 14,
                      color: COLORS.muted,
                    }}
                  >
                    <span style={{ color: COLORS.gold }}>✓</span>
                    {feat}
                  </li>
                ))}
              </ul>

            </div>
          ))}
        </div>

        <p
          style={{
            color: COLORS.muted,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            textAlign: 'center',
            marginTop: 32,
          }}
        >
          All plans include a 14-day free trial. No credit card required to start.
        </p>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------
function Footer() {
  return (
    <footer
      style={{
        background: COLORS.bg,
        borderTop: `1px solid ${COLORS.border}`,
        padding: '56px 24px 40px',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* Row 1 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div
            style={{
              background: COLORS.gold,
              borderRadius: 6,
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: COLORS.bg, fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 14 }}>F</span>
          </div>
          <span style={{ color: COLORS.offWhite, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14 }}>
            Fracture Systems
          </span>
        </div>
        <p
          style={{
            color: COLORS.muted,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            marginBottom: 28,
          }}
        >
          Built for CEPA advisors. Trusted at exit.
        </p>

        {/* Row 2 — links */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Log in', to: '/sign-in' },
            { label: 'Request demo', to: '/request-demo' },
            { label: 'Contact', to: 'mailto:matthew@fracturesystems.com' },
          ].map(({ label, to }) => (
            <Link
              key={label}
              to={to}
              style={{
                color: COLORS.muted,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Row 3 */}
        <p
          style={{
            color: COLORS.muted,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            margin: 0,
          }}
        >
          matthew@fracturesystems.com — © 2026 Fracture Systems. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function LandingPage() {
  return (
    <div className="dark" style={{ background: COLORS.bg, minHeight: '100vh' }}>
      <Nav />
      <Hero />
      <ProblemStrip />
      <Features />
      <Pricing />
      <Footer />
    </div>
  )
}
