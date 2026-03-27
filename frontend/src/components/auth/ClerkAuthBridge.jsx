import { useLayoutEffect } from 'react'
import { useAuth } from '@clerk/react'
import { setAuthTokenGetter } from '../../lib/apiClient'

/**
 * Registers Clerk session token getter for apiClient (Bearer on dashboard API calls).
 * useLayoutEffect runs before child effects so the first /api/* request after sign-in includes Authorization.
 * Must render only inside ClerkProvider.
 */
export default function ClerkAuthBridge({ children }) {
  const { getToken, isLoaded } = useAuth()

  useLayoutEffect(() => {
    if (!isLoaded) {
      setAuthTokenGetter(null)
      return
    }
    setAuthTokenGetter(() => getToken())
    return () => setAuthTokenGetter(null)
  }, [getToken, isLoaded])

  return children
}
