import { useDemoData } from '../../context/DemoContext'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { CheckCircle2, XCircle, AlertTriangle, AlertCircle, TrendingUp, FileText, Users, Settings } from 'lucide-react'

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
function CategoryBar({ label, score }) {
  const color = scoreColor(score)
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ color: '#F0EDE8', fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>{label}</span>
        <span style={{ color: color, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600 }}>{score}</span>
      </div>
      <div style={{ height: 6, background: '#1E3A5F', borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${score}%`,
            background: color,
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
  const ctx = useDemoData()
  const dd = ctx?.demoData

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

  // Count critical/high flags
  const criticalCount = flagged_issues.filter((f) => f.severity === 'CRITICAL').length

  return (
    <div style={{ color: '#F0EDE8', maxWidth: 1100, margin: '0 auto' }}>

      {/* ------------------------------------------------------------------ */}
      {/* Company header                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            color: '#F0EDE8',
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 28,
            fontWeight: 700,
            margin: '0 0 6px 0',
          }}
        >
          {company.name}
        </h1>
        <p style={{ color: '#8A9BB0', fontFamily: "'DM Sans', sans-serif", fontSize: 13, margin: 0 }}>
          {company.state && `${company.state} — `}
          {company.industry} — Founded {company.founded} — {company.employees} employees —{' '}
          Owner: {company.owner} — Advisor: {company.advisor}
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Status strip                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 28, flexWrap: 'wrap' }}>
        <StatCard
          label="DRS Score"
          value={`${drs.base}/100`}
          sub={drs.tier}
          accent="#f59e0b"
        />
        <StatCard
          label="Enterprise Value"
          value={fmtDollar(enterprise_value.midpoint)}
          sub={`${fmtDollar(enterprise_value.floor)} — ${fmtDollar(enterprise_value.ceiling)} range`}
          accent="#C9973A"
        />
        <StatCard
          label="Open Blockers"
          value={`${flagged_issues.length} flags`}
          sub={`${criticalCount} critical`}
          accent={criticalCount > 0 ? '#f87171' : '#f59e0b'}
        />
        <StatCard
          label="Checklist"
          value={`${checklist.pct}% complete`}
          sub={`${checklist.total - checklist.completed} items outstanding`}
          accent="#60a5fa"
        />
      </div>

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
              label={CATEGORY_LABELS[key] || key}
              score={val.composite}
            />
          ))}
        </div>

        {/* Monthly Revenue Chart */}
        <div style={CARD_STYLE}>
          <h2 style={SECTION_HEADING}>Monthly Revenue — 2024</h2>
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
            <h2 style={{ ...SECTION_HEADING, margin: 0 }}>Pre-Diligence Checklist</h2>
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

    </div>
  )
}
