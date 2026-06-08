import { useState, useEffect, useRef } from 'react'
import { X, Building2, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/apiClient'
import { toast } from '../../lib/notify'
import { useCompany } from '../../context/CompanyContext'

export default function NewClientDialog({ open, onClose }) {
  const { setCompanyId } = useCompany()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [billingError, setBillingError] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setName('')
      setBillingError(null)
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setSubmitting(true)
    setBillingError(null)
    try {
      const company = await apiClient.post('/api/companies/', { name: trimmed })
      await qc.invalidateQueries({ queryKey: ['companies'] })
      await qc.invalidateQueries({ queryKey: ['company', company.id] })
      setCompanyId(company.id)
      onClose()
    } catch (err) {
      if (err?.status === 402 || err?.detail?.action === 'add_engagement') {
        const detail = err?.detail ?? {}
        setBillingError(
          `You've reached your plan limit of ${detail.max_companies ?? 'N'} clients. ` +
          `Contact support to upgrade your plan.`
        )
      } else {
        toast.error(err?.message || 'Could not create client')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Add New Client</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="new-client-name">
              Client / Company name
            </label>
            <input
              id="new-client-name"
              ref={inputRef}
              value={name}
              onChange={(e) => { setName(e.target.value); setBillingError(null) }}
              disabled={submitting}
              placeholder="e.g. Acme Manufacturing LLC"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {billingError && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
              <p className="text-xs text-amber-400 leading-relaxed">{billingError}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Creating…
                </>
              ) : (
                'Add Client'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
