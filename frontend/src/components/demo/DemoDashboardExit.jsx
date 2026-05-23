import { useAuth } from '@clerk/react'
import { Link, useNavigate } from 'react-router-dom'

const HAS_CLERK = Boolean((import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim())
const PLATFORM_HOME = '/Home'

/**
 * Demo "Back to dashboard" / header exit: real app when signed in, sign-in when not.
 * Without VITE_CLERK_PUBLISHABLE_KEY, links straight to /Home (matches dev unauthenticated dashboard).
 */
export function DemoDashboardExitLink({ className, children }) {
  if (!HAS_CLERK) {
    return (
      <Link to={PLATFORM_HOME} className={className}>
        {children}
      </Link>
    )
  }
  return (
    <DemoDashboardExitLinkAuthenticated className={className}>
      {children}
    </DemoDashboardExitLinkAuthenticated>
  )
}

function DemoDashboardExitLinkAuthenticated({ className, children }) {
  const { isLoaded, isSignedIn } = useAuth()
  const navigate = useNavigate()

  const handleClick = () => {
    if (!isLoaded) return
    if (isSignedIn) navigate(PLATFORM_HOME)
    else navigate(`/sign-in?redirect_url=${encodeURIComponent(PLATFORM_HOME)}`)
  }

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      disabled={!isLoaded}
      aria-busy={!isLoaded}
    >
      {children}
    </button>
  )
}
