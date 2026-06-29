import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useDemoData } from '../../context/DemoContext'
import { drsCategoryStyles } from '../../lib/drsCategoryColors'
import { apiClient } from '../../lib/apiClient'
import { cn, fmtM } from '../../lib/utils'
import { recentActivity as mockRecentActivity } from '../../lib/mockData'
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import {
  CheckCircle2, XCircle, AlertTriangle, AlertCircle, TrendingUp,
  FileText, Users, Settings, Building2, Shield, Target, BarChart2,
  ArrowRight, Activity, ListChecks, ChevronRight, Zap, Clock,
  NotebookPen,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------
function scoreColor(score) {
  if (score >= 75) return '#4ade80'   // green
  if (score >= 65) return '#f59e0b'   // amber
  return '#f87171'                    // red
}

function severityBadgeStyle(severity) {
  const base = {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 10,
    fontWeight: 700,
    padding: '3px 9px',
    borderRadius: 4,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    display: 'inline-block',
  }
  if (severity === 'CRITICAL') return { ...base, background: 'rgba(239,68,68,0.15)', color: '#f87171' }
  if (severity === 'HIGH')     return { ...base, background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }
  if (severity === 'MEDIUM')   return { ...base, background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }
  return { ...base, background: 'rgba(100,116,139,0.15)', color: '#94a3b8' }
}

function fmtDollar(n) {
  if (!n) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

const CATEGORY_LABELS = {
  revenue_quality: 'Revenue Quality',
  financial_integrity: 'Financial Integrity',
  operational_independence: 'Operational Independence',
  customer_risk: 'Customer Risk',
  management_team: 'Management Team',
  growth_drivers: 'Growth Drivers',
}

const CARD_STYLE = {
  background: '#0F2040',
  border: '1px solid #1E3A5F',
  borderRadius: 10,
  padding: '20px 22px',
}

const SECTION_HEADING = {
  color: '#F0EDE8',
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  fontSize: 20,
  fontWeight: 600,
  margin: '0 0 16px 0',
}

// ---------------------------------------------------------------------------
// Status strip card
// ---------------------------------------------------------------------------
function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ ...CARD_STYLE, flex: 1, minWidth: 0 }}>
      <p style={{ color: '#8A9BB0', fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px 0' }}>{label}</p>
      <p style={{ color: accent || '#F0EDE8', fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 28, fontWeight: 700, margin: '0 0 4px 0', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ color: '#8A9BB0', fontFamily: "'DM Sans', sans-serif", fontSize: 12, margin: 0 }}>{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DRS Category bar
// ---------------------------------------------------------------------------
function CategoryBar({ catKey, label, score }) {
  const scoreTint = scoreColor(score)
  const barFill = drsCategoryStyles[catKey]?.chartFill ?? '#60a5fa'
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ color: '#F0EDE8', fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>{label}</span>
        <span style={{ color: scoreTint, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600 }}>{score}</span>
      </div>
      <div style={{ height: 6, background: '#1E3A5F', borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${score}%`,
            background: barFill,
            borderRadius: 3,
            transition: 'width 0.6s ease',
          }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Flagged issue card
// ---------------------------------------------------------------------------
function IssueCard({ issue }) {
  return (
    <div
      style={{
        ...CARD_STYLE,
        borderLeft: `3px solid ${issue.severity === 'CRITICAL' ? '#f87171' : issue.severity === 'HIGH' ? '#f59e0b' : '#60a5fa'}`,
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={severityBadgeStyle(issue.severity)}>{issue.severity}</span>
          <span style={{ color: '#F0EDE8', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600 }}>{issue.title}</span>
        </div>
        <span
          style={{
            color: '#4ade80',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            background: 'rgba(74,222,128,0.1)',
            border: '1px solid rgba(74,222,128,0.2)',
            borderRadius: 4,
            padding: '3px 8px',
          }}
        >
          EV +{fmtDollar(issue.ev_impact)} if resolved
        </span>
      </div>
      <p style={{ color: '#8A9BB0', fontFamily: "'DM Sans', sans-serif", fontSize: 13, lineHeight: 1.6, margin: '0 0 8px 0' }}>
        {issue.description}
      </p>
      <p style={{ color: '#60a5fa', fontFamily: "'DM Sans', sans-serif", fontSize: 12, margin: 0 }}>
        <strong>Needed:</strong> {issue.data_needed} — <strong>Timeline:</strong> {issue.timeline}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Checklist group
// ---------------------------------------------------------------------------
function ChecklistGroup({ category, items }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ color: '#8A9BB0', fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px 0' }}>
        {category}
      </p>
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 0',
            borderBottom: '1px solid rgba(30,58,95,0.5)',
          }}
        >
          {item.status === 'complete'
            ? <CheckCircle2 style={{ color: '#4ade80', flexShrink: 0, width: 15, height: 15 }} />
            : <XCircle style={{ color: '#f87171', flexShrink: 0, width: 15, height: 15 }} />
          }
          <span
            style={{
              color: item.status === 'complete' ? '#F0EDE8' : '#8A9BB0',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              lineHeight: 1.4,
            }}
          >
            {item.name}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Data room section row
// ---------------------------------------------------------------------------
function DataRoomSection({ section }) {
  const total = section.docs.length
  const complete = section.docs.filter((d) => d.status === 'complete').length
  const pct = Math.round((complete / total) * 100)

  return (
    <div style={{ ...CARD_STYLE, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ color: '#F0EDE8', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600 }}>
          {section.name}
        </span>
        <span style={{ color: pct === 100 ? '#4ade80' : pct >= 60 ? '#f59e0b' : '#f87171', fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600 }}>
          {complete}/{total} docs
        </span>
      </div>
      <div style={{ height: 4, background: '#1E3A5F', borderRadius: 2, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: pct === 100 ? '#4ade80' : pct >= 60 ? '#f59e0b' : '#f87171',
            borderRadius: 2,
          }}
        />
      </div>
      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {section.docs.map((doc) => (
          <span
            key={doc.name}
            style={{
              background: doc.status === 'complete' ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
              border: `1px solid ${doc.status === 'complete' ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
              color: doc.status === 'complete' ? '#4ade80' : '#f87171',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
              padding: '3px 8px',
              borderRadius: 4,
            }}
          >
            {doc.status === 'complete' ? '? ' : '? '}{doc.name.replace(' — MISSING', '')}
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tailwind color config for module grid (mirrors Home.jsx colorCfg)
// ---------------------------------------------------------------------------
const colorCfg = {
  blue:    'border-blue-500/20 bg-blue-500/5 text-blue-400',
  red:     'border-red-500/20 bg-red-500/5 text-red-400',
  emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400',
  amber:   'border-amber-500/20 bg-amber-500/5 text-amber-400',
  purple:  'border-purple-500/20 bg-purple-500/5 text-purple-400',
  primary: 'border-primary/20 bg-primary/5 text-primary',
}

const DEMO_MODULES = [
  { label: 'Client Profile',      path: 'engagement-intake', icon: NotebookPen, color: 'primary', desc: 'Owner goals, exit timeline, buyer fit' },
  { label: 'Company Workspace',   path: 'company',           icon: Building2,  color: 'blue',    desc: 'Entity-centric intelligence hub' },
  { label: 'Buyer Risk Profile',  path: 'buyer-lens',        icon: Shield,     color: 'red',     desc: null },
  { label: 'Value Gap Analysis',  path: 'value-gap',         icon: Target,     color: 'emerald', desc: 'Addressable value creation opportunity' },
  { label: 'Business Quality',    path: 'business-quality',  icon: BarChart2,  color: 'blue',    desc: 'Operating metrics vs benchmarks' },
  { label: 'Scenario Simulator',  path: 'scenario-simulator',icon: Activity,   color: 'amber',   desc: 'Model adverse events in real time' },
  { label: 'Advisory Workflow',   path: 'workflow',          icon: ListChecks, color: 'primary', desc: 'CEPA engagement progress tracker' },
  { label: 'EBITDA Timeline',     path: 'ebitda-timeline',   icon: TrendingUp, color: 'purple',  desc: 'Historical EBITDA & EV progression' },
]

const DEMO_QUICK_ACTIONS = [
  { label: 'Capture client profile',    path: 'engagement-intake',  color: 'text-primary' },
  { label: 'Generate Readiness Report', path: 'reports',            color: 'text-primary' },
  { label: 'Review Buyer Risk Flags',   path: 'buyer-lens',         color: 'text-red-400' },
  { label: 'Run Scenario Simulation',   path: 'scenario-simulator', color: 'text-amber-400' },
  { label: 'View Readiness Score',      path: 'readiness',          color: 'text-blue-400' },
]

// ---------------------------------------------------------------------------
// Build activity feed from live data (mirrors Home.jsx buildActivity)
// ---------------------------------------------------------------------------
function buildActivity(jobs, liveData, bqData, gapData) {
  const items = []
  for (const j of (jobs ?? []).slice(0, 5)) {
    const label = {
      quickbooks_pl: 'QuickBooks P&L',
      quickbooks_ar: 'QuickBooks A/R Aging',
      quickbooks_tx: 'QuickBooks Transactions',
      crm_export: 'CRM Export',
      payroll: 'Payroll Register',
      customer_list: 'Customer List',
      contract_list: 'Contract List',
      bank_statement: 'Bank Statement',
    }[j.source_type] ?? j.filename ?? 'File'
    const rows = j.row_count ? `${j.row_count.toLocaleString()} rows` : ''
    const detail = [rows, j.mapped_count ? `${j.mapped_count} columns mapped` : ''].filter(Boolean).join(' · ')
    const d = j.created_at ? new Date(j.created_at) : null
    const time = d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
    items.push({ event: `${label} ingested`, detail: detail || j.status, time })
  }
  if (liveData?.drs?.base != null) {
    const tier = liveData.drs.tier ?? ''
    items.push({
      event: `DRS scored: ${liveData.drs.base.toFixed(1)}/100${tier ? ` — ${tier} tier` : ''}`,
      detail: '6 categories scored · composite readiness index',
      time: 'Current',
    })
  }
  const crit = (bqData?.questions ?? []).find(q => q.severity === 'CRITICAL')
  if (crit) {
    items.push({
      event: `Critical flag: ${crit.question.length > 55 ? crit.question.slice(0, 52) + '…' : crit.question}`,
      detail: crit.category ?? '',
      time: 'Active',
    })
  }
  const activityValueGap = Math.max(0, (gapData?.potential_ev_midpoint ?? 0) - (liveData?.enterprise_value?.midpoint ?? 0))
  if (activityValueGap > 0) {
    items.push({
      event: `Value gap analysis: +${fmtM(activityValueGap)} opportunity`,
      detail: `${gapData.gaps?.length ?? 0} value drivers identified`,
      time: 'Current',
    })
  }
  return items.slice(0, 6)
}

// ---------------------------------------------------------------------------
// Custom chart tooltip
// ---------------------------------------------------------------------------
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: '#0F2040',
        border: '1px solid #1E3A5F',
        borderRadius: 8,
        padding: '10px 14px',
      }}
    >
      <p style={{ color: '#8A9BB0', fontFamily: "'DM Sans', sans-serif", fontSize: 11, margin: '0 0 4px 0' }}>{label}</p>
      <p style={{ color: '#C9973A', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, margin: 0 }}>
        {fmtDollar(payload[0].value)}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function DemoHome() {
  const navigate = useNavigate()
  const { demoData, slug } = useDemoData()
  const basePrefix = slug ? `/demo/${slug}` : '/demo'
  const go = (path) => navigate(`${basePrefix}/${path}`)

  // Live API queries — all prefetched by DemoShell so they resolve from cache
  const QUIET = { meta: { suppressErrorToast: true } }
  const STALE = 120_000

  const { data: liveScores } = useQuery({
    queryKey: ['analytics-scores', 1],
    queryFn: () => apiClient.get('/api/analytics/scores/1'),
    staleTime: STALE, ...QUIET,
  })
  const { data: bqLive } = useQuery({
    queryKey: ['analytics-buyer-questions', 1],
    queryFn: () => apiClient.get('/api/analytics/buyer-questions/1'),
    staleTime: STALE, ...QUIET,
  })
  const { data: gapLive } = useQuery({
    queryKey: ['analytics-value-gap', 1],
    queryFn: () => apiClient.get('/api/analytics/value-gap/1'),
    staleTime: STALE, ...QUIET,
  })
  const { data: jobs = [] } = useQuery({
    queryKey: ['ingestion-jobs', 1],
    queryFn: () => apiClient.get('/api/ingestion/jobs/1').then(d => Array.isArray(d) ? d : []),
    staleTime: 60_000, ...QUIET,
  })
  const { data: engProfile } = useQuery({
    queryKey: ['engagement-profile', 1],
    queryFn: () => apiClient.get('/api/analytics/engagement-profile/1').catch(() => null),
    staleTime: STALE, ...QUIET,
  })
  const { data: snapshotData } = useQuery({
    queryKey: ['score-history', 1],
    queryFn: () => apiClient.get('/api/analytics/scores/1/history'),
    staleTime: STALE, ...QUIET,
  })

  const dd = demoData

  // While loading
  if (!dd) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
        <p style={{ color: '#8A9BB0', fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>Loading demo data...</p>
      </div>
    )
  }

  const { company, drs, category_scores, enterprise_value, flagged_issues, checklist, data_room, monthly_revenue } = dd

  // Group checklist items by category
  const checklistByCategory = {}
  for (const item of checklist.items) {
    if (!checklistByCategory[item.category]) checklistByCategory[item.category] = []
    checklistByCategory[item.category].push(item)
  }

  // Derive live values (fall back to demo data)
  const liveDrs        = liveScores?.drs?.base ?? drs.base
  const liveTier       = liveScores?.drs?.tier ?? drs.tier
  const liveEV         = liveScores?.enterprise_value?.midpoint ?? enterprise_value.midpoint
  const potentialEV    = gapLive?.potential_ev_midpoint ?? enterprise_value.ceiling
  const valueGap       = Math.max(0, potentialEV - liveEV)
  const liveCritical   = bqLive?.questions?.filter(q => q.severity === 'CRITICAL').length ?? flagged_issues.filter(f => f.severity === 'CRITICAL').length
  const liveHigh       = bqLive?.questions?.filter(q => q.severity === 'HIGH').length ?? 0
  const liveBlockers   = liveCritical + liveHigh

  // Greeting
  const hour    = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr  = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  // Activity feed
  const apiActivity = buildActivity(jobs, liveScores, bqLive, gapLive)
  const activityItems = apiActivity.length > 0 ? apiActivity : mockRecentActivity

  return (
    <div style={{ color: '#F0EDE8', maxWidth: 1100, margin: '0 auto' }}>

      {/* ------------------------------------------------------------------ */}
      {/* Greeting                                                             */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ color: '#8A9BB0', fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px 0' }}>{dateStr}</p>
        <h1 style={{ color: '#F0EDE8', fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 700, margin: '0 0 2px 0' }}>{greeting}, Advisor</h1>
        <p style={{ color: '#8A9BB0', fontFamily: "'DM Sans', sans-serif", fontSize: 13, margin: '0 0 6px 0' }}>
          {company.name} — {company.industry}
        </p>
        <p style={{ color: '#8A9BB0', fontFamily: "'DM Sans', sans-serif", fontSize: 12, margin: 0 }}>
          {company.state && `${company.state} — `}
          Founded {company.founded} — {company.employees} employees —{' '}
          Owner: {company.owner} — Advisor: {company.advisor}
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Status strip                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 28, flexWrap: 'wrap' }}>
        <StatCard
          label="DRS Score"
          value={`${liveDrs.toFixed(1)}/100`}
          sub={liveTier}
          accent="#f59e0b"
        />
        <StatCard
          label="Enterprise Value"
          value={fmtDollar(liveEV)}
          sub={`${fmtDollar(enterprise_value.floor)} — ${fmtDollar(enterprise_value.ceiling)} range`}
          accent="#C9973A"
        />
        <StatCard
          label="Open Blockers"
          value={`${liveBlockers} flags`}
          sub={`${liveCritical} critical`}
          accent={liveCritical > 0 ? '#f87171' : '#f59e0b'}
        />
        <StatCard
          label="Value Opportunity"
          value={`+${fmtDollar(valueGap)}`}
          sub="if all gaps resolved"
          accent="#4ade80"
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Owner Financial Target (shown when engagement profile has target)    */}
      {/* ------------------------------------------------------------------ */}
      {(() => {
        const ownerTarget  = engProfile?.target_valuation != null ? Number(engProfile.target_valuation) : null
        const financialGap = engProfile?.personal_financial_gap != null ? Number(engProfile.personal_financial_gap) : null
        const evShortfall  = ownerTarget && liveEV ? Math.max(0, ownerTarget - liveEV) : null
        if (!ownerTarget && !financialGap) return null
        return (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 mb-7">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-amber-400" />
              Owner Financial Target
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              {ownerTarget != null && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">Owner Target</p>
                  <p className="text-lg font-bold text-amber-400">{fmtDollar(ownerTarget)}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">Current EV</p>
                <p className="text-lg font-bold text-blue-400">{liveEV ? fmtDollar(liveEV) : '—'}</p>
              </div>
              {evShortfall != null && evShortfall > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">EV Shortfall</p>
                  <p className="text-lg font-bold text-red-400">{fmtDollar(evShortfall)}</p>
                </div>
              )}
              {financialGap != null && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">Personal Fin. Gap</p>
                  <p className="text-lg font-bold text-red-400">{fmtDollar(financialGap)}</p>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* ------------------------------------------------------------------ */}
      {/* Owner Personal Readiness (PRE) Score                                 */}
      {/* ------------------------------------------------------------------ */}
      {liveScores?.owner_readiness && (() => {
        const pre = liveScores.owner_readiness
        const tierColor =
          pre.tier === 'Aligned'      ? 'emerald' :
          pre.tier === 'Mostly Ready' ? 'blue'    :
          pre.tier === 'Moderate Gap' ? 'amber'   : 'red'
        const barColor =
          pre.tier === 'Aligned'      ? 'bg-emerald-500' :
          pre.tier === 'Mostly Ready' ? 'bg-blue-500'    :
          pre.tier === 'Moderate Gap' ? 'bg-amber-500'   : 'bg-red-500'
        return (
          <div className={cn('rounded-xl border p-4 mb-7', colorCfg[tierColor])}>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Owner Personal Readiness (PRE)
            </p>
            <div className="flex items-end gap-4 mb-3">
              <div>
                <p className="text-3xl font-black">{pre.pre_score.toFixed(0)}<span className="text-base font-semibold text-muted-foreground">/100</span></p>
                <p className="text-xs font-semibold mt-0.5">{pre.tier}</p>
              </div>
              <div className="flex-1 pb-1">
                <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pre.pre_score}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">{pre.summary}</p>
              </div>
            </div>
            {pre.dimensions?.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {pre.dimensions.map(d => (
                  <div key={d.name} className="rounded-lg bg-background/30 border border-border/40 px-2.5 py-2">
                    <p className="text-[10px] font-semibold text-muted-foreground">{d.name}</p>
                    <p className="text-sm font-bold mt-0.5">{d.score.toFixed(0)}<span className="text-[10px] text-muted-foreground">/100</span></p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{d.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* ------------------------------------------------------------------ */}
      {/* DRS Score Trend (shown when 2+ snapshots exist)                      */}
      {/* ------------------------------------------------------------------ */}
      {(() => {
        const snaps = snapshotData?.snapshots ?? []
        if (snaps.length < 2) return null
        const chartData = snaps.map(s => ({
          date: s.created_at ? new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
          drs: typeof s.drs_score === 'number' ? parseFloat(s.drs_score.toFixed(1)) : null,
        }))
        const first = snaps[0]?.drs_score ?? 0
        const last  = snaps[snaps.length - 1]?.drs_score ?? 0
        const delta = last - first
        const deltaColor = delta > 0 ? '#4ade80' : delta < 0 ? '#f87171' : '#8A9BB0'
        return (
          <div style={{ ...CARD_STYLE, marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <TrendingUp style={{ width: 14, height: 14, color: '#C9973A' }} />
              <span style={{ color: '#F0EDE8', fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600 }}>DRS Score Trend</span>
              <span style={{ color: deltaColor, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, marginLeft: 4 }}>
                {delta >= 0 ? '+' : ''}{delta.toFixed(1)} pts
              </span>
              <span style={{ color: '#8A9BB0', fontFamily: "'DM Sans', sans-serif", fontSize: 10, marginLeft: 'auto' }}>
                {snaps.length} snapshots
              </span>
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#8A9BB0' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#8A9BB0' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: '#0F2040', border: '1px solid #1E3A5F', borderRadius: 6, fontSize: 11 }}
                  labelStyle={{ color: '#8A9BB0' }}
                  formatter={(v) => [v, 'DRS']}
                />
                <ReferenceLine y={70} stroke="#4ade80" strokeDasharray="3 3" strokeOpacity={0.4} />
                <Line type="monotone" dataKey="drs" stroke="#C9973A" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )
      })()}

      {/* ------------------------------------------------------------------ */}
      {/* Two-column: DRS breakdown + Revenue chart                            */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        {/* DRS Category Breakdown */}
        <div style={CARD_STYLE}>
          <h2 style={SECTION_HEADING}>DRS Category Breakdown</h2>
          {Object.entries(category_scores).map(([key, val]) => (
            <CategoryBar
              key={key}
              catKey={key}
              label={CATEGORY_LABELS[key] || key}
              score={val.composite}
            />
          ))}
        </div>

        {/* Monthly Revenue Chart */}
        <div style={CARD_STYLE}>
          <h2 style={SECTION_HEADING}>Monthly Revenue — 2025</h2>
          <p style={{ color: '#8A9BB0', fontFamily: "'DM Sans', sans-serif", fontSize: 12, margin: '0 0 16px 0' }}>
            Retainer-driven professional services — TTM {fmtDollar(company.ttm_revenue)}
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthly_revenue} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C9973A" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#C9973A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
              <XAxis
                dataKey="month"
                tick={{ fill: '#8A9BB0', fontSize: 10, fontFamily: 'DM Sans, sans-serif' }}
                axisLine={{ stroke: '#1E3A5F' }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                tick={{ fill: '#8A9BB0', fontSize: 10, fontFamily: 'DM Sans, sans-serif' }}
                axisLine={{ stroke: '#1E3A5F' }}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#C9973A"
                strokeWidth={2}
                fill="url(#revenueGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Advisory Modules grid                                                */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ marginBottom: 28 }}>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Advisory Modules</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {DEMO_MODULES.map(m => {
            const Icon = m.icon
            const bqDesc = m.path === 'buyer-lens' && bqLive
              ? `${bqLive.total} flags · ${liveCritical} critical`
              : m.desc
            return (
              <div key={m.path} onClick={() => go(m.path)}
                className={cn('rounded-lg border p-4 hover:scale-[1.02] transition-all cursor-pointer group', colorCfg[m.color])}>
                <Icon className="w-5 h-5 mb-2" />
                <p className="text-sm font-semibold text-foreground">{m.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{bqDesc}</p>
                <div className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
                  Open <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Flagged Issues                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ ...SECTION_HEADING, fontSize: 22 }}>
          Flagged Issues
          <span
            style={{
              marginLeft: 10,
              background: 'rgba(248,113,113,0.12)',
              border: '1px solid rgba(248,113,113,0.25)',
              color: '#f87171',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 9px',
              borderRadius: 4,
              verticalAlign: 'middle',
            }}
          >
            {flagged_issues.length} open
          </span>
        </h2>
        {flagged_issues.map((issue) => (
          <IssueCard key={issue.id} issue={issue} />
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Two-column: Checklist + Data Room                                    */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>

        {/* Checklist */}
        <div style={CARD_STYLE}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ ...SECTION_HEADING, margin: 0 }}>Exit Readiness Checklist</h2>
            <span
              style={{
                color: '#60a5fa',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {checklist.completed}/{checklist.total}
            </span>
          </div>
          {/* Overall progress bar */}
          <div style={{ height: 4, background: '#1E3A5F', borderRadius: 2, overflow: 'hidden', marginBottom: 18 }}>
            <div
              style={{
                height: '100%',
                width: `${checklist.pct}%`,
                background: '#60a5fa',
                borderRadius: 2,
              }}
            />
          </div>
          {Object.entries(checklistByCategory).map(([cat, items]) => (
            <ChecklistGroup key={cat} category={cat} items={items} />
          ))}
        </div>

        {/* Data Room */}
        <div>
          <h2 style={{ ...SECTION_HEADING, fontSize: 22 }}>Data Room Status</h2>
          {data_room.sections.map((section) => (
            <DataRoomSection key={section.name} section={section} />
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* EBITDA / EV summary strip                                            */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          ...CARD_STYLE,
          display: 'flex',
          gap: 0,
          overflow: 'hidden',
          marginBottom: 28,
        }}
      >
        {[
          { label: 'TTM Revenue', value: fmtDollar(company.ttm_revenue), color: '#F0EDE8' },
          { label: 'EBITDA', value: fmtDollar(company.ebitda), color: '#4ade80' },
          { label: 'EBITDA Margin', value: `${company.ebitda_margin}%`, color: '#4ade80' },
          { label: 'EV Floor', value: fmtDollar(enterprise_value.floor), color: '#8A9BB0' },
          { label: 'EV Midpoint', value: fmtDollar(enterprise_value.midpoint), color: '#C9973A' },
          { label: 'EV Ceiling', value: fmtDollar(enterprise_value.ceiling), color: '#8A9BB0' },
          { label: 'Multiple Range', value: `${enterprise_value.multiple_used}x`, color: '#60a5fa' },
        ].map((item, i, arr) => (
          <div
            key={item.label}
            style={{
              flex: 1,
              padding: '14px 16px',
              borderRight: i < arr.length - 1 ? '1px solid #1E3A5F' : 'none',
              textAlign: 'center',
            }}
          >
            <p style={{ color: '#8A9BB0', fontFamily: "'DM Sans', sans-serif", fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px 0' }}>
              {item.label}
            </p>
            <p style={{ color: item.color, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 20, fontWeight: 700, margin: 0 }}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Recent Activity + Quick Actions                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-12 gap-4 mt-7">
        <div className="col-span-12 md:col-span-7 rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" /> Recent Activity
          </p>
          <div className="space-y-2.5">
            {activityItems.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs text-foreground">{r.event}</p>
                    <p className="text-[11px] text-muted-foreground">{r.detail}</p>
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground flex-shrink-0 ml-2">{r.time}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="col-span-12 md:col-span-5 rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Quick Actions
          </p>
          <div className="space-y-2">
            {DEMO_QUICK_ACTIONS.map((a, i) => (
              <button key={i} onClick={() => go(a.path)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:bg-muted/30 transition-colors group">
                <span className={cn('text-xs font-medium', a.color)}>{a.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
