// Mock data for Meridian Consulting Group — Client-0 demo
// Replace with real API calls once backend is live

export const company = {
  id: 'meridian-001',
  name: 'Meridian Consulting Group',
  initials: 'MC',
  industry: 'Professional Services',
  employees: 42,
  founded: 2018,
  status: 'Active Engagement',
  stage: 'Pre-Diligence',
}

export const kpis = {
  drs: 72,
  drsPercentile: 38,
  ebitda: 1_030_000,
  ebitdaMultiple: 5.0,
  currentEV: 5_130_000,
  potentialEV: 9_410_000,
  valueGap: 4_280_000,
  ttmRevenue: 6_840_000,
  revenueGrowthYoY: 12.4,
  recurringRevenuePct: 64,
  grossMargin: 68,
  payrollRatio: 38,
}

export const drsCategories = [
  { name: 'Revenue Quality',          score: 68, weight: 0.25, tier: 'Watch' },
  { name: 'Financial Integrity',      score: 78, weight: 0.20, tier: 'Adequate' },
  { name: 'Operational Independence', score: 52, weight: 0.20, tier: 'High Risk' },
  { name: 'Customer Risk',            score: 61, weight: 0.15, tier: 'Watch' },
  { name: 'Management & Team',        score: 74, weight: 0.10, tier: 'Adequate' },
  { name: 'Growth Drivers',           score: 80, weight: 0.10, tier: 'Strong' },
]

export const ebitdaRecast = {
  reportedNetIncome: 610_000,
  addbackDA: 85_000,
  addbackInterest: 42_000,
  addbackTaxes: 118_000,
  reportedEBITDA: 855_000,
  addbackOwnerComp: 95_000,
  addbackPersonal: 48_000,
  addbackNonRecurring: 32_000,
  defensibleEBITDA: 1_030_000,
  scenarios: {
    conservative: 970_000,
    base: 1_030_000,
    aggressive: 1_145_000,
  },
}

export const customerConcentration = [
  { name: 'Acme Corp',    revenuePct: 22, revenue: 1_504_800, contractStatus: 'None',     tenure: 4.2 },
  { name: 'TechFlow Inc', revenuePct: 12, revenue: 820_800,   contractStatus: 'Active',   tenure: 3.1 },
  { name: 'DataBridge',   revenuePct: 10, revenue: 684_000,   contractStatus: 'Expiring', tenure: 2.8 },
  { name: 'CloudSync',    revenuePct:  8, revenue: 547_200,   contractStatus: 'Active',   tenure: 5.5 },
  { name: 'NetPrime',     revenuePct:  7, revenue: 478_800,   contractStatus: 'None',     tenure: 1.2 },
  { name: 'Others (243)', revenuePct: 41, revenue: 2_804_400, contractStatus: 'Mixed',    tenure: null },
]

export const monthlyRevenue = [
  { month: 'Aug', revenue: 535_000, expenses: 448_000 },
  { month: 'Sep', revenue: 558_000, expenses: 461_000 },
  { month: 'Oct', revenue: 572_000, expenses: 455_000 },
  { month: 'Nov', revenue: 548_000, expenses: 470_000 },
  { month: 'Dec', revenue: 520_000, expenses: 442_000 },
  { month: 'Jan', revenue: 561_000, expenses: 458_000 },
  { month: 'Feb', revenue: 574_000, expenses: 463_000 },
  { month: 'Mar', revenue: 589_000, expenses: 471_000 },
  { month: 'Apr', revenue: 598_000, expenses: 477_000 },
  { month: 'May', revenue: 612_000, expenses: 482_000 },
  { month: 'Jun', revenue: 571_000, expenses: 465_000 },
  { month: 'Jul', revenue: 602_000, expenses: 479_000 },
]

export const valueCreationLevers = [
  { rank: 1, initiative: 'Key Person Risk',        valueMin: 515_000, valueMax: 820_000, detail: '71% deal attribution to 2 people',              timeline: '12mo', severity: 'critical' },
  { rank: 2, initiative: 'Customer Concentration', valueMin: 615_000, valueMax: 1_030_000, detail: 'Acme Corp = 22% of revenue',                  timeline: '9mo',  severity: 'high' },
  { rank: 3, initiative: 'Payroll Efficiency',     valueMin: 540_000, valueMax: 1_200_000, detail: '38% payroll ratio (benchmark: 33%)',           timeline: '6mo',  severity: 'medium' },
  { rank: 4, initiative: 'Recurring Revenue',      valueMin: 205_000, valueMax: 410_000,   detail: '64% recurring proxy (median: 55%)',            timeline: '12mo', severity: 'medium' },
  { rank: 5, initiative: 'Contract Coverage',      valueMin: 103_000, valueMax: 308_000,   detail: '0 of top-5 customers have signed MSAs',       timeline: '1mo',  severity: 'high' },
]

export const advisoryWorkflowStages = [
  { stage: 1, name: 'Discovery',              status: 'complete',     progress: 100 },
  { stage: 2, name: 'Data Collection',        status: 'complete',     progress: 100 },
  { stage: 3, name: 'Financial Analysis',     status: 'complete',     progress: 100 },
  { stage: 4, name: 'Business Valuation',     status: 'complete',     progress: 100 },
  { stage: 5, name: 'Value Gap Analysis',     status: 'in_progress',  progress: 60 },
  { stage: 6, name: 'Risk Mitigation Plan',   status: 'pending',      progress: 0 },
  { stage: 7, name: 'Buyer Readiness',        status: 'pending',      progress: 0 },
  { stage: 8, name: 'Process Preparation',    status: 'pending',      progress: 0 },
  { stage: 9, name: 'Exit Execution',         status: 'pending',      progress: 0 },
]

export const recentActivity = [
  { event: 'Readiness score updated: 69 → 72',                  detail: '12,450 records processed',    time: '2h ago' },
  { event: 'QuickBooks sync completed',                          detail: '12,450 records',               time: '2h ago' },
  { event: 'Pre-Diligence Report v3 generated',                  detail: 'PDF + DOCX',                  time: '7h ago' },
  { event: 'Buyer Lens analysis updated',                        detail: '6 flags · 2 critical',        time: '1d ago' },
]

export const marketBenchmarks = [
  { metric: 'Revenue Growth',    median: 8,  company: 12.4, direction: 'higher_better', unit: '%' },
  { metric: 'EBITDA Margin',     median: 13, company: 15.1, direction: 'higher_better', unit: '%' },
  { metric: 'Payroll Ratio',     median: 33, company: 38,   direction: 'lower_better',  unit: '%' },
  { metric: 'Recurring Rev.',    median: 55, company: 64,   direction: 'higher_better', unit: '%' },
  { metric: 'Win Rate',          median: 24, company: 28,   direction: 'higher_better', unit: '%' },
]
