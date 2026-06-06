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
      acceptInvite()
      return
    }

    if (!isLoaded) return

    if (!isSignedIn) {
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
      await refreshProfile()
      setTimeout(() => navigate('/client/dashboard', { replace: true }), 2200)
    } catch (err) {
      setStatus('error')
      setMessage(err?.message ?? 'Could not accept this invitation. It may have expired or already been used.')
    }
  }

  return (
    <div className="dark min-h-screen bg-background flex flex-col items-center justify-center px-6 py-10 text-center">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-12">
        <div
          className="w-9 h-9 rounded-md flex items-center justify-center"
          style={{ background: 'hsl(var(--gold))' }}
        >
          <span className="font-bold text-background font-serif text-lg leading-none">F</span>
        </div>
        <span className="text-sm font-semibold text-foreground">Pre-Diligence Platform</span>
      </div>

      {/* State-based content */}
      {(status === 'loading' || status === 'accepting') && (
        <>
          <Loader2
            size={40}
            className="mb-6 animate-spin"
            style={{ color: 'hsl(var(--gold))' }}
          />
          <h2 className="font-serif text-2xl font-semibold text-foreground mb-2">
            Accepting your invitation…
          </h2>
          <p className="text-sm text-muted-foreground">This will only take a moment.</p>
        </>
      )}

      {status === 'success' && (
        <>
          <CheckCircle size={48} className="text-success mb-6" />
          <h2 className="font-serif text-[28px] font-semibold text-foreground mb-3">
            You're in!
          </h2>
          <p className="text-[15px] text-muted-foreground max-w-[380px] leading-relaxed mb-2">
            Your account is now linked to <strong className="text-foreground">{companyName}</strong>.
          </p>
          <p className="text-sm text-muted-foreground">Redirecting to your dashboard…</p>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertCircle size={48} className="text-destructive mb-6" />
          <h2 className="font-serif text-2xl font-semibold text-foreground mb-3">
            Invitation Error
          </h2>
          <p className="text-sm text-muted-foreground max-w-[380px] leading-relaxed mb-8">
            {message}
          </p>
          <div className="flex gap-3">
            <Link
              to="/client/dashboard"
              className="px-6 py-2.5 rounded-lg text-sm font-semibold text-background no-underline"
              style={{ background: 'hsl(var(--gold))' }}
            >
              Go to Dashboard
            </Link>
            <Link
              to="/"
              className="px-6 py-2.5 rounded-lg text-sm font-medium text-foreground border border-border no-underline hover:bg-secondary transition-colors"
            >
              Home
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
