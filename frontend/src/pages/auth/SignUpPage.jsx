import { SignUp } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../../hooks/usePageTitle'

const COLORS = { bg: '#0A1628', gold: '#C9973A', muted: '#8A9BB0', offWhite: '#F0EDE8', border: '#1E3A5F' }

export default function SignUpPage() {
  usePageTitle('Create Account')

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
        <div style={{ background: COLORS.gold, borderRadius: 6, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: COLORS.bg, fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 16 }}>F</span>
        </div>
        <span style={{ color: COLORS.offWhite, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 15 }}>Fracture Systems</span>
      </div>

      {/* Clerk SignUp component */}
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        afterSignUpUrl="/dashboard/onboarding"
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
        Already have an account?{' '}
        <Link to="/sign-in" style={{ color: COLORS.gold, textDecoration: 'none' }}>
          Sign in →
        </Link>
      </p>
    </div>
  )
}
