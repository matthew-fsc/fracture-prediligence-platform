/**
 * ProtectedRoute — enforces authentication AND role-based routing.
 *
 * After Clerk auth resolves:
 *   - No role yet          → /role-select
 *   - CLIENT accessing /   → /client/dashboard
 *   - ADVISOR accessing /client/* → /Home
 *   - Otherwise            → render children
 *
 * In dev without VITE_CLERK_PUBLISHABLE_KEY the route is always accessible.
 */

import { useAuth } from '@clerk/react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useUserRole } from '../../context/UserRoleContext'

const COLORS = { bg: '#0A1628', gold: '#C9973A', muted: '#8A9BB0' }

function LoadingShell() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: COLORS.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
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

function NoClerkNotice() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: COLORS.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          background: COLORS.gold,
          borderRadius: 6,
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
        }}
      >
        <span style={{ color: COLORS.bg, fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 20 }}>F</span>
      </div>
      <h2
        style={{
          color: '#F0EDE8',
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 24,
          fontWeight: 600,
          margin: '0 0 12px 0',
        }}
      >
        Auth not configured
      </h2>
      <p
        style={{
          color: COLORS.muted,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 14,
          lineHeight: 1.6,
          maxWidth: 380,
          margin: '0 0 24px 0',
        }}
      >
        Set <code style={{ color: COLORS.gold }}>VITE_CLERK_PUBLISHABLE_KEY</code> for the production Clerk
        instance at build time (e.g. in your hosting provider env or <code style={{ color: COLORS.gold }}>frontend/.env</code>{' '}
        locally), then rebuild the SPA.
      </p>
      <Link
        to="/request-demo"
        style={{
          color: COLORS.gold,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 14,
          textDecoration: 'none',
          border: `1px solid ${COLORS.gold}`,
          borderRadius: 6,
          padding: '8px 20px',
        }}
      >
        Request live demo instead
      </Link>
    </div>
  )
}

/**
 * Inner guard — Clerk is loaded. Apply role-based redirects.
 * - `requireAdvisor`: the route is advisor-only (default for all /Home etc. routes)
 * - `requireClient`: the route is client-only (all /client/* routes)
 */
function RoleGuard({ children, requireAdvisor = false, requireClient = false }) {
  const { role, loading } = useUserRole()
  const location = useLocation()

  if (loading) return <LoadingShell />

  // No role set → prompt role selection
  if (role === null) {
    return <Navigate to="/role-select" replace state={{ from: location }} />
  }

  // Advisor tried to access client portal → redirect to advisor home
  if (requireClient && role === 'ADVISOR') {
    return <Navigate to="/Home" replace />
  }

  // Client tried to access advisor portal → redirect to client dashboard
  if (requireAdvisor && role === 'CLIENT') {
    return <Navigate to="/client/dashboard" replace />
  }

  return children
}

function ClerkGuard({ children, requireAdvisor, requireClient }) {
  const { isLoaded, isSignedIn } = useAuth()
  if (!isLoaded) return <LoadingShell />
  if (!isSignedIn) return <Navigate to="/sign-in" replace />
  return (
    <RoleGuard requireAdvisor={requireAdvisor} requireClient={requireClient}>
      {children}
    </RoleGuard>
  )
}

/**
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {boolean} [props.requireAdvisor]  — enforce ADVISOR role (default true for advisor routes)
 * @param {boolean} [props.requireClient]   — enforce CLIENT role (for /client/* routes)
 */
export default function ProtectedRoute({
  children,
  requireAdvisor = false,
  requireClient = false,
}) {
  const hasKey = Boolean((import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim())

  if (!hasKey) {
    // No Clerk key: bypass auth. API still enforces auth for writes; public/demo data is readable.
    return children
  }

  return (
    <ClerkGuard requireAdvisor={requireAdvisor} requireClient={requireClient}>
      {children}
    </ClerkGuard>
  )
}
