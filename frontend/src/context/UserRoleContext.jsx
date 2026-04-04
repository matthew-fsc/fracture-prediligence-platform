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

/**
 * Profile shape returned by GET /api/me:
 *   { role: 'ADVISOR' | 'CLIENT' | null, company: { id, name, industry } | null }
 */
export function UserRoleProvider({ children }) {
  const { isSignedIn, isLoaded } = useAuth()
  const [profile, setProfileState] = useState(null)   // null = not yet loaded
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
    if (!HAS_CLERK) {
      // Dev mode without Clerk: default to ADVISOR so all advisor routes work
      setProfileState({ role: 'ADVISOR', company: null })
      setLoading(false)
      return
    }

    if (!isLoaded) return  // Clerk not ready yet

    if (!isSignedIn) {
      setProfileState(null)
      setLoading(false)
      return
    }

    fetchProfile()
  }, [isLoaded, isSignedIn, fetchProfile])

  /** Called after role selection page submits successfully */
  const refreshProfile = useCallback(() => {
    setLoading(true)
    fetchProfile()
  }, [fetchProfile])

  const role = profile?.role ?? null
  const isAdvisor = role === 'ADVISOR'
  const isClient = role === 'CLIENT'
  const clientCompany = profile?.company ?? null

  const value = {
    profile,
    role,
    isAdvisor,
    isClient,
    clientCompany,
    loading,
    refreshProfile,
  }

  return (
    <UserRoleContext.Provider value={value}>
      {children}
    </UserRoleContext.Provider>
  )
}

export function useUserRole() {
  const ctx = useContext(UserRoleContext)
  if (!ctx) throw new Error('useUserRole must be used within UserRoleProvider')
  return ctx
}
