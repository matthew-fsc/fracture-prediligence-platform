import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import SectionHeader from '../components/ui/SectionHeader'
import { cn, fmtM } from '../lib/utils'
import { Target, ChevronDown, ChevronRight, AlertTriangle, ArrowRight, TrendingUp, Info, BookOpen } from 'lucide-react'
import { Skeleton } from '../components/ui/Skeleton'
import { useCompanyId } from '../context/CompanyContext'
import { apiClient } from '../lib/apiClient'
import { usePageTitle } from '../hooks/usePageTitle'
import { getDrsCategoryStyle } from '../lib/drsCategoryColors'

const MITIGATION_TARGETS = {
  revenue_quality: {
    recurring_rate:  'Shift revenue mix toward recurring contracts and retainer agreements to reduce single-project dependency.',
    concentration:   'Expand customer base to reduce HHI; target no single customer exceeding 15% of revenue.',
    durability:      'Convert month-to-month engagements to multi-year contracts with renewal clauses.',
  },
  financial_integrity: {
    margin_stability: 'Reduce EBITDA margin variance by tightening cost controls and pricing discipline.',
    working_capital:  'Normalize working capital cycles; address AR days and payables timing.',
    recast_confidence:'Document and defend all EBITDA addbacks with third-party support; remove non-defensible items.',
  },
  operational_independence: {
    owner_dependency:  'Create documented SOPs, delegate key client relationships, and build a second layer of management.',
    process_maturity:  'Formalize repeatable processes and hand-offs to reduce reliance on institutional knowledge.',
    system_dependency: 'Migrate critical workflows off owner-managed tools; ensure continuity during ownership transition.',
  },
  customer_risk: {
    concentration_risk: 'Diversify revenue across more customer accounts; reduce top-customer revenue concentration below 20%.',
    churn_risk:         'Implement structured QBRs, customer health scoring, and proactive renewal management.',
    contract_risk:      'Move customers onto formal MSAs with auto-renewal, termination penalties, and service level commitments.',
  },
  management_team: {
    depth:       'Build out the leadership bench — hire or develop a COO, CFO, or VP of Sales to reduce key-person risk.',
    retention:   'Implement equity or long-term incentive plans to retain key managers through transition.',
    succession:  'Document succession plans and cross-train across all critical roles.',
  },
  growth_drivers: {
    pipeline:    'Build a formal sales pipeline with CRM tracking, stage definitions, and conversion metrics.',
    market_share:'Identify and quantify addressable expansion markets; develop a go-to-market plan for top-priority segments.',
    product_mix: 'Broaden service or product offerings to reduce dependency on a single revenue line.',
  },
}

// ── Score bar for visual score comparison ──────────────────────────────────
function ScoreBar({ current, target, label }) {
  const color = current >= 70 ? 'bg-emerald-500' : current >= 55 ? 'bg-amber-500' : 'bg-red-500'
  const textColor = current >= 70 ? 'text-emerald-400' : current >= 55 ? 'text-amber-400' : 'text-red-400'
  return (
    <div className="space-y-1">
      {label && <p className="text-[10px] text-muted-foreground">{label}</p>}
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-2 rounded-full transition-all', color)} style={{ width: `${Math.min(current, 100)}%` }} />
        <div
          className="absolute top-0 w-0.5 h-2 bg-emerald-400/60 rounded-full"
          style={{ left: `${target}%` }}
          title={`Target: ${target}`}
        />
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <span className={cn('font-bold', textColor)}>{current.toFixed(0)}</span>
        <span className="text-muted-foreground/50">target {target}</span>
      </div>
    </div>
  )
}

