import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Show, SignInButton } from '@clerk/react'
import { ArrowLeft, Mail } from 'lucide-react'
import { marketingColors as COLORS } from '../theme/marketingColors'
import { usePageTitle } from '../hooks/usePageTitle'
import {
  fetchDemoAccessStatus,
  setDemoAccessToken,
  verifyDemoAccessCode,
} from '../lib/demoAccess'

const HAS_CLERK = Boolean((import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim())

const CONTACT_EMAIL = 'matthew@fracturesystems.com'
const MAILTO_HREF = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
  'Request: Fracture Systems live demo',
)}&body=${encodeURIComponent(
  "Hi Matthew,\n\nI'd like to request access to the live product demo.\n\n[Your name / firm]\n",
)}`

const INPUT_STYLE = {
  width: '100%',
  maxWidth: 360,
  background: 'rgba(255,255,255,0.04)',
  border: `1px solid ${COLORS.border}`,
  borderRadius: 8,
  padding: '12px 14px',
  color: COLORS.offWhite,
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
}

function Nav() {
  return (
    <nav
      style={{
        background: 'rgba(12,14,18,0.95)',
        borderBottom: `1px solid ${COLORS.border}`,
        backdropFilter: 'blur(12px)',
      }}
      className="sticky top-0 z-50 w-full"
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: COLORS.muted,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>
        <div className="flex items-center gap-3">
          <div
            style={{
              background: COLORS.gold,
              borderRadius: 6,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: COLORS.bg, fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 16 }}>F</span>
          </div>
          <span style={{ color: COLORS.offWhite, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 15 }}>
            Fracture Systems
          </span>
        </div>
        <div className="flex items-center gap-4">
          {HAS_CLERK ? (
            <Show when="signed-out">
              <SignInButton
                mode="redirect"
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
            </Show>
          ) : (
            <Link
              to="/sign-in"
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
              Log in
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}

export default function RequestDemoPage() {
  usePageTitle('Request live demo')
  const navigate = useNavigate()
  const [statusLoading, setStatusLoading] = useState(true)
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchDemoAccessStatus()
      .then((s) => {
        if (cancelled || !s) return
        // If already granted (valid token), go straight to demo
        if (s.granted) navigate('/demo', { replace: true })
      })
      .catch(() => { /* show page normally */ })
      .finally(() => {
        if (!cancelled) setStatusLoading(false)
      })
    return () => { cancelled = true }
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const data = await verifyDemoAccessCode(code.trim())
      if (data?.access_token) {
        setDemoAccessToken(data.access_token)
        navigate('/demo', { replace: true })
      } else {
        setError('Unexpected response from server.')
      }
    } catch (err) {
      setError(err?.message || 'Invalid access code')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="dark" style={{ background: COLORS.bg, minHeight: '100vh' }}>
      <Nav />
      <section
        style={{
          minHeight: 'calc(100vh - 64px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
        }}
      >
        <div style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>
          <p
            style={{
              color: COLORS.gold,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              marginBottom: 16,
            }}
          >
            Live product demo
          </p>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              color: COLORS.offWhite,
              fontSize: 'clamp(32px, 5vw, 44px)',
              fontWeight: 600,
              margin: '0 0 16px 0',
              lineHeight: 1.15,
            }}
          >
            Request access
          </h1>
          <p
            style={{
              color: COLORS.muted,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 16,
              lineHeight: 1.65,
              marginBottom: 36,
            }}
          >
            Email Matthew for a walkthrough, or enter the access code you were given to open the interactive demo.
          </p>

          {error && !statusLoading ? (
            <p
              style={{
                color: '#f87171',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14,
                marginBottom: 24,
                maxWidth: 420,
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              {error}
            </p>
          ) : null}

          {statusLoading ? (
            <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>Loading…</p>
          ) : (
            <>
              <a
                href={MAILTO_HREF}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  background: COLORS.gold,
                  color: COLORS.bg,
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 600,
                  fontSize: 15,
                  padding: '14px 28px',
                  borderRadius: 8,
                  textDecoration: 'none',
                  marginBottom: 40,
                }}
              >
                <Mail className="w-4 h-4" />
                Email {CONTACT_EMAIL}
              </a>

              <div
                style={{
                  borderTop: `1px solid ${COLORS.border}`,
                  paddingTop: 32,
                  marginTop: 8,
                }}
              >
                <p
                  style={{
                    color: COLORS.muted,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13,
                    marginBottom: 16,
                  }}
                >
                  Already have a code?
                </p>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  <input
                    type="password"
                    autoComplete="off"
                    placeholder="Access code"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value)
                      setError('')
                    }}
                    style={INPUT_STYLE}
                  />
                  <button
                    type="submit"
                    disabled={submitting || !code.trim()}
                    style={{
                      background: COLORS.gold,
                      color: COLORS.bg,
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 600,
                      fontSize: 15,
                      padding: '12px 28px',
                      borderRadius: 8,
                      border: 'none',
                      cursor: submitting || !code.trim() ? 'not-allowed' : 'pointer',
                      opacity: submitting || !code.trim() ? 0.65 : 1,
                    }}
                  >
                    {submitting ? 'Checking…' : 'Open demo'}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
