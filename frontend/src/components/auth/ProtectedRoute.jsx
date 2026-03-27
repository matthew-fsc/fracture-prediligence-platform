import { useAuth } from '@clerk/clerk-react'
import { Navigate } from 'react-router-dom'

const COLORS = { bg: '#0A1628', gold: '#C9973A', muted: '#8A9BB0' }

// Spinner — matches dark design system loading states
function LoadingShell() {
  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          width: 36,
          height: 36,
          border: `3px solid ${COLORS.gold}`,
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// No-key notice — shown when VITE_CLERK_PUBLISHABLE_KEY is not in .env
function NoClerkNotice() {
  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ background: COLORS.gold, borderRadius: 6, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
        <span style={{ color: COLORS.bg, fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 20 }}>F</span>
      </div>
      <h2 style={{ color: '#F0EDE8', fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 24, fontWeight: 600, margin: '0 0 12px 0' }}>
        Auth not configured
      </h2>
      <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14, lineHeight: 1.6, maxWidth: 380, margin: '0 0 24px 0' }}>
        Set <code style={{ color: COLORS.gold }}>VITE_CLERK_PUBLISHABLE_KEY</code> for the production Clerk instance at build time (e.g. in your hosting provider’s env or{' '}
        <code style={{ color: COLORS.gold }}>frontend/.env</code> locally), then rebuild the SPA.
      </p>
      <a href="/demo" style={{ color: COLORS.gold, fontFamily: "'DM Sans', sans-serif", fontSize: 14, textDecoration: 'none', border: `1px solid ${COLORS.gold}`, borderRadius: 6, padding: '8px 20px' }}>
        View Demo instead →
      </a>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ClerkGuard — only rendered when ClerkProvider is active
// ---------------------------------------------------------------------------
function ClerkGuard({ children }) {
  const { isLoaded, isSignedIn } = useAuth()
  if (!isLoaded) return <LoadingShell />
  if (!isSignedIn) return <Navigate to="/sign-in" replace />
  return children
}

// ---------------------------------------------------------------------------
// ProtectedRoute — public API
// Development: no publishable key → passthrough so local work continues.
// Production: missing key → block with NoClerkNotice (do not ship without Clerk).
// ---------------------------------------------------------------------------
export default function ProtectedRoute({ children }) {
  const hasKey = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)
  if (!hasKey && import.meta.env.PROD) return <NoClerkNotice />
  if (!hasKey) {
    if (import.meta.env.DEV) {
      console.warn(
        '[Prediligence] VITE_CLERK_PUBLISHABLE_KEY is not set — dashboard routes are not authenticated. ' +
          'Set the key for staging/production builds.',
      )
    }
    return children
  }
  return <ClerkGuard>{children}</ClerkGuard>
}
