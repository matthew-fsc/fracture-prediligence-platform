import { useState, useEffect } from 'react'
import { SignIn } from '@clerk/react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePageTitle } from '../../hooks/usePageTitle'
import { marketingColors as C, clerkMarketingAppearance, clerkEmbedText } from '../../theme/marketingColors'

const HAS_CLERK = Boolean((import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim())

/** Same-origin path only; default /Home */
function safePostSignInUrl(raw) {
  if (raw == null || raw === '') return '/Home'
  let s = typeof raw === 'string' ? raw.trim() : ''
  try {
    s = decodeURIComponent(s)
  } catch {
    return '/Home'
  }
  if (!s.startsWith('/') || s.startsWith('//')) return '/Home'
  return s
}

function SignInLoadingFallback() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 12_000)
    return () => clearTimeout(id)
  }, [])
  return (
    <div
      style={{
        minHeight: 280,
        width: '100%',
        maxWidth: 420,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: clerkEmbedText.secondary,
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 14,
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span
          style={{
            width: 32,
            height: 32,
            border: `3px solid ${C.gold}`,
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'signin-spin 0.8s linear infinite',
            marginRight: 12,
          }}
        />
        Loading sign-in—
      </div>
      {slow && (
        <p style={{ textAlign: 'center', lineHeight: 1.5, fontSize: 13, maxWidth: 380, margin: 0 }}>
          If this never finishes: allow third-party scripts for this site (or disable ad blockers), open the browser
          console for errors, and in the{' '}
          <a href="https://dashboard.clerk.com" target="_blank" rel="noreferrer" style={{ color: C.gold }}>
            Clerk Dashboard
          </a>{' '}
          add <code style={{ color: C.offWhite }}>http://localhost:5173</code> under your app&apos;s allowed
          origins / redirect URLs.
        </p>
      )}
      <style>{`@keyframes signin-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function SignInPage() {
  usePageTitle('Sign In')
  const [searchParams] = useSearchParams()
  /** Use fallbackRedirectUrl, not forceRedirectUrl — forceRedirectUrl overrides Clerk OAuth/callback query params and can leave the embedded UI blank. */
  const fallbackRedirectUrl = safePostSignInUrl(searchParams.get('redirect_url'))

  if (!HAS_CLERK) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ background: C.gold, borderRadius: 6, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <span style={{ color: C.bg, fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 20 }}>F</span>
        </div>
        <h2 style={{ color: clerkEmbedText.primary, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 24, fontWeight: 600, margin: '0 0 12px 0' }}>
          Auth not configured
        </h2>
        <p style={{ color: clerkEmbedText.secondary, fontFamily: "'DM Sans', sans-serif", fontSize: 14, lineHeight: 1.6, maxWidth: 380, margin: '0 0 24px 0' }}>
          Set <code style={{ color: C.gold }}>VITE_CLERK_PUBLISHABLE_KEY</code> in <code style={{ color: C.gold }}>frontend/.env.local</code>, then restart the dev server.
        </p>
        <Link to="/request-demo" style={{ color: C.gold, fontFamily: "'DM Sans', sans-serif", fontSize: 14, textDecoration: 'none', border: `1px solid ${C.gold}`, borderRadius: 6, padding: '8px 20px' }}>
          Request live demo
        </Link>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      {/* Logo — match Clerk embed primary text */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
        <div style={{ background: C.gold, borderRadius: 6, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: C.bg, fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 16 }}>F</span>
        </div>
        <span style={{ color: clerkEmbedText.primary, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 15 }}>Fracture Systems</span>
      </div>

      {/* Clerk SignIn component */}
      {/* Hash routing avoids React Router path sync issues that can leave clerk.loaded false forever. */}
      <SignIn
        routing="hash"
        signUpUrl="/sign-up"
        fallbackRedirectUrl={fallbackRedirectUrl}
        fallback={<SignInLoadingFallback />}
        appearance={clerkMarketingAppearance()}
      />

      <p style={{ color: clerkEmbedText.tertiary, fontFamily: "'DM Sans', sans-serif", fontSize: 13, marginTop: 24 }}>
        No account?{' '}
        <Link to="/sign-up" style={{ color: C.gold, textDecoration: 'none' }}>
          Create one ?
        </Link>
      </p>
    </div>
  )
}
