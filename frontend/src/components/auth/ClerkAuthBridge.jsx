import { useLayoutEffect } from 'react'
import { useAuth } from '@clerk/react'
import posthog from 'posthog-js'
import { setAuthTokenGetter } from '../../lib/apiClient'

/**
 * Registers Clerk session token getter for apiClient (Bearer on dashboard API calls).
 * useLayoutEffect runs before child effects so the first /api/* request after sign-in includes Authorization.
 * Also calls posthog.identify() so server-side and client-side events share the same user identity.
 * Must render only inside ClerkProvider.
 */
export default function ClerkAuthBridge({ children }) {
  const { getToken, isLoaded, userId } = useAuth()

  useLayoutEffect(() => {
    if (!isLoaded) {
      setAuthTokenGetter(null)
      return
    }
    setAuthTokenGetter(() => getToken())
    if (userId) {
      posthog.identify(userId)
    } else {
      posthog.reset()
    }
    return () => setAuthTokenGetter(null)
  }, [getToken, isLoaded, userId])

  return children
}
