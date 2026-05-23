import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { COMMAND_PALETTE_ROUTES } from '../../lib/commandPaletteRoutes'
import { withCompanyQuery } from '../../lib/navLinks'
import { useCompanyId } from '../../context/CompanyContext'

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate()
  const companyId = useCompanyId()
  const [q, setQ] = useState('')
  const inputRef = useRef(null)

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return COMMAND_PALETTE_ROUTES
    return COMMAND_PALETTE_ROUTES.filter(
      (r) => r.label.toLowerCase().includes(s) || r.href.toLowerCase().includes(s),
    )
  }, [q])

  useEffect(() => {
    if (!open) return
    setQ('')
    const t = setTimeout(() => inputRef.current?.focus(), 0)
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  function go(href) {
    navigate(withCompanyQuery(href, companyId))
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="command-palette-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            id="command-palette-title"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Jump to page…"
            className="flex-1 min-w-0 bg-transparent text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md hover:bg-muted/60 text-muted-foreground min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close palette"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <ul className="max-h-[min(50vh,320px)] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-xs text-muted-foreground text-center">No matches</li>
          )}
          {filtered.map((r) => (
            <li key={r.href}>
              <button
                type="button"
                onClick={() => go(r.href)}
                className={cn(
                  'w-full text-left px-4 py-2.5 text-xs text-card-foreground hover:bg-muted/60',
                  'focus-visible:outline-none focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                )}
              >
                {r.label}
                <span className="block text-[11px] text-muted-foreground font-mono mt-0.5">{r.href}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
