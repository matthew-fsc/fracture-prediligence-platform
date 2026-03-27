import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

const STORAGE_KEY = 'prediligence_company_id'

const CompanyContext = createContext(null)

function parseCompanyId(value) {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : parseInt(String(value), 10)
  if (Number.isNaN(n) || n < 1) return null
  return n
}

export function CompanyProvider({ children }) {
  const [searchParams, setSearchParams] = useSearchParams()

  const [companyId, setCompanyIdState] = useState(() => {
    const q = parseCompanyId(searchParams.get('company'))
    if (q != null) return q
    const s = parseCompanyId(localStorage.getItem(STORAGE_KEY))
    if (s != null) return s
    // Do not default to id=1 — that can point at another user's company. Hydrate from /api/companies in CompanySwitcher.
    return null
  })

  useEffect(() => {
    const q = parseCompanyId(searchParams.get('company'))
    if (q != null && q !== companyId) {
      setCompanyIdState(q)
      localStorage.setItem(STORAGE_KEY, String(q))
    }
  }, [searchParams, companyId])

  const setCompanyId = useCallback(
    (id) => {
      if (id === null || id === undefined || id === '') {
        setCompanyIdState(null)
        localStorage.removeItem(STORAGE_KEY)
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.delete('company')
            return next
          },
          { replace: true },
        )
        return
      }
      const n = parseCompanyId(id)
      if (n == null) return
      setCompanyIdState(n)
      localStorage.setItem(STORAGE_KEY, String(n))
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('company', String(n))
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const value = { companyId, setCompanyId }
  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
}

export function useCompany() {
  const ctx = useContext(CompanyContext)
  if (!ctx) {
    throw new Error('useCompany must be used within CompanyProvider')
  }
  return ctx
}

export function useCompanyId() {
  return useCompany().companyId
}
