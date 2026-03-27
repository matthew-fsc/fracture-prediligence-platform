/**
 * Append `?company=` to a path when the app is scoped to a non-default company.
 * Keeps engagement context when using sidebar NavLinks.
 */
export function withCompanyQuery(pathname, companyId) {
  if (companyId == null || companyId <= 1) return pathname
  const sep = pathname.includes('?') ? '&' : '?'
  return `${pathname}${sep}company=${companyId}`
}
