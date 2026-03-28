import { useState, useEffect } from 'react'
import { X, Zap, Mail } from 'lucide-react'
import { apiClient } from '../../lib/apiClient'

const COLORS = {
  bg: '#0C0E12',
  gold: '#C9973A',
  offWhite: '#E8EAED',
  muted: '#6C7585',
  card: '#15181E',
  border: '#212630',
}

const FEATURES = [
  'Your own client data across unlimited engagements',
  'PDF reports with your firm\'s branding',
  'Priority support and direct feature requests',
  'Founding rate locked for life at $179/mo',
]

export default function ConversionModal({ isOpen, onClose, prefillEmail = '', slug = null }) {
  const [spotsRemaining, setSpotsRemaining] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    apiClient.get('/api/spots-remaining')
      .then((d) => { if (d) setSpotsRemaining(d.spots_remaining) })
      .catch(() => {})
  }, [isOpen])

  if (!isOpen) return null

  const mailtoHref =
    `mailto:matthew@fracturesystems.com` +
    `?subject=${encodeURIComponent('Founding Advisor License Request')}` +
    `&body=${encodeURIComponent(
      'Hi Matthew,\n\nI\'d like to request a Founding Advisor license for the Pre-Diligence Platform.\n\nFirm: \nName: \nAny questions: \n'
    )}`

  async function handleRequestClick(e) {
    e.preventDefault()
    if (slug) {
      try {
        await apiClient.post(`/api/demo/${slug}/mark-converted`)
      } catch {
        /* non-blocking */
      }
    }
    window.location.href = mailtoHref
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 100 }}
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
          maxWidth: 460,
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
            position: 'absolute', top: 16, right: 16,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: COLORS.muted, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: 4, borderRadius: 4,
          }}
        >
          <X size={18} />
        </button>

        {/* Spots counter */}
        <div
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(201,151,58,0.15)', border: `1px solid ${COLORS.gold}`,
            borderRadius: 20, padding: '5px 14px', marginBottom: 22,
          }}
        >
          <Zap style={{ color: COLORS.gold, width: 14, height: 14, flexShrink: 0 }} />
          <span style={{ color: COLORS.gold, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13 }}>
            {spotsRemaining != null ? spotsRemaining : 20} spots remaining
          </span>
        </div>

        {/* Heading */}
        <h2 style={{ color: COLORS.offWhite, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 28, fontWeight: 600, margin: '0 0 8px 0', lineHeight: 1.2 }}>
          Request a Founding Advisor License
        </h2>

        <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14, lineHeight: 1.6, margin: '0 0 24px 0' }}>
          Send a quick email and I'll get you set up directly. What you'll get:
        </p>

        {/* Feature list */}
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px 0' }}>
          {FEATURES.map((feat) => (
            <li key={feat} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <span style={{ color: COLORS.gold, fontSize: 14, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>?</span>
              <span style={{ color: COLORS.offWhite, fontFamily: "'DM Sans', sans-serif", fontSize: 14, lineHeight: 1.5 }}>
                {feat}
              </span>
            </li>
          ))}
        </ul>

        {/* Pricing callout */}
        <div
          style={{
            background: COLORS.bg, border: `1px solid ${COLORS.border}`,
            borderRadius: 10, padding: '16px 20px', marginBottom: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <div>
            <p style={{ color: COLORS.offWhite, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, margin: '0 0 4px 0' }}>
              Founding Advisor
            </p>
            <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 12, margin: 0 }}>
              Rate locked for life
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14, textDecoration: 'line-through', display: 'block', marginBottom: 2 }}>
              $299/mo
            </span>
            <span style={{ color: COLORS.gold, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 700 }}>
              $179<span style={{ fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>/mo</span>
            </span>
          </div>
        </div>

        {/* Primary CTA � records conversion for personalized links, then mailto */}
        <a
          href={mailtoHref}
          onClick={handleRequestClick}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', background: COLORS.gold, color: COLORS.bg,
            fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15,
            padding: '14px 20px', borderRadius: 8, textDecoration: 'none',
            marginBottom: 12, boxSizing: 'border-box', cursor: 'pointer',
          }}
        >
          <Mail size={16} />
          Email matthew@fracturesystems.com
        </a>

        {/* Secondary */}
        <button
          onClick={onClose}
          style={{
            width: '100%', background: 'transparent', border: 'none',
            color: COLORS.muted, fontFamily: "'DM Sans', sans-serif",
            fontSize: 13, padding: '8px 0', cursor: 'pointer',
            display: 'block', textAlign: 'center',
          }}
        >
          Not ready � keep exploring
        </button>
      </div>
    </>
  )
}
