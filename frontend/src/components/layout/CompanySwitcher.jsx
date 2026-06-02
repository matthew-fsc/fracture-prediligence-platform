import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, ChevronDown, Loader2, Plus } from 'lucide-react'
import { cn } from '../../lib/utils'
import { apiClient } from '../../lib/apiClient'
import { toast } from '../../lib/notify'
import { useCompany } from '../../context/CompanyContext'

export default function CompanySwitcher({ displayName }) {
  const { companyId, setCompanyId } = useCompany()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const wrapRef = useRef(null)
  const qc = useQueryClient()

  const { data: companies = [], isLoading, isError } = useQuery({
    queryKey: ['companies'],
    queryFn: () => apiClient.get('/api/companies'),
    retry: 1,
    meta: { suppressErrorToast: true },
  })

  useEffect(() => {
    if (isLoading) return
    const ids = (companies ?? [])
      .map((c) => Number(c.id))
      .filter((n) => Number.isFinite(n) && n >= 1)
    if (ids.length === 0) {
      if (companyId != null) setCompanyId(null)
      return
    }
    const active = companyId == null ? null : Number(companyId)
    if (active == null || !ids.includes(active)) {
      setCompanyId(ids[0])
    }
  }, [companies, companyId, isLoading, setCompanyId])

  useEffect(() => {
    function onDoc(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    try {
      const c = await apiClient.post('/api/companies', { name })
      setNewName('')
      await qc.invalidateQueries({ queryKey: ['companies'] })
      await qc.invalidateQueries({ queryKey: ['company', c.id] })
      setCompanyId(c.id)
      setOpen(false)
    } catch (e) {
      toast.error(e?.message || 'Could not create client')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted/50 transition-colors text-xs font-medium text-card-foreground"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="max-w-[140px] truncate">{displayName}</span>
        <ChevronDown className={cn('w-3 h-3 text-muted-foreground flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full mt-1 min-w-[240px] rounded-lg border border-border bg-card shadow-lg z-50 py-1"
        >
          <div className="max-h-56 overflow-y-auto px-1">
            {isLoading && (
              <div className="flex items-center justify-center py-4 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            )}
            {isError && (
              <p className="text-[11px] text-destructive px-3 py-2">Could not load clients.</p>
            )}
            {!isLoading && !isError && companies.length === 0 && (
              <p className="text-[11px] text-muted-foreground px-3 py-2">No clients yet — add one below.</p>
            )}
            {!isLoading &&
              companies.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={c.id === companyId}
                  onClick={() => {
                    setCompanyId(c.id)
                    setOpen(false)
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs rounded-md hover:bg-muted/60',
                    c.id === companyId && 'bg-muted/40 font-medium',
                  )}
                >
                  {c.name}
                </button>
              ))}
          </div>
          <form onSubmit={handleCreate} className="border-t border-border p-2 flex gap-1.5 items-center">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New client name"
              className="flex-1 min-w-0 bg-background border border-border rounded-md px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="p-1.5 rounded-md border border-border hover:bg-muted/50 disabled:opacity-50"
              title="Add client"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
