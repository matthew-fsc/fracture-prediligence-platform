/**
 * Canonical DRS category palette — tags, cards, chart segments, and section accents.
 * Keep Revenue Quality, Financial Integrity, Operational Independence, Customer Risk,
 * Management & Team, and Growth Drivers visually consistent across the app.
 */

export const DRS_CATEGORY_KEYS = [
  'revenue_quality',
  'financial_integrity',
  'operational_independence',
  'customer_risk',
  'management_team',
  'growth_drivers',
]

/**
 * @typedef {Object} DrsCategoryStyle
 * @property {string} bg       bg-*-500/10
 * @property {string} text     text-*-400
 * @property {string} border   border-*-500/20
 * @property {string} accentLine border-l-*-500 (left rule on section cards)
 * @property {string} dot      bg-*-500 (legend / inline markers)
 * @property {string} barSolid bg-*-500/70 (waterfall / dense bars)
 * @property {string} chartStroke hex for Recharts stroke
 * @property {string} chartFill hex for fills
 */

export const drsCategoryStyles = {
  revenue_quality: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    accentLine: 'border-l-blue-500',
    dot: 'bg-blue-500',
    barSolid: 'bg-blue-500/70',
    chartStroke: '#60a5fa',
    chartFill: '#60a5fa',
  },
  financial_integrity: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    border: 'border-slate-500/20',
    accentLine: 'border-l-slate-400',
    dot: 'bg-slate-400',
    barSolid: 'bg-slate-500/70',
    chartStroke: '#94a3b8',
    chartFill: '#94a3b8',
  },
  operational_independence: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/20',
    accentLine: 'border-l-orange-500',
    dot: 'bg-orange-500',
    barSolid: 'bg-orange-500/70',
    chartStroke: '#fb923c',
    chartFill: '#fb923c',
  },
  customer_risk: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    accentLine: 'border-l-amber-500',
    dot: 'bg-amber-500',
    barSolid: 'bg-amber-500/70',
    chartStroke: '#fbbf24',
    chartFill: '#fbbf24',
  },
  management_team: {
    bg: 'bg-violet-500/10',
    text: 'text-violet-400',
    border: 'border-violet-500/20',
    accentLine: 'border-l-violet-500',
    dot: 'bg-violet-500',
    barSolid: 'bg-violet-500/70',
    chartStroke: '#a78bfa',
    chartFill: '#a78bfa',
  },
  growth_drivers: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    accentLine: 'border-l-emerald-500',
    dot: 'bg-emerald-500',
    barSolid: 'bg-emerald-500/70',
    chartStroke: '#34d399',
    chartFill: '#34d399',
  },
}

/** Compact "tag" class string (Initiative Impact, etc.) */
export const drsCategoryBadge = Object.fromEntries(
  DRS_CATEGORY_KEYS.map((k) => {
    const s = drsCategoryStyles[k]
    return [k, `${s.bg} ${s.text} ${s.border}`]
  }),
)

/** Older / alternate driver keys → canonical DRS key */
export const drsCategoryKeyAliases = {
  operations: 'operational_independence',
  revenue: 'revenue_quality',
  margin: 'financial_integrity',
  documentation: 'financial_integrity',
  customer: 'customer_risk',
}

export function resolveDrsCategoryKey(key) {
  if (!key) return 'revenue_quality'
  return drsCategoryKeyAliases[key] ?? key
}

export function getDrsCategoryStyle(key) {
  const k = resolveDrsCategoryKey(key)
  return drsCategoryStyles[k] ?? drsCategoryStyles.revenue_quality
}

/** Badge class for any API or legacy key */
export function drsCategoryBadgeClass(key) {
  const k = resolveDrsCategoryKey(key)
  return drsCategoryBadge[k] ?? drsCategoryBadge.revenue_quality
}
