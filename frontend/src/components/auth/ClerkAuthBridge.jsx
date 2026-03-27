import { useEffect } from 'react'
import { useAuth } from '@clerk/react'
import { setAuthTokenGetter } from '../../lib/apiClient'

/**
 * Registers Clerk session token getter for apiClient (Bearer on dashboard API calls).
 * Must render only inside ClerkProvider.
 */
export default function ClerkAuthBridge({ children }) {
  const { getToken, isLoaded } = useAuth()

  useEffect(() => {
    if (!isLoaded) {
      setAuthTokenGetter(null)
      return
    }
    setAuthTokenGetter(() => getToken())
    return () => setAuthTokenGetter(null)
  }, [getToken, isLoaded])

  return children
}
