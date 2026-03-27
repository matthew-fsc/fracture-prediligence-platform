// Static reference data for ABC Company Inc — Field Services / Traffic Management
// Live analytics values come from API; these are fallbacks and UI-only fields

export const company = {
  id: 'abc-company-001',
  name: 'ABC Company Inc',
  initials: 'AC',
  industry: 'Field Services — Traffic Management & Transportation',
  employees: 25,
  founded: 2009,
  status: 'Active Engagement',
  stage: 'Pre-Diligence',
}

// Baseline fallback values — overridden by live API data where available
export const kpis = {
  drs: 50,
  drsPercentile: 22,
  ebitda: 806_357,
  ebitdaMultiple: 2.75,
  currentEV: 2_016_000,
  potentialEV: 2_822_000,
  valueGap: 806_000,
  ttmRevenue: 3_259_172,
  revenueGrowthYoY: 18.7,
  recurringRevenuePct: 0,
  grossMargin: 28.4,
  payrollRatio: 37.8,
}

export const drsCategories = [
  { name: 'Revenue Quality',          score: 32, weight: 0.25, tier: 'High Risk' },
  { name: 'Financial Integrity',      score: 89, weight: 0.20, tier: 'Strong' },
  { name: 'Operational Independence', score: 26, weight: 0.20, tier: 'High Risk' },
  { name: 'Customer Risk',            score: 69, weight: 0.15, tier: 'Conditional' },
  { name: 'Management & Team',        score: 50, weight: 0.10, tier: 'Conditional' },
  { name: 'Growth Drivers',           score: 40, weight: 0.10, tier: 'High Risk' },
]

export const ebitdaRecast = {
  reportedNetIncome: 806_357,
  addbackDA: 0,
  addbackInterest: 0,
  addbackTaxes: 0,
  reportedEBITDA: 806_357,
  addbackOwnerComp: 82_221,
  addbackPersonal: 0,
  addbackNonRecurring: 0,
  defensibleEBITDA: 888_578,
  scenarios: {
    conservative: 820_000,
    base: 888_578,
    aggressive: 950_000,
  },
}

export const customerConcentration = [
  { name: 'COMPANY 1',    revenuePct: 49.4, revenue: 1_609_997, contractStatus: 'Active', tenure: 9.0 },
  { name: 'COMPANY 2',    revenuePct: 19.0, revenue: 619_024,   contractStatus: 'Active', tenure: 9.0 },
  { name: 'COMPANY 3',    revenuePct:  4.9, revenue: 159_763,   contractStatus: 'Active', tenure: 8.0 },
  { name: 'COMPANY 4',    revenuePct:  3.3, revenue: 107_575,   contractStatus: 'Active', tenure: 8.0 },
  { name: 'COMPANY 5',    revenuePct:  2.4, revenue:  78_207,   contractStatus: 'Active', tenure: 7.0 },
  { name: 'Others (63)',  revenuePct: 21.0, revenue: 684_606,   contractStatus: 'Mixed',  tenure: null },
]

export const monthlyRevenue = [
  { month: "Jan '25", revenue: 237_667 },
  { month: "Feb '25", revenue: 237_667 },
  { month: "Mar '25", revenue: 237_667 },
  { month: "Apr '25", revenue: 237_667 },
  { month: "May '25", revenue: 237_667 },
  { month: "Jun '25", revenue: 237_667 },
  { month: "Jul '25", revenue: 237_667 },
  { month: "Aug '25", revenue: 237_667 },
  { month: "Sep '25", revenue: 237_667 },
  { month: "Oct '25", revenue: 237_667 },
  { month: "Nov '25", revenue: 237_667 },
  { month: "Dec '25", revenue: 237_715 },
]

