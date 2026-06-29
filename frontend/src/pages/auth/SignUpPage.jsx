import { SignUp } from '@clerk/react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../../hooks/usePageTitle'
import { marketingColors as C, clerkMarketingAppearance, clerkEmbedText } from '../../theme/marketingColors'

const HAS_CLERK = Boolean((import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim())

export default function SignUpPage() {
  usePageTitle('Create Account')

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
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', boxSizing: 'border-box' }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
        <div style={{ background: C.gold, borderRadius: 6, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: C.bg, fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 16 }}>F</span>
        </div>
        <span style={{ color: clerkEmbedText.primary, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 15 }}>Exit Blueprint</span>
      </div>

      <SignUp
        routing="hash"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/role-select"
        appearance={clerkMarketingAppearance()}
      />

      <p style={{ color: clerkEmbedText.tertiary, fontFamily: "'DM Sans', sans-serif", fontSize: 13, marginTop: 24 }}>
        Already have an account?{' '}
        <Link to="/sign-in" style={{ color: C.gold, textDecoration: 'none' }}>
          Sign in
        </Link>
      </p>
    </div>
  )
}
