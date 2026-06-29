import { useEffect } from 'react'

const DEFAULT_TITLE = 'Exit Blueprint — M&A Exit Intelligence for Advisors'

/**
 * Set the document title for a page.
 * @param {string|null} title  - Page-specific title fragment.
 *                               If null/empty, falls back to the default site title.
 *
 * Usage:
 *   usePageTitle('Dashboard')          → "Dashboard — Exit Blueprint"
 *   usePageTitle(null)                 → "Exit Blueprint — M&A Exit Intelligence for Advisors"
 *   usePageTitle('Live Demo')          → "Live Demo — Exit Blueprint"
 */
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title
      ? `${title} — Exit Blueprint`
      : DEFAULT_TITLE
    return () => {
      document.title = DEFAULT_TITLE
    }
  }, [title])
}
