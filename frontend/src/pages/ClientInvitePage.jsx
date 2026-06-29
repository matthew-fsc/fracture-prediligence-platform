/**
 * ClientInvitePage — handles /client-invite/:token
 *
 * Flow:
 *   1. User arrives via advisor-provided invite URL
 *   2. If not signed in → redirect to sign-in with ?redirect_url=/client-invite/:token
 *   3. If signed in → call POST /api/me/accept-invite/:token
 *   4. On success → redirect to /client/dashboard
 *   5. On error → show error state with guidance
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@clerk/react'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { apiClient } from '../lib/apiClient'
import { useUserRole } from '../context/UserRoleContext'
import { usePageTitle } from '../hooks/usePageTitle'

const HAS_CLERK = Boolean((import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim())

const C = {
  bg:   '#0A1628',
  gold: '#C9973A',
  muted: '#8A9BB0',
  text:  '#F0EDE8',
  card:  '#0F1E35',
}

export default function ClientInvitePage() {
  usePageTitle('Accept Invitation')
  const { token } = useParams()
  const navigate = useNavigate()
  const { isSignedIn, isLoaded } = useAuth()
  const { refreshProfile } = useUserRole()

  const [status, setStatus] = useState('loading')  // loading | accepting | success | error | redirecting-signin
  const [message, setMessage] = useState('')
  const [companyName, setCompanyName] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Invalid invite link — no token found.')
      return
    }

    if (!HAS_CLERK) {
      // Dev mode: auto-accept
      acceptInvite()
      return
    }

    if (!isLoaded) return  // Wait for Clerk to initialize

    if (!isSignedIn) {
      // Store token so we can resume after sign-in/sign-up
      sessionStorage.setItem('pending_client_invite_token', token)
      navigate(`/sign-in?redirect_url=/client-invite/${token}`, { replace: true })
      return
    }

    acceptInvite()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, token])

  async function acceptInvite() {
    setStatus('accepting')
    try {
      const result = await apiClient.post(`/api/me/accept-invite/${token}`, {})
      setCompanyName(result.company_name ?? 'your company')
      setStatus('success')
      sessionStorage.removeItem('pending_client_invite_token')
      // Refresh profile so ClientShell picks up the new role + company
      await refreshProfile()
      setTimeout(() => navigate('/client/dashboard', { replace: true }), 2200)
    } catch (err) {
      setStatus('error')
      setMessage(err?.message ?? 'Could not accept this invitation. It may have expired or already been used.')
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        textAlign: 'center',
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
        <img src="/logo.svg" alt="Exit Blueprint" style={{ width: 36, height: 36, borderRadius: 6 }} />
        <span style={{ color: C.text, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em' }}>
          Exit Blueprint
        </span>
      </div>

      {/* State-based content */}
      {(status === 'loading' || status === 'accepting') && (
        <>
          <Loader2
            size={40}
            style={{ color: C.gold, animation: 'spin 0.8s linear infinite', marginBottom: 24 }}
          />
          <h2 style={{ color: C.text, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 600, margin: '0 0 8px 0' }}>
            Accepting your invitation…
          </h2>
          <p style={{ color: C.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14, margin: 0 }}>
            This will only take a moment.
          </p>
        </>
      )}

      {status === 'success' && (
        <>
          <CheckCircle size={48} style={{ color: '#4ADE80', marginBottom: 24 }} />
          <h2 style={{ color: C.text, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 28, fontWeight: 600, margin: '0 0 12px 0' }}>
            You're in!
          </h2>
          <p style={{ color: C.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 15, maxWidth: 380, lineHeight: 1.6, margin: '0 0 8px 0' }}>
            Your account is now linked to <strong style={{ color: C.text }}>{companyName}</strong>.
          </p>
          <p style={{ color: C.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13, margin: 0 }}>
            Redirecting to your dashboard…
          </p>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertCircle size={48} style={{ color: '#EF4444', marginBottom: 24 }} />
          <h2 style={{ color: C.text, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 600, margin: '0 0 12px 0' }}>
            Invitation Error
          </h2>
          <p style={{ color: C.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14, maxWidth: 380, lineHeight: 1.6, margin: '0 0 32px 0' }}>
            {message}
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link
              to="/client/dashboard"
              style={{
                background: C.gold,
                color: C.bg,
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 600,
                fontSize: 13,
                padding: '10px 24px',
                borderRadius: 6,
                textDecoration: 'none',
              }}
            >
              Go to Dashboard
            </Link>
            <Link
              to="/"
              style={{
                border: `1px solid ${C.gold}`,
                color: C.gold,
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 500,
                fontSize: 13,
                padding: '10px 24px',
                borderRadius: 6,
                textDecoration: 'none',
              }}
            >
              Home
            </Link>
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
