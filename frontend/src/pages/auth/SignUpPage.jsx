import { SignUp } from '@clerk/react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../../hooks/usePageTitle'
import { marketingColors as C, clerkMarketingAppearance, clerkEmbedText } from '../../theme/marketingColors'

export default function SignUpPage() {
  usePageTitle('Create Account')

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
        <div style={{ background: C.gold, borderRadius: 6, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: C.bg, fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 16 }}>F</span>
        </div>
        <span style={{ color: clerkEmbedText.primary, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 15 }}>Fracture Systems</span>
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
          Sign in ?
        </Link>
      </p>
    </div>
  )
}
