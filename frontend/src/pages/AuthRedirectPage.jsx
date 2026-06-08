/**
 * AuthRedirectPage — smart post-sign-in redirect based on user role.
 *
 * Clerk's afterSignInUrl points here. This page fetches the user's role
 * and redirects them to the right portal:
 *   - No role yet  → /role-select
 *   - ADVISOR      → /Home
 *   - CLIENT       → /client/dashboard
 *
 * Also checks for a pending client invite token in sessionStorage.
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useUserRole } from '../context/UserRoleContext'
import { apiClient } from '../lib/apiClient'

export default function AuthRedirectPage() {
  const navigate = useNavigate()
  const { role, loading, clientCompany } = useUserRole()
  const isAdvisor = role === 'ADVISOR'
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => apiClient.get('/api/companies'),
    enabled: !loading && isAdvisor,
    retry: false,
    meta: { suppressErrorToast: true },
  })

  useEffect(() => {
    if (loading) return

    // Check if there's a pending invite the user was trying to accept
    const pendingToken = sessionStorage.getItem('pending_client_invite_token')
    if (pendingToken) {
      navigate(`/client-invite/${pendingToken}`, { replace: true })
      return
    }

    if (role === null) {
      navigate('/role-select', { replace: true })
    } else if (role === 'CLIENT') {
      // Route new clients through owner onboarding wizard before the dashboard
      // clientCompany.owner_onboarding_completed comes from GET /api/me
      if (clientCompany && !clientCompany.owner_onboarding_completed) {
        navigate('/owner-onboarding', { replace: true })
      } else {
        navigate('/client/dashboard', { replace: true })
      }
    } else {
      if (companiesLoading) return
      if (!Array.isArray(companies) || companies.length === 0) {
        navigate('/dashboard/onboarding', { replace: true })
        return
      }
      navigate('/Home', { replace: true })
    }
  }, [role, loading, navigate, companies, companiesLoading, clientCompany])

  return (
    <div className="min-h-screen bg-background dark flex items-center justify-center">
      <div
        className="w-9 h-9 rounded-full border-2 animate-spin"
        style={{ borderColor: 'hsl(var(--primary))', borderTopColor: 'transparent' }}
      />
    </div>
  )
}
