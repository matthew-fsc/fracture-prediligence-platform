import { useEffect } from 'react'

const DEFAULT_TITLE = 'Fracture Systems — Pre-Diligence Platform for CEPA Advisors'

/**
 * Set the document title for a page.
 * @param {string|null} title  - Page-specific title fragment.
 *                               If null/empty, falls back to the default site title.
 *
 * Usage:
 *   usePageTitle('Dashboard')          → "Dashboard — Fracture Systems"
 *   usePageTitle(null)                 → "Fracture Systems — Pre-Diligence Platform for CEPA Advisors"
 *   usePageTitle('Live Demo')          → "Live Demo — Fracture Systems"
 */
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title
      ? `${title} — Fracture Systems`
      : DEFAULT_TITLE
    return () => {
      document.title = DEFAULT_TITLE
    }
  }, [title])
}
