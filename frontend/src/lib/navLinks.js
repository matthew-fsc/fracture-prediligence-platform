/**
 * Append `?company=` to a path when the app is scoped to a non-default company.
 * Keeps engagement context when using sidebar NavLinks.
 */
export function withCompanyQuery(pathname, companyId) {
  if (companyId == null || companyId <= 1) return pathname
  const sep = pathname.includes('?') ? '&' : '?'
  return `${pathname}${sep}company=${companyId}`
}

/**
 * Maps full-app absolute routes to their demo sub-paths.
 * Keys are the canonical app paths; values are the demo segment (appended to /demo or /demo/:slug).
 */
const APP_TO_DEMO = {
  '/Home':              'home',
  '/CompanyWorkspace':  'company',
  '/EngagementIntake':  'engagement-intake',
  '/AdvisoryWorkflow':  'workflow',
  '/Readiness':         'readiness',
  '/BusinessQuality':   'business-quality',
  '/BuyerLens':         'buyer-lens',
  '/Valuation':         'valuation',
  '/MarketComps':       'market-comps',
  '/ValueGap':          'value-gap',
  '/EBITDATimeline':    'ebitda-timeline',
  '/InitiativeImpact':  'initiative-impact',
  '/ScenarioSimulator': 'scenario-simulator',
  '/RiskHeatmap':       'risk-heatmap',
  '/Connectors':        'data-sources',
  '/DataMapping':       'field-mapping',
  '/DataQuality':       'data-quality',
  '/DataRoom':          'data-room',
  '/Reports':           'reports',
  '/AdvisoryLibrary':   'advisory-library',
}

const DEMO_SUB_PATHS = new Set(Object.values(APP_TO_DEMO).concat(['home', '']))

/**
 * Detect the demo base prefix from the current pathname.
 * Returns e.g. "/demo" or "/demo/abc123" when inside a demo shell, or null otherwise.
 */
export function getDemoPrefix(pathname) {
  if (!pathname.startsWith('/demo')) return null
  const parts = pathname.split('/').filter(Boolean) // ['demo'] or ['demo','slug','page'] etc.
  if (parts.length < 1 || parts[0] !== 'demo') return null
  if (parts.length === 1) return '/demo'
  // If the second segment is a known demo sub-page, the prefix is /demo (no slug)
  if (DEMO_SUB_PATHS.has(parts[1])) return '/demo'
  // Otherwise the second segment is a slug
  return `/demo/${parts[1]}`
}

/**
 * Resolve an app-style route (e.g. "/BuyerLens") to the correct path
 * for the current context — either the app route as-is, or the demo
 * equivalent when running inside the demo shell.
 *
 * @param {string} appPath  Canonical app path, e.g. "/BuyerLens"
 * @param {string} currentPathname  Current location.pathname (from useLocation)
 * @returns {string} The resolved path
 */
export function resolvePath(appPath, currentPathname) {
  const prefix = getDemoPrefix(currentPathname)
  if (!prefix) return appPath
  const segment = APP_TO_DEMO[appPath]
  if (!segment) return appPath
  return `${prefix}/${segment}`
}
