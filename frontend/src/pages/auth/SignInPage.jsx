import { SignIn } from '@clerk/clerk-react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePageTitle } from '../../hooks/usePageTitle'

const COLORS = { bg: '#0A1628', gold: '#C9973A', muted: '#8A9BB0', offWhite: '#F0EDE8', border: '#1E3A5F' }

const HAS_CLERK = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)

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
  return (
    <div
      style={{
        minHeight: 280,
        width: '100%',
        maxWidth: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: COLORS.muted,
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 14,
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          border: `3px solid ${COLORS.gold}`,
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'signin-spin 0.8s linear infinite',
          marginRight: 12,
        }}
      />
      Loading sign-in…
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
      <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ background: COLORS.gold, borderRadius: 6, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <span style={{ color: COLORS.bg, fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 20 }}>F</span>
        </div>
        <h2 style={{ color: COLORS.offWhite, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 24, fontWeight: 600, margin: '0 0 12px 0' }}>
          Auth not configured
        </h2>
        <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14, lineHeight: 1.6, maxWidth: 380, margin: '0 0 24px 0' }}>
          Set <code style={{ color: COLORS.gold }}>VITE_CLERK_PUBLISHABLE_KEY</code> in <code style={{ color: COLORS.gold }}>frontend/.env</code>, then restart the dev server.
        </p>
        <Link to="/demo" style={{ color: COLORS.gold, fontFamily: "'DM Sans', sans-serif", fontSize: 14, textDecoration: 'none', border: `1px solid ${COLORS.gold}`, borderRadius: 6, padding: '8px 20px' }}>
          View demo →
        </Link>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
        <div style={{ background: COLORS.gold, borderRadius: 6, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: COLORS.bg, fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 16 }}>F</span>
        </div>
        <span style={{ color: COLORS.offWhite, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 15 }}>Fracture Systems</span>
      </div>

      {/* Clerk SignIn component */}
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        fallbackRedirectUrl={fallbackRedirectUrl}
        fallback={<SignInLoadingFallback />}
        appearance={{
          variables: {
            colorPrimary: COLORS.gold,
            colorBackground: '#0F2040',
            colorText: COLORS.offWhite,
            colorTextSecondary: COLORS.muted,
            colorInputBackground: COLORS.bg,
            colorInputText: COLORS.offWhite,
            borderRadius: '8px',
          },
          elements: {
            card: { boxShadow: '0 24px 80px rgba(0,0,0,0.5)', border: `1px solid ${COLORS.border}` },
            headerTitle: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 24 },
          },
        }}
      />

      <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13, marginTop: 24 }}>
        No account?{' '}
        <Link to="/sign-up" style={{ color: COLORS.gold, textDecoration: 'none' }}>
          Create one →
        </Link>
      </p>
    </div>
  )
}
