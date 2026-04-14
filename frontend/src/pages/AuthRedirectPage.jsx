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
  const { role, loading } = useUserRole()
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
      navigate('/client/dashboard', { replace: true })
    } else {
      if (companiesLoading) return
      if (!Array.isArray(companies) || companies.length === 0) {
        navigate('/dashboard/onboarding', { replace: true })
        return
      }
      navigate('/Home', { replace: true })
    }
  }, [role, loading, navigate, companies, companiesLoading])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0A1628',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          border: '3px solid #C9973A',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
