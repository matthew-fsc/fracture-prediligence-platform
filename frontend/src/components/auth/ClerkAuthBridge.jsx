import { useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { setAuthTokenGetter } from '../../lib/apiClient'

/**
 * Registers Clerk session token getter for apiClient (Bearer on dashboard API calls).
 * Must render only inside ClerkProvider.
 */
export default function ClerkAuthBridge({ children }) {
  const { getToken } = useAuth()

  useEffect(() => {
    setAuthTokenGetter(() => getToken())
    return () => setAuthTokenGetter(null)
  }, [getToken])

  return children
}
