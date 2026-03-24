import { useState, useEffect } from 'react'
import { X, Zap } from 'lucide-react'

const COLORS = {
  bg: '#0A1628',
  gold: '#C9973A',
  lightGold: '#E8B96A',
  offWhite: '#F0EDE8',
  muted: '#8A9BB0',
  card: '#0F2040',
  border: '#1E3A5F',
}

const FEATURES = [
  'Your own client data — not a fictional HVAC company',
  'Unlimited client engagements',
  'PDF reports with your firm\'s branding',
  'Team sharing and multi-advisor workspace',
]

export default function ConversionModal({ isOpen, onClose, prefillEmail = '' }) {
  const [spotsRemaining, setSpotsRemaining] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    fetch('/api/spots-remaining')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) setSpotsRemaining(d.spots_remaining)
      })
      .catch(() => {})
  }, [isOpen])

  if (!isOpen) return null

  const handleSignUp = () => {
    // TODO: Replace with your Clerk hosted sign-up URL once configured in the Clerk dashboard.
    // This should point to the Clerk-hosted sign-up page, which will then redirect to Stripe
    // checkout for the Founding Advisor tier after account creation.
    window.location.href = 'https://accounts.fracturesystems.com/sign-up'
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.72)',
          zIndex: 100,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 101,
          width: '100%',
          maxWidth: 480,
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: '36px 32px 32px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: COLORS.muted,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 4,
            borderRadius: 4,
          }}
        >
          <X size={18} />
        </button>

        {/* Spots counter */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(201,151,58,0.15)',
            border: `1px solid ${COLORS.gold}`,
            borderRadius: 20,
            padding: '5px 14px',
            marginBottom: 22,
          }}
        >
          <Zap style={{ color: COLORS.gold, width: 14, height: 14, flexShrink: 0 }} />
          <span
            style={{
              color: COLORS.gold,
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {spotsRemaining != null ? spotsRemaining : 20} spots remaining
          </span>
        </div>

        {/* Heading */}
        <h2
          style={{
            color: COLORS.offWhite,
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 28,
            fontWeight: 600,
            margin: '0 0 8px 0',
            lineHeight: 1.2,
          }}
        >
          You're 2 steps away from full access.
        </h2>

        {/* Subheading */}
        <p
          style={{
            color: COLORS.muted,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            lineHeight: 1.6,
            margin: '0 0 24px 0',
          }}
        >
          What you'll get that the demo doesn't:
        </p>

        {/* Feature list */}
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px 0' }}>
          {FEATURES.map((feat) => (
            <li
              key={feat}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                marginBottom: 10,
              }}
            >
              <span style={{ color: COLORS.gold, fontSize: 14, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
              <span
                style={{
                  color: COLORS.offWhite,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  lineHeight: 1.5,
                }}
              >
                {feat}
              </span>
            </li>
          ))}
        </ul>

        {/* Pricing callout */}
        <div
          style={{
            background: COLORS.bg,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 10,
            padding: '16px 20px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <p
              style={{
                color: COLORS.offWhite,
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                margin: '0 0 4px 0',
              }}
            >
              Founding Advisor
            </p>
            <p
              style={{
                color: COLORS.muted,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                margin: 0,
              }}
            >
              Rate locked for life
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                color: COLORS.muted,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14,
                textDecoration: 'line-through',
                display: 'block',
                marginBottom: 2,
              }}
            >
              $299/mo
            </span>
            <span
              style={{
                color: COLORS.gold,
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 26,
                fontWeight: 700,
              }}
            >
              $179<span style={{ fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>/mo</span>
            </span>
          </div>
        </div>

        {/* Spots note */}
        <p
          style={{
            color: COLORS.muted,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            textAlign: 'center',
            marginBottom: 20,
          }}
        >
          Only {spotsRemaining != null ? spotsRemaining : 20} spots remaining at this price
        </p>

        {/* Primary CTA */}
        <button
          onClick={handleSignUp}
          style={{
            width: '100%',
            background: COLORS.gold,
            color: COLORS.bg,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 700,
            fontSize: 15,
            padding: '14px 20px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            display: 'block',
            marginBottom: 12,
          }}
        >
          Create Account & Subscribe →
        </button>

        {/* Secondary CTA */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: COLORS.muted,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            padding: '8px 0',
            cursor: 'pointer',
            display: 'block',
            textAlign: 'center',
          }}
        >
          Not ready — keep exploring
        </button>
      </div>
    </>
  )
}