export const valueCreationLevers = [
  { rank: 1, initiative: 'Customer Concentration',    valueMin: 600_000,  valueMax: 1_000_000, detail: 'Top 2 customers = 68.4% of revenue. Reduce below 40% to move from PRE_DILIGENCE to HIGH_RISK tier', timeline: '24mo', severity: 'high' },
  { rank: 2, initiative: 'Contract Formalization',    valueMin: 400_000,  valueMax: 800_000,   detail: 'Project-based relationships lack MSAs. Contractualize top 10 accounts to increase revenue quality score', timeline: '6mo',  severity: 'high' },
  { rank: 3, initiative: 'Key Person Dependency',     valueMin: 300_000,  valueMax: 600_000,   detail: 'Owner drives all customer relationships and field ops. Hire operations manager and document processes', timeline: '12mo', severity: 'high' },
  { rank: 4, initiative: 'Financial Documentation',   valueMin: 150_000,  valueMax: 350_000,   detail: 'No CPA review or audit. Engage CPA for 3-year review to support buyer financial integrity score', timeline: '3mo',  severity: 'medium' },
  { rank: 5, initiative: 'Revenue Diversification',   valueMin: 200_000,  valueMax: 500_000,   detail: 'Add 15+ new customers at $80K+ each to reduce HHI from 2,472 to below 1,500', timeline: '18mo', severity: 'medium' },
  { rank: 6, initiative: 'EBITDA Margin Improvement', valueMin: 100_000,  valueMax: 250_000,   detail: 'EBITDA margin 24.7%. Reduce equipment rental and overtime costs through fleet ownership and scheduling', timeline: '12mo', severity: 'medium' },
]

export const advisoryWorkflowStages = [
  { stage: 1, name: 'Discovery',              status: 'complete',     progress: 100 },
  { stage: 2, name: 'Data Collection',        status: 'complete',     progress: 100 },
  { stage: 3, name: 'Financial Analysis',     status: 'complete',     progress: 100 },
  { stage: 4, name: 'Business Valuation',     status: 'complete',     progress: 100 },
  { stage: 5, name: 'Value Gap Analysis',     status: 'in_progress',  progress: 40 },
  { stage: 6, name: 'Risk Mitigation Plan',   status: 'pending',      progress: 0 },
  { stage: 7, name: 'Buyer Readiness',        status: 'pending',      progress: 0 },
  { stage: 8, name: 'Process Preparation',    status: 'pending',      progress: 0 },
  { stage: 9, name: 'Exit Execution',         status: 'pending',      progress: 0 },
]

export const recentActivity = [
  { event: 'DRS scored: 50.4/100 — High Risk tier',                  detail: 'Key drivers: revenue quality 31.7 (0% recurring), operational independence 26.0 (single owner)', time: 'Mar 27' },
  { event: 'QuickBooks P&L ingested — 3 fiscal years',               detail: '2023: $2.79M · 2024: $2.75M · 2025: $3.26M · Reported EBITDA: $806,356 · COGS 71.6%', time: 'Mar 27' },
  { event: 'EBITDA recast complete — Officers salary addback $82K',   detail: '$202,221 actual vs $120,000 market rate · Defensible EBITDA base: $847,466 · Aggressive: $888,577', time: 'Mar 27' },
  { event: 'EV range computed: $2.0M–$2.8M at 2.5×–3.5× EBITDA',   detail: 'HIGH_RISK tier multiples applied. TTM concentration: COMPANY 1 = 49.4%, top-2 = 68.4%', time: 'Mar 27' },
]

export const marketBenchmarks = [
  { metric: 'Revenue Growth',    median: 8,  company: 18.7, direction: 'higher_better', unit: '%' },
  { metric: 'EBITDA Margin',     median: 22, company: 24.7, direction: 'higher_better', unit: '%' },
  { metric: 'Payroll Ratio',     median: 55, company: 37.8, direction: 'lower_better',  unit: '%' },
  { metric: 'Recurring Rev.',    median: 55, company: 35,   direction: 'higher_better', unit: '%' },
  { metric: 'Top Cust. Conc.',   median: 25, company: 49.4, direction: 'lower_better',  unit: '%' },
]
