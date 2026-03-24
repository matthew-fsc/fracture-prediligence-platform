// Static reference data for Meridian Consulting Group — Client-0 demo
// Live analytics values come from API; these are fallbacks and UI-only fields

export const company = {
  id: 'meridian-001',
  name: 'Meridian Consulting Group',
  initials: 'MC',
  industry: 'Professional Services',
  employees: 12,
  founded: 2018,
  status: 'Active Engagement',
  stage: 'Pre-Diligence',
}

// Baseline fallback values — overridden by live API data where available
export const kpis = {
  drs: 82,
  drsPercentile: 68,
  ebitda: 2_400_000,
  ebitdaMultiple: 6.0,
  currentEV: 14_400_000,
  potentialEV: 19_200_000,
  valueGap: 4_800_000,
  ttmRevenue: 4_170_000,
  revenueGrowthYoY: 7.9,
  recurringRevenuePct: 68,
  grossMargin: 58,
  payrollRatio: 43,
}

export const drsCategories = [
  { name: 'Revenue Quality',          score: 88, weight: 0.25, tier: 'Strong' },
  { name: 'Financial Integrity',      score: 92, weight: 0.20, tier: 'Strong' },
  { name: 'Operational Independence', score: 81, weight: 0.20, tier: 'Strong' },
  { name: 'Customer Risk',            score: 75, weight: 0.15, tier: 'Adequate' },
  { name: 'Management & Team',        score: 82, weight: 0.10, tier: 'Strong' },
  { name: 'Growth Drivers',           score: 54, weight: 0.10, tier: 'Weak' },
]

export const ebitdaRecast = {
  reportedNetIncome: 2_150_000,
  addbackDA: 0,
  addbackInterest: 0,
  addbackTaxes: 0,
  reportedEBITDA: 2_150_000,
  addbackOwnerComp: 190_000,
  addbackPersonal: 58_000,
  addbackNonRecurring: 0,
  defensibleEBITDA: 2_400_000,
  scenarios: {
    conservative: 2_260_000,
    base: 2_400_000,
    aggressive: 2_590_000,
  },
}

export const customerConcentration = [
  { name: 'Pinnacle Manufacturing LLC', revenuePct: 12, revenue: 487_500,  contractStatus: 'Active',   tenure: 3.2 },
  { name: 'Vertex Capital Partners',    revenuePct: 10, revenue: 416_000,  contractStatus: 'Active',   tenure: 3.4 },
  { name: 'Cascade Health Systems',     revenuePct:  9, revenue: 376_000,  contractStatus: 'Active',   tenure: 3.0 },
  { name: 'Redwood Logistics Inc',      revenuePct:  8, revenue: 334_000,  contractStatus: 'Active',   tenure: 2.9 },
  { name: 'Summit Technology Group',    revenuePct:  7, revenue: 291_000,  contractStatus: 'Active',   tenure: 2.8 },
  { name: 'Others (13)',                revenuePct: 54, revenue: 2_265_739, contractStatus: 'Mixed',   tenure: null },
]

export const monthlyRevenue = [
  { month: "Jan '24", revenue: 306_876 },
  { month: "Feb '24", revenue: 333_613 },
  { month: "Mar '24", revenue: 393_245 },
  { month: "Apr '24", revenue: 314_075 },
  { month: "May '24", revenue: 365_957 },
  { month: "Jun '24", revenue: 353_620 },
  { month: "Jul '24", revenue: 339_100 },
  { month: "Aug '24", revenue: 339_834 },
  { month: "Sep '24", revenue: 378_000 },
  { month: "Oct '24", revenue: 346_071 },
  { month: "Nov '24", revenue: 350_335 },
  { month: "Dec '24", revenue: 352_870 },
]

export const valueCreationLevers = [
  { rank: 1, initiative: 'Growth Acceleration',    valueMin: 1_400_000, valueMax: 2_200_000, detail: 'CAGR 7.9% vs top-quartile benchmark of 20%+ — pipeline at 0.47x coverage', timeline: '18mo', severity: 'high' },
  { rank: 2, initiative: 'Client Retention',        valueMin: 800_000,  valueMax: 1_400_000, detail: '5 of 18 clients inactive (28% churn) — address at-risk accounts to rebuild ARR', timeline: '12mo', severity: 'high' },
  { rank: 3, initiative: 'Key Person Dependency',   valueMin: 600_000,  valueMax: 1_000_000, detail: 'CEO holds 60%+ of client relationships — institutional transition plan required', timeline: '12mo', severity: 'high' },
  { rank: 4, initiative: 'Contract Pipeline',       valueMin: 300_000,  valueMax: 600_000,   detail: '0.47x pipeline coverage — target 1.5x for Investment Grade buyer confidence',  timeline: '6mo',  severity: 'medium' },
  { rank: 5, initiative: 'Finance Infrastructure',  valueMin: 150_000,  valueMax: 350_000,   detail: 'No dedicated CFO/Controller — PE buyers will require independent financial leadership', timeline: '3mo', severity: 'medium' },
]

export const advisoryWorkflowStages = [
  { stage: 1, name: 'Discovery',              status: 'complete',     progress: 100 },
  { stage: 2, name: 'Data Collection',        status: 'complete',     progress: 100 },
  { stage: 3, name: 'Financial Analysis',     status: 'complete',     progress: 100 },
  { stage: 4, name: 'Business Valuation',     status: 'complete',     progress: 100 },
  { stage: 5, name: 'Value Gap Analysis',     status: 'in_progress',  progress: 65 },
  { stage: 6, name: 'Risk Mitigation Plan',   status: 'pending',      progress: 0 },
  { stage: 7, name: 'Buyer Readiness',        status: 'pending',      progress: 0 },
  { stage: 8, name: 'Process Preparation',    status: 'pending',      progress: 0 },
  { stage: 9, name: 'Exit Execution',         status: 'pending',      progress: 0 },
]

export const recentActivity = [
  { event: 'DRS updated: 78.4 -> 81.7 (Investment Grade)',    detail: 'Revenue consistency resolved — CV 42% reduced to 10.6% after retainer normalization', time: 'Mar 18' },
  { event: 'QuickBooks transaction list ingested',             detail: '1,942 rows · 36 months · $11.5M total revenue',                                     time: 'Mar 17' },
  { event: 'Gusto payroll report ingested',                    detail: '12 active employees · $1.46M annual payroll · $190K above-market owner comp flagged', time: 'Mar 17' },
  { event: 'HubSpot deals ingested — 13 active contracts',     detail: '$1.74M ARR under contract · avg 26 months remaining',                               time: 'Mar 16' },
]

export const marketBenchmarks = [
  { metric: 'Revenue Growth',    median: 8,  company: 7.9,  direction: 'higher_better', unit: '%' },
  { metric: 'EBITDA Margin',     median: 22, company: 57.5, direction: 'higher_better', unit: '%' },
  { metric: 'Payroll Ratio',     median: 55, company: 43,   direction: 'lower_better',  unit: '%' },
  { metric: 'Recurring Rev.',    median: 55, company: 68,   direction: 'higher_better', unit: '%' },
  { metric: 'Contract Coverage', median: 45, company: 47,   direction: 'higher_better', unit: '%' },
]
