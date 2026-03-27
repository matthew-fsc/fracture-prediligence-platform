import { UserProfile } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'

const COLORS = { bg: '#0A1628', gold: '#C9973A', muted: '#8A9BB0', offWhite: '#F0EDE8', border: '#1E3A5F', card: '#0F2040' }

export default function SettingsPage() {
  usePageTitle('Account settings')

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: 1024, margin: '0 auto' }}>
        <Link
          to="/Home"
          style={{
            display: 'inline-block',
            color: COLORS.gold,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            textDecoration: 'none',
            marginBottom: 24,
          }}
        >
          ← Back to dashboard
        </Link>
        <h1
          style={{
            color: COLORS.offWhite,
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 28,
            fontWeight: 600,
            margin: '0 0 8px 0',
          }}
        >
          Account
        </h1>
        <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14, margin: '0 0 28px 0' }}>
          Manage your profile, security, and connected accounts.
        </p>
        <div
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            padding: 16,
          }}
        >
          <UserProfile
            path="/settings"
            routing="path"
            appearance={{
              variables: {
                colorPrimary: COLORS.gold,
                colorBackground: COLORS.card,
                colorText: COLORS.offWhite,
                colorTextSecondary: COLORS.muted,
                colorInputBackground: COLORS.bg,
                colorInputText: COLORS.offWhite,
                borderRadius: '8px',
              },
              elements: {
                card: { boxShadow: 'none', border: 'none' },
                navbar: { background: COLORS.bg },
                navbarButton: { color: COLORS.offWhite },
              },
            }}
          />
        </div>
      </div>
    </div>
  )
}