// ── Detailed gap card ─────────────────────────────────────────────────────
function GapCategoryCard({ d, rank, totalGap }) {
  const [open, setOpen] = useState(false)
  const cat = getDrsCategoryStyle(d.category)
  const weakSubs = d.weak_sub_scores ?? []
  const mitigationMap = MITIGATION_TARGETS[d.category] ?? {}
  const pctOfGap = totalGap > 0 ? (d.ev_uplift / totalGap * 100) : 0

  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden transition-all', cat.border)}>
      {/* Header — always visible */}
      <button className="w-full text-left p-4" onClick={() => setOpen(!open)}>
        <div className="flex items-start gap-3">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5', cat.bg, cat.text)}>
            {rank}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="text-sm font-semibold text-card-foreground">{d.label}</span>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-emerald-400">+{fmtM(d.ev_uplift)}</p>
                <p className="text-[10px] text-muted-foreground">{pctOfGap.toFixed(0)}% of gap</p>
              </div>
            </div>

            {/* Score bar + EV contribution bar */}
            <div className="grid grid-cols-2 gap-4">
              <ScoreBar current={d.current_score} target={d.target_score} label={`Score: ${d.current_score.toFixed(0)} → ${d.target_score} (${d.score_gap.toFixed(0)}-pt gap)`} />
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Share of total value gap</p>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-2 bg-emerald-500/60 rounded-full" style={{ width: `${Math.min(pctOfGap, 100)}%` }} />
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-emerald-400 font-bold">+{fmtM(d.ev_uplift)}</span>
                  <span className="text-muted-foreground/50">{d.timeline}</span>
                </div>
              </div>
            </div>

            {/* Top weak sub-scores — always visible preview */}
            {weakSubs.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {weakSubs.slice(0, 4).map(sub => (
                  <span key={sub.key} className={cn(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded border',
                    sub.score < 50 ? 'border-red-500/20 bg-red-500/5 text-red-400' :
                    sub.score < 65 ? 'border-amber-500/20 bg-amber-500/5 text-amber-400' :
                    'border-border bg-muted/30 text-muted-foreground',
                  )}>
                    {sub.label}: {sub.score.toFixed(0)}
                  </span>
                ))}
                {weakSubs.length > 4 && (
                  <span className="text-[10px] text-muted-foreground/50">+{weakSubs.length - 4} more</span>
                )}
              </div>
            )}
          </div>
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />}
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-border">
          {/* Sub-score breakdown */}
          {weakSubs.length > 0 && (
            <div className="px-4 py-4 space-y-3">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Sub-Metrics Below Target — What to Fix</p>
              <div className="space-y-3">
                {weakSubs.map(sub => (
                  <div key={sub.key} className="rounded-lg border border-border/50 bg-secondary/20 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">{sub.label}</span>
                      <span className={cn('text-xs font-bold',
                        sub.score < 50 ? 'text-red-400' : sub.score < 65 ? 'text-amber-400' : 'text-muted-foreground')}>
                        {sub.score.toFixed(0)}/100
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={cn('h-1.5 rounded-full',
                        sub.score < 50 ? 'bg-red-500' : sub.score < 65 ? 'bg-amber-500' : 'bg-muted-foreground/40')}
                        style={{ width: `${sub.score}%` }}
                      />
                    </div>
                    {mitigationMap[sub.key] && (
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        <span className="font-medium text-foreground/80">Action: </span>{mitigationMap[sub.key]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Methodology — collapsed into a compact disclosure */}
          {d.methodology && (
            <div className="px-4 pb-4">
              <details className="rounded-lg border border-border/40 bg-muted/10">
                <summary className="px-3 py-2 text-[11px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-1">
                  <Info className="w-3 h-3" /> How this uplift is calculated
                </summary>
                <div className="px-3 pb-3 text-[10px] text-muted-foreground/70 space-y-1">
                  <p>{d.methodology.summary}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1">
                    <span>EBITDA used: <span className="text-foreground/60 font-mono">{fmtM(d.methodology.ebitda_ttm_used)}</span></span>
                    <span>Category weight: <span className="text-foreground/60 font-mono">{d.methodology.category_weight_in_drs}%</span></span>
                    <span>DRS before: <span className="text-foreground/60 font-mono">{d.methodology.drs_before}</span></span>
                    <span>DRS after: <span className="text-foreground/60 font-mono">{d.methodology.drs_after_category_at_target}</span></span>
                    <span>Multiple before: <span className="text-foreground/60 font-mono">{d.methodology.multiple_mid_before}×</span></span>
                    <span>Multiple after: <span className="text-foreground/60 font-mono">{d.methodology.multiple_mid_after}×</span></span>
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ValueGap() {
  usePageTitle('Value Gap Analysis')
  const companyId = useCompanyId()
  const companyReady = companyId != null && companyId > 0

  const liveQuery = useQuery({
    queryKey: ['analytics-scores', companyId],
    queryFn: () => apiClient.get(`/api/analytics/scores/${companyId}`),
    enabled: companyReady,
  })
  const gapQuery = useQuery({
    queryKey: ['analytics-value-gap', companyId],
    queryFn: () => apiClient.get(`/api/analytics/value-gap/${companyId}`),
    enabled: companyReady,
  })
  const triggeredQuery = useQuery({
    queryKey: ['library-triggered', companyId],
    queryFn: () => apiClient.get(`/api/analytics/library-triggered/${companyId}`),
    enabled: companyReady,
    staleTime: 60_000,
  })

  const liveData = liveQuery.data ?? null
  const gapData = gapQuery.data ?? null
  const loading = liveQuery.isPending || gapQuery.isPending
  const pageError =
    liveQuery.isError ? liveQuery.error?.message
      : gapQuery.isError ? gapQuery.error?.message
        : null

  if (!companyReady) {
    return (
      <div className="space-y-5 max-w-[1400px]">
        <SectionHeader
          title="Value Gap Analysis"
          subtitle="The difference between what the business is worth today and what it could be worth with targeted improvements"
        />
        <p className="text-sm text-muted-foreground">
          Select or create a client in the header to load value gap data.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-5 max-w-[1400px]">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <Skeleton className="h-2 w-24" /><Skeleton className="h-8 w-28" /><Skeleton className="h-2 w-20" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (pageError || liveData == null || gapData == null) {
    return (
      <div className="space-y-5 max-w-[1400px]">
        <SectionHeader
          title="Value Gap Analysis"
          subtitle="The difference between what the business is worth today and what it could be worth with targeted improvements"
        />
        <div
          className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-6 text-center text-sm text-red-400 flex flex-col items-center gap-3"
          role="alert"
        >
          <AlertTriangle className="w-8 h-8 opacity-80" />
          <p>{pageError || 'Value gap data could not be loaded.'}</p>
          <button
            type="button"
            onClick={() => {
              liveQuery.refetch()
              gapQuery.refetch()
            }}
            className="text-xs font-semibold px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/50"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const ev = liveData?.enterprise_value
  const currentEV = ev?.midpoint ?? 0
  const floorEV = ev?.floor ?? 0
  const ceilingEV = gapData?.potential_ev_midpoint ?? ev?.ceiling ?? 0
  const valueGap = Math.max(0, ceilingEV - currentEV)
  const ebitda = ev?.ebitda_base ?? 0
  const ceilingMultiple = ceilingEV > 0 && ebitda > 0 ? (ceilingEV / ebitda).toFixed(1) : '—'
  const progressPct = ceilingEV > floorEV ? Math.round((currentEV - floorEV) / (ceilingEV - floorEV) * 100) : 50

  const rawUpliftSum = gapData?.gaps?.reduce((s, g) => s + g.ev_uplift, 0) ?? 0
  const gapTotal     = gapData?.total_value_gap ?? rawUpliftSum
  const upliftScale  = rawUpliftSum > 0 ? gapTotal / rawUpliftSum : 1

  const drivers = (gapData?.gaps?.length
    ? gapData.gaps.map(g => ({
        label:           g.label,
        current_score:   g.current_score,
        target_score:    g.target_score,
        score_gap:       g.score_gap,
        ev_uplift:       Math.round(g.ev_uplift * upliftScale),
        methodology:     g.methodology,
        timeline:        g.priority <= 1 ? '18–24mo' : g.priority <= 3 ? '6–12mo' : '3–6mo',
        severity:        g.priority === 1 ? 'critical' : g.priority <= 2 ? 'high' : 'medium',
        category:        g.category,
        category_weight: g.methodology?.category_weight_in_drs ?? 0,
        weak_sub_scores: g.weak_sub_scores ?? [],
      }))
    : [])

  // Group drivers by category for the waterfall
  const totalDriverUplift = drivers.reduce((s, d) => s + d.ev_uplift, 0)

  return (
    <div className="space-y-6 max-w-[1400px]">
      <SectionHeader
        title="Value Gap Analysis"
        subtitle="The difference between what the business is worth today and what it could be worth with targeted improvements"
        action={
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
            <Target className="w-3 h-3" />+{fmtM(valueGap)} opportunity
          </span>
        }
      />

      {/* ── Top 3 EV cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 space-y-3">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Current Enterprise Value</p>
          <p className="text-3xl font-bold text-blue-400">{fmtM(currentEV)}</p>
          <div className="space-y-1.5 text-xs border-t border-border pt-3">
            <div className="flex justify-between"><span className="text-muted-foreground">EBITDA (TTM)</span><span className="font-bold text-card-foreground">{fmtM(ebitda)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Implied Multiple</span><span className="font-bold text-blue-400">{ev?.multiple_used ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">DRS Tier</span><span className="text-muted-foreground text-[11px]">{(liveData?.drs?.tier ?? '').replace(/_/g, ' ')}</span></div>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 flex flex-col items-center justify-center gap-3">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Value Gap</p>
          <p className="text-4xl font-bold text-emerald-400">+{fmtM(valueGap)}</p>
          <p className="text-xs text-muted-foreground text-center">realizable through targeted operational improvements</p>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-blue-400">{fmtM(currentEV)}</span>
            <span className="text-muted-foreground">→</span>
            <span className="text-emerald-400 font-bold">{fmtM(ceilingEV)}</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full mt-1">
            <div className="h-1.5 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-3">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Potential Enterprise Value</p>
          <p className="text-3xl font-bold text-emerald-400">{fmtM(ceilingEV)}</p>
          <div className="space-y-1.5 text-xs border-t border-border pt-3">
            <div className="flex justify-between"><span className="text-muted-foreground">EBITDA (base)</span><span className="font-bold text-card-foreground">{fmtM(ebitda)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Ceiling Multiple</span><span className="font-bold text-emerald-400">{ceilingMultiple}×</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">All initiatives complete</span><span className="text-muted-foreground text-[11px]">18–24 months</span></div>
          </div>
        </div>
      </div>

      {/* ── EV Bridge — horizontal waterfall ───────────────────────────── */}
      {drivers.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-card-foreground">Value Creation Bridge</h3>
            <span className="text-[10px] text-muted-foreground ml-auto">Each bar shows EV uplift if that category alone were improved to target</span>
          </div>

          {/* Stacked horizontal bar */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 h-10 rounded-lg overflow-hidden">
              <div
                className="h-full bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white rounded-l-lg"
                style={{ width: `${currentEV / (currentEV + totalDriverUplift) * 100}%`, minWidth: 60 }}
                title={`Current EV: ${fmtM(currentEV)}`}
              >
                {fmtM(currentEV)}
              </div>
              {drivers.map((d, i) => {
                const pct = d.ev_uplift / (currentEV + totalDriverUplift) * 100
                const cat = getDrsCategoryStyle(d.category)
                const barBg = cat.barSolid
                return (
                  <div
                    key={d.category}
                    className={cn('h-full flex items-center justify-center text-[9px] font-bold text-white/90 transition-all hover:brightness-110', barBg, i === drivers.length - 1 && 'rounded-r-lg')}
                    style={{ width: `${Math.max(pct, 2.5)}%` }}
                    title={`${d.label}: +${fmtM(d.ev_uplift)}`}
                  >
                    {pct > 6 ? `+${fmtM(d.ev_uplift)}` : ''}
                  </div>
                )
              })}
            </div>
            {/* Legend row */}
            <div className="flex items-center gap-3 flex-wrap text-[10px] pt-1">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />
                <span className="text-muted-foreground">Current EV</span>
              </span>
              {drivers.map(d => {
                const cat = getDrsCategoryStyle(d.category)
                return (
                  <span key={d.category} className="flex items-center gap-1">
                    <span className={cn('w-2.5 h-2.5 rounded-sm inline-block', cat.barSolid)} />
                    <span className="text-muted-foreground">{d.label}</span>
                    <span className={cn('font-bold', cat.text)}>+{fmtM(d.ev_uplift)}</span>
                  </span>
                )
              })}
              <span className="ml-auto flex items-center gap-1 font-semibold text-emerald-400">
                <ArrowRight className="w-3 h-3" /> {fmtM(ceilingEV)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Gap Breakdown by Category ──────────────────────────────────── */}
      {drivers.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Gap Breakdown by Category</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {drivers.length} categories below the target score of {drivers[0]?.target_score ?? 80} — ranked by EV impact
              </p>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Critical</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />High</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground/40" />Medium</span>
            </div>
          </div>

          {/* Category gap cards */}
          <div className="space-y-3">
            {drivers.map((d, i) => (
              <GapCategoryCard key={d.category} d={d} rank={i + 1} totalGap={totalDriverUplift} />
            ))}
          </div>
        </div>
      )}

      {drivers.length === 0 && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center space-y-2">
          <TrendingUp className="w-8 h-8 text-emerald-400 mx-auto" />
          <p className="text-sm font-semibold text-emerald-400">All categories at or above target</p>
          <p className="text-xs text-muted-foreground">No value-gap drivers identified — the business scores at investment grade across all DRS dimensions.</p>
        </div>
      )}

      {/* ── Advisory Library Triggers ─────────────────────────────────── */}
      {(() => {
        const triggered = triggeredQuery.data?.triggered_items ?? []
        if (triggered.length === 0) return null
        const byType = {
          risk_flag:      triggered.filter(i => i.item_type === 'risk_flag'),
          buyer_question: triggered.filter(i => i.item_type === 'buyer_question'),
          initiative:     triggered.filter(i => i.item_type === 'initiative'),
        }
        const typeLabels = { risk_flag: 'Risk Flags', buyer_question: 'Buyer Questions', initiative: 'Initiatives' }
        const typeColors = {
          risk_flag:      { bg: 'bg-red-500/5',    text: 'text-red-400',    border: 'border-red-500/20'    },
          buyer_question: { bg: 'bg-amber-500/5',  text: 'text-amber-400',  border: 'border-amber-500/20'  },
          initiative:     { bg: 'bg-blue-500/5',   text: 'text-blue-400',   border: 'border-blue-500/20'   },
        }
        const severityColor = { critical: 'text-red-400', high: 'text-amber-400', medium: 'text-blue-400', low: 'text-muted-foreground' }
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <BookOpen className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-foreground">Advisory Library Alerts</h3>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400">
                {triggered.length} triggered
              </span>
              <span className="text-[10px] text-muted-foreground">
                Library items surfaced because category scores fall below their trigger threshold
              </span>
            </div>
            {Object.entries(byType).map(([type, items]) => {
              if (items.length === 0) return null
              const tc = typeColors[type]
              return (
                <div key={type} className={cn('rounded-xl border p-4 space-y-3', tc.border, tc.bg)}>
                  <p className={cn('text-[11px] font-bold uppercase tracking-wider', tc.text)}>
                    {typeLabels[type]} ({items.length})
                  </p>
                  <div className="space-y-2">
                    {items.map(item => (
                      <div key={item.id} className="rounded-lg border border-border/50 bg-card/60 px-3 py-2.5 space-y-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs font-semibold text-foreground leading-snug">{item.title}</p>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className={cn('text-[10px] font-bold capitalize', severityColor[item.severity] ?? 'text-muted-foreground')}>
                              {item.severity}
                            </span>
                            <span className="text-[10px] text-muted-foreground/40">|</span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {item.category_score?.toFixed(0)} / {item.score_trigger}
                            </span>
                          </div>
                        </div>
                        {item.content && (
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{item.content}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground/50 capitalize flex items-center gap-1.5">
                          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', getDrsCategoryStyle(item.category).dot)} />
                          {(item.category ?? '').replace(/_/g, ' ')}
                          {item.score_gap != null && ` · ${item.score_gap.toFixed(0)}-pt gap`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* ── Footnote ───────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border/40 bg-muted/10 px-4 py-3 text-[10px] text-muted-foreground/60 space-y-1">
        <p>
          <span className="font-semibold text-muted-foreground">Note:</span> Uplift estimates are illustrative.
          Each category's EV impact is modeled by simulating the DRS score change if that category alone
          were raised to the target, then interpolating the resulting EBITDA multiple from the internal anchor curve.
          Actual deal value depends on buyer sentiment, market conditions, and execution quality.
        </p>
        <p>
          Category uplifts are not additive — resolving all gaps simultaneously produces the "Potential EV" figure shown above,
          which may differ from the sum of individual uplifts due to non-linear multiple expansion.
        </p>
      </div>
    </div>
  )
}
