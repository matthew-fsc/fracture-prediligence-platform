/**
 * UserRoleContext — provides the current user's role (ADVISOR | CLIENT | null)
 * and their linked company (for CLIENT users).
 *
 * Fetches GET /api/me once per sign-in session and caches in state.
 * Components use the hook `useUserRole()` to read role information.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/react'
import { apiClient } from '../lib/apiClient'

const UserRoleContext = createContext(null)

const HAS_CLERK = Boolean((import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim())

function makeValue(profile, loading, refreshProfile) {
  const role = profile?.role ?? null
  return {
    profile,
    role,
    isAdvisor: role === 'ADVISOR',
    isClient: role === 'CLIENT',
    clientCompany: profile?.company ?? null,
    loading,
    refreshProfile,
  }
}

// Only rendered when HAS_CLERK=true and ClerkProvider is in the tree — safe to call useAuth()
function ClerkUserRoleProvider({ children }) {
  const { isSignedIn, isLoaded } = useAuth()
  const [profile, setProfileState] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    try {
      const data = await apiClient.get('/api/me')
      setProfileState(data ?? { role: null, company: null })
    } catch {
      setProfileState({ role: null, company: null })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      setProfileState(null)
      setLoading(false)
      return
    }
    fetchProfile()
  }, [isLoaded, isSignedIn, fetchProfile])

  const refreshProfile = useCallback(() => {
    setLoading(true)
    fetchProfile()
  }, [fetchProfile])

  return (
    <UserRoleContext.Provider value={makeValue(profile, loading, refreshProfile)}>
      {children}
    </UserRoleContext.Provider>
  )
}

// Used when HAS_CLERK=false — never calls useAuth()
function DevUserRoleProvider({ children }) {
  const value = makeValue({ role: 'ADVISOR', company: null }, false, () => {})
  return (
    <UserRoleContext.Provider value={value}>
      {children}
    </UserRoleContext.Provider>
  )
}

/**
 * Profile shape returned by GET /api/me:
 *   { role: 'ADVISOR' | 'CLIENT' | null, company: { id, name, industry } | null }
 */
export function UserRoleProvider({ children }) {
  if (!HAS_CLERK) return <DevUserRoleProvider>{children}</DevUserRoleProvider>
  return <ClerkUserRoleProvider>{children}</ClerkUserRoleProvider>
}

export function useUserRole() {
  const ctx = useContext(UserRoleContext)
  if (!ctx) throw new Error('useUserRole must be used within UserRoleProvider')
  return ctx
}
