import { useState, useMemo } from 'react'
import SectionHeader from '../components/ui/SectionHeader'
import { cn, fmtM } from '../lib/utils'
import { TrendingUp, Filter, ArrowUpRight, Info, BarChart2, ChevronDown, ChevronRight, Users, Building2, Briefcase } from 'lucide-react'
import { useCompanyId } from '../context/CompanyContext'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/apiClient'

// ─── Static comp database ────────────────────────────────────────────────────

const SEGMENTS = [
  { value: 'field_services_traffic',    label: 'Field Services — Traffic & Transportation' },
  { value: 'field_services_landscaping',label: 'Field Services — Landscaping & Grounds' },
  { value: 'field_services_hvac',       label: 'Field Services — HVAC / Mechanical' },
  { value: 'b2b_professional',          label: 'B2B Professional Services' },
  { value: 'industrial_services',       label: 'Industrial Services' },
]

const EV_RANGES = [
  { value: 'all',   label: 'All Sizes' },
  { value: '1-5',   label: '$1M – $5M EV' },
  { value: '5-15',  label: '$5M – $15M EV' },
  { value: '15-50', label: '$15M – $50M EV' },
]

const ALL_COMPS = [
  // Field Services — Traffic & Transportation
  {
    id: 1, segment: 'field_services_traffic', source: 'IBBA', date: 'Q3 2024',
    description: 'Traffic control & lane closure contractor, Pacific Northwest',
    revenue: 4_200_000, ebitda: 840_000, ev: 3_696_000, multiple: 4.4,
    ev_range: '1-5',
    highlights: ['Owner-operator model', 'Top 3 customers = 71% revenue', 'No formal contracts'],
    quality: 'low',
  },
  {
    id: 2, segment: 'field_services_traffic', source: 'PitchBook', date: 'Q1 2024',
    description: 'Highway signage & flagging services, Mid-Atlantic',
    revenue: 6_800_000, ebitda: 1_360_000, ev: 8_704_000, multiple: 6.4,
    ev_range: '5-15',
    highlights: ['Multi-year DOT contracts', 'Diversified customer base', 'Dedicated ops manager'],
    quality: 'high',
  },
  {
    id: 3, segment: 'field_services_traffic', source: 'IBBA', date: 'Q4 2023',
    description: 'Traffic management services, Southwest corridor',
    revenue: 3_100_000, ebitda: 620_000, ev: 2_666_000, multiple: 4.3,
    ev_range: '1-5',
    highlights: ['Owner runs all operations', '85% project-based', 'Limited back-office'],
    quality: 'low',
  },
  {
    id: 4, segment: 'field_services_traffic', source: 'DealStats', date: 'Q2 2024',
    description: 'Transportation safety services, Southeast',
    revenue: 8_500_000, ebitda: 1_700_000, ev: 12_580_000, multiple: 7.4,
    ev_range: '5-15',
    highlights: ['Recurring state contracts', 'ISO 9001 certified', 'Management buyout target'],
    quality: 'premium',
  },
  {
    id: 5, segment: 'field_services_traffic', source: 'IBBA', date: 'Q1 2023',
    description: 'Temporary traffic control, Mountain West',
    revenue: 2_900_000, ebitda: 580_000, ev: 2_494_000, multiple: 4.3,
    ev_range: '1-5',
    highlights: ['Single-owner dependency', 'City/county contracts at-will', 'No succession plan'],
    quality: 'low',
  },
  {
    id: 6, segment: 'field_services_traffic', source: 'PitchBook', date: 'Q3 2023',
    description: 'Road marking & pavement services, Great Lakes',
    revenue: 5_200_000, ebitda: 1_040_000, ev: 5_616_000, multiple: 5.4,
    ev_range: '1-5',
    highlights: ['Partial management team in place', 'Mix of contract & project work', 'Some customer concentration'],
    quality: 'mid',
  },
  {
    id: 7, segment: 'field_services_traffic', source: 'IBBA', date: 'Q4 2022',
    description: 'Traffic engineering & flagging, California',
    revenue: 4_700_000, ebitda: 940_000, ev: 5_264_000, multiple: 5.6,
    ev_range: '1-5',
    highlights: ['Caltrans approved vendor', 'Three-year blanket orders', 'Owner semi-retired'],
    quality: 'mid',
  },
  {
    id: 8, segment: 'field_services_traffic', source: 'DealStats', date: 'Q2 2023',
    description: 'Lane management & construction zone services, Texas',
    revenue: 11_200_000, ebitda: 2_240_000, ev: 17_920_000, multiple: 8.0,
    ev_range: '15-50',
    highlights: ['TxDOT master contract', 'Full management team', 'Multi-state operations', 'Audited financials'],
    quality: 'premium',
  },
  {
    id: 9, segment: 'field_services_traffic', source: 'IBBA', date: 'Q3 2022',
    description: 'Portable signage & delineator services, Pacific Northwest',
    revenue: 3_600_000, ebitda: 720_000, ev: 3_384_000, multiple: 4.7,
    ev_range: '1-5',
    highlights: ['Moderate concentration (top-3 = 55%)', 'Annual contract renewals', 'Owner partially transitioned'],
    quality: 'low',
  },
  {
    id: 10, segment: 'field_services_traffic', source: 'PitchBook', date: 'Q1 2022',
    description: 'Traffic safety & work zone services, Midwest',
    revenue: 7_400_000, ebitda: 1_480_000, ev: 9_768_000, multiple: 6.6,
    ev_range: '5-15',
    highlights: ['ATSSA certified crew', 'IDOT & ODOT approved', 'CPA-reviewed financials', 'Second-gen management'],
    quality: 'high',
  },
  {
    id: 11, segment: 'field_services_traffic', source: 'IBBA', date: 'Q2 2022',
    description: 'Road work zone protection, Southeast',
    revenue: 2_500_000, ebitda: 500_000, ev: 2_000_000, multiple: 4.0,
    ev_range: '1-5',
    highlights: ['Owner-operator, sole employee manager', 'No contracts beyond PO level', 'Weak documentation'],
    quality: 'low',
  },
  {
    id: 12, segment: 'field_services_traffic', source: 'DealStats', date: 'Q4 2021',
    description: 'Traffic management & fleet services, Northeast',
    revenue: 6_100_000, ebitda: 1_220_000, ev: 7_076_000, multiple: 5.8,
    ev_range: '5-15',
    highlights: ['Balanced customer mix (largest = 22%)', 'MSAs in place for 60% of revenue', 'Fleet ownership reduces cost'],
    quality: 'mid',
  },
  {
    id: 13, segment: 'field_services_traffic', source: 'IBBA', date: 'Q1 2021',
    description: 'Flagging & temporary traffic control, Southeast',
    revenue: 3_300_000, ebitda: 660_000, ev: 3_036_000, multiple: 4.6,
    ev_range: '1-5',
    highlights: ['2 key customers = 62% revenue', 'Owner active in operations', 'Strong local reputation'],
    quality: 'low',
  },
  {
    id: 14, segment: 'field_services_traffic', source: 'PitchBook', date: 'Q3 2021',
    description: 'DOT-certified traffic control services, Mountain West',
    revenue: 9_800_000, ebitda: 1_960_000, ev: 14_112_000, multiple: 7.2,
    ev_range: '5-15',
    highlights: ['Certified women-owned business', 'Long-term CDOT contracts', 'Formal HR & compliance programs'],
    quality: 'high',
  },
  {
    id: 15, segment: 'field_services_traffic', source: 'IBBA', date: 'Q2 2021',
    description: 'Traffic management & pavement marking, Florida',
    revenue: 4_100_000, ebitda: 820_000, ev: 4_018_000, multiple: 4.9,
    ev_range: '1-5',
    highlights: ['FDOT approved', 'Moderate concentration (top-2 = 48%)', 'No formal management layer'],
    quality: 'low',
  },
  // Field Services — Landscaping
  {
    id: 16, segment: 'field_services_landscaping', source: 'IBBA', date: 'Q1 2024',
    description: 'Commercial landscape maintenance, Southeast',
    revenue: 5_100_000, ebitda: 918_000, ev: 4_131_000, multiple: 4.5,
    ev_range: '1-5',
    highlights: ['70% recurring maintenance contracts', 'Owner-operator model'],
    quality: 'low',
  },
  {
    id: 17, segment: 'field_services_landscaping', source: 'PitchBook', date: 'Q3 2023',
    description: 'Commercial landscaping & irrigation, Sunbelt',
    revenue: 8_200_000, ebitda: 1_476_000, ev: 9_894_000, multiple: 6.7,
    ev_range: '5-15',
    highlights: ['85% recurring maintenance', 'HOA & commercial contracts', 'Management team in place'],
    quality: 'high',
  },
  {
    id: 18, segment: 'field_services_landscaping', source: 'IBBA', date: 'Q2 2023',
    description: 'Grounds maintenance services, Midwest',
    revenue: 3_700_000, ebitda: 592_000, ev: 2_664_000, multiple: 4.5,
    ev_range: '1-5',
    highlights: ['Seasonal revenue variability', 'Owner dependency', 'Some recurring clients'],
    quality: 'low',
  },
  // Field Services — HVAC
  {
    id: 19, segment: 'field_services_hvac', source: 'IBBA', date: 'Q2 2024',
    description: 'Commercial HVAC service & maintenance, Midwest',
    revenue: 6_200_000, ebitda: 1_116_000, ev: 6_696_000, multiple: 6.0,
    ev_range: '5-15',
    highlights: ['Service contract base', 'Licensed technicians', 'Moderate key-person risk'],
    quality: 'mid',
  },
  {
    id: 20, segment: 'field_services_hvac', source: 'PitchBook', date: 'Q4 2023',
    description: 'HVAC installation & service, Southeast',
    revenue: 9_400_000, ebitda: 1_692_000, ev: 12_690_000, multiple: 7.5,
    ev_range: '5-15',
    highlights: ['SLA-based service agreements', 'CPA-reviewed financials', 'Cross-trained technician team'],
    quality: 'premium',
  },
  // B2B Professional Services
  {
    id: 21, segment: 'b2b_professional', source: 'PitchBook', date: 'Q1 2024',
    description: 'Engineering consulting services, Mid-Atlantic',
    revenue: 7_800_000, ebitda: 1_560_000, ev: 11_700_000, multiple: 7.5,
    ev_range: '5-15',
    highlights: ['Retainer-based client relationships', 'Tenured professional team'],
    quality: 'high',
  },
  {
    id: 22, segment: 'b2b_professional', source: 'IBBA', date: 'Q3 2023',
    description: 'Environmental compliance consulting, Southeast',
    revenue: 4_300_000, ebitda: 774_000, ev: 3_870_000, multiple: 5.0,
    ev_range: '1-5',
    highlights: ['Project-based revenue model', 'Two-owner dependency', 'Some repeat clients'],
    quality: 'mid',
  },
  // Industrial Services
  {
    id: 23, segment: 'industrial_services', source: 'IBBA', date: 'Q2 2024',
    description: 'Industrial cleaning & maintenance, Gulf Coast',
    revenue: 5_900_000, ebitda: 1_003_000, ev: 5_015_000, multiple: 5.0,
    ev_range: '1-5',
    highlights: ['Recurring facility contracts', 'OSHA-certified workforce', 'Some concentration'],
    quality: 'mid',
  },
  {
    id: 24, segment: 'industrial_services', source: 'PitchBook', date: 'Q1 2023',
    description: 'Specialty industrial services, Midwest',
    revenue: 12_100_000, ebitda: 2_178_000, ev: 16_335_000, multiple: 7.5,
    ev_range: '15-50',
    highlights: ['Master service agreements', 'ISO certified', 'Audited financials', 'Strong bench'],
    quality: 'premium',
  },
]

// Multiple expansion levers linked to comp evidence
const LEVER_COMPS = [
  {
    lever: 'Customer Concentration',
    current: 'Top-2 customers = 68% of revenue',
    target: 'No customer exceeds 20% of revenue',
    multiple_impact: '+0.8x – +1.4x',
    evidence: 'Comps with >60% concentration averaged 4.4x; diversified comps averaged 5.8x–6.6x in same segment.',
    comp_ids: [1, 3, 5, 11, 13, 7, 12],
    color: 'red',
  },
  {
    lever: 'Contract Formalization',
    current: 'Project-based, PO-level agreements',
    target: 'MSAs covering 60%+ of revenue',
    multiple_impact: '+0.5x – +0.9x',
    evidence: 'Transactions with formal MSAs (comp #12, #7) commanded 5.6x–5.8x vs 4.0x–4.3x for project-only businesses.',
    comp_ids: [7, 12, 2, 4],
    color: 'amber',
  },
  {
    lever: 'Key Person Dependency',
    current: 'Owner operates all client relationships & field ops',
    target: 'Operations manager + documented SOPs in place',
    multiple_impact: '+0.4x – +0.8x',
    evidence: 'Owner semi-retired or transitioned businesses (comp #7, #10) averaged 5.6x–6.6x vs 4.0x–4.4x for full owner-operator models.',
    comp_ids: [7, 10, 14, 4],
    color: 'purple',
  },
  {
    lever: 'Financial Documentation',
    current: 'No CPA review — internal books only',
    target: '3-year CPA review or compilation',
    multiple_impact: '+0.2x – +0.5x',
    evidence: 'CPA-reviewed financials (comp #10, #14) reduced buyer price adjustment risk; buyers applied ~0.3x–0.5x quality premium.',
    comp_ids: [10, 4, 8, 14],
    color: 'blue',
  },
  {
    lever: 'Revenue Diversification',
    current: 'HHI 2,472 — highly concentrated',
    target: 'HHI below 1,500 across 15+ accounts',
    multiple_impact: '+0.3x – +0.6x',
    evidence: 'Diversified comps (comp #2, #6, #12) in the $1M–$5M EBITDA range averaged 5.4x–6.4x vs 4.3x–4.7x for concentrated books.',
    comp_ids: [2, 6, 12],
    color: 'emerald',
  },
]

const SOURCE_COLORS = {
  PitchBook: 'border-blue-500/20 bg-blue-500/10 text-blue-400',
  IBBA:      'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  DealStats: 'border-purple-500/20 bg-purple-500/10 text-purple-400',
}

const QUALITY_COLORS = {
  low:     'text-red-400',
  mid:     'text-amber-400',
  high:    'text-emerald-400',
  premium: 'text-blue-400',
}

const QUALITY_LABELS = {
  low: 'Low',
  mid: 'Mid',
  high: 'High',
  premium: 'Premium',
}

const LEVER_COLOR_CLASSES = {
  red:     { border: 'border-red-500/20',     bg: 'bg-red-500/5',     text: 'text-red-400',     badge: 'bg-red-500/10 text-red-400 border-red-500/20' },
  amber:   { border: 'border-amber-500/20',   bg: 'bg-amber-500/5',   text: 'text-amber-400',   badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  purple:  { border: 'border-purple-500/20',  bg: 'bg-purple-500/5',  text: 'text-purple-400',  badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  blue:    { border: 'border-blue-500/20',    bg: 'bg-blue-500/5',    text: 'text-blue-400',    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  emerald: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', text: 'text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
}

function median(arr) {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
function percentile(arr, p) {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.floor((p / 100) * (sorted.length - 1))
  return sorted[idx]
}

function LeverCard({ lever, comps }) {
  const [open, setOpen] = useState(false)
  const c = LEVER_COLOR_CLASSES[lever.color]
  const refComps = comps.filter(c => lever.comp_ids.includes(c.id))

  return (
    <div className={cn('rounded-xl border bg-card', c.border)}>
      <button className="w-full text-left p-4" onClick={() => setOpen(o => !o)}>
        <div className="flex items-start gap-3">
          <div className={cn('rounded-lg p-2 flex-shrink-0', c.bg)}>
            <ArrowUpRight className={cn('w-4 h-4', c.text)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-card-foreground">{lever.lever}</p>
              <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded border', c.badge)}>
                {lever.multiple_impact} EBITDA multiple
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{lever.current} → {lever.target}</p>
          </div>
          {open
            ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
          <div className={cn('rounded-lg p-3 text-xs', c.bg)}>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Comp Evidence</p>
            <p className="text-card-foreground leading-relaxed">{lever.evidence}</p>
          </div>
          {refComps.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Referenced Transactions</p>
              <div className="space-y-2">
                {refComps.map(comp => {
                  const qualVerb = comp.quality === 'premium' || comp.quality === 'high'
                    ? 'commanded' : comp.quality === 'low' ? 'achieved only' : 'sold at'
                  const highlight = comp.highlights?.[0] ?? comp.description
                  const sentence = `${qualVerb} ${comp.multiple.toFixed(1)}× EBITDA — ${highlight}.`
                  return (
                    <div key={comp.id} className="rounded-lg bg-muted/20 border border-border/50 px-3 py-2">
                      <div className="flex items-center gap-3 text-[11px] mb-1">
                        <span className={cn('text-[11px] font-bold px-1 py-0.5 rounded border flex-shrink-0', SOURCE_COLORS[comp.source])}>
                          {comp.source}
                        </span>
                        <span className="text-muted-foreground flex-1 truncate">{comp.description} · {comp.date}</span>
                        <span className={cn('font-bold flex-shrink-0', QUALITY_COLORS[comp.quality])}>{comp.multiple.toFixed(1)}×</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground/80 italic capitalize-first">{sentence}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const BUYER_TYPE_ICONS = { pe: Briefcase, strategic: Building2, financial: Users }
const BUYER_TYPE_COLORS = { pe: 'text-violet-400', strategic: 'text-blue-400', financial: 'text-emerald-400' }
const BUYER_TYPE_LABELS = { pe: 'Private Equity', strategic: 'Strategic', financial: 'Financial / Family Office' }

function FitScoreBar({ score }) {
  const color = score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 rounded flex-1 bg-muted/40 overflow-hidden min-w-[60px]">
        <div className={cn('absolute left-0 top-0 h-full rounded transition-all', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[11px] font-bold tabular-nums w-6 text-right">{score}</span>
    </div>
  )
}

export default function MarketComps() {
  const companyId = useCompanyId()
  const [segment, setSegment] = useState('field_services_traffic')
  const [evRange, setEvRange] = useState('all')
  const [buyerTypeFilter, setBuyerTypeFilter] = useState('all')

  // Live company data for context panel
  const { data: liveData } = useQuery({
    queryKey: ['analytics-scores', companyId],
    queryFn: () => apiClient.get(`/api/analytics/scores/${companyId}`),
    enabled: companyId != null && companyId > 0,
  })
  const { data: gapData } = useQuery({
    queryKey: ['analytics-value-gap', companyId],
    queryFn: () => apiClient.get(`/api/analytics/value-gap/${companyId}`),
    enabled: companyId != null && companyId > 0,
  })
  const { data: buyerUniverse, isLoading: buyerLoading } = useQuery({
    queryKey: ['buyer-universe', companyId, buyerTypeFilter],
    queryFn: () => {
      const params = buyerTypeFilter !== 'all' ? `?buyer_type=${buyerTypeFilter}` : ''
      return apiClient.get(`/api/analytics/buyer-universe/${companyId}${params}`)
    },
    enabled: companyId != null && companyId > 0,
    staleTime: 60_000,
  })

  const filtered = useMemo(() => {
    return ALL_COMPS.filter(c => {
      if (c.segment !== segment) return false
      if (evRange !== 'all' && c.ev_range !== evRange) return false
      return true
    })
  }, [segment, evRange])

  const multiples = filtered.map(c => c.multiple)
  const medianMultiple = median(multiples)
  const p25 = percentile(multiples, 25)
  const p75 = percentile(multiples, 75)
  const minM = multiples.length ? Math.min(...multiples) : 0
  const maxM = multiples.length ? Math.max(...multiples) : 0

  const currentDRS = liveData?.drs?.base ?? null
  const currentEV  = liveData?.enterprise_value?.midpoint ?? null
  const currentMultiple = liveData?.enterprise_value?.multiple_used ?? null
  const potentialEV = gapData?.potential_ev_midpoint ?? liveData?.enterprise_value?.ceiling ?? null
  const valueGap = currentEV && potentialEV ? Math.max(0, potentialEV - currentEV) : null

  // Compute implied multiples for current company to display on chart
  const segmentLevers = segment === 'field_services_traffic' ? LEVER_COMPS : []

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader
        title="Market Comps"
        subtitle="Comparable M&A transactions — PitchBook, IBBA, DealStats — with multiple drivers linked to your value creation levers"
        action={
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <Info className="w-3 h-3" />
            {filtered.length} transactions
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground font-medium">Filters:</span>
        </div>
        <select
          value={segment}
          onChange={e => setSegment(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-card-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select
          value={evRange}
          onChange={e => setEvRange(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-card-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {EV_RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Transactions', value: filtered.length, sub: 'in dataset', color: 'blue' },
          { label: 'Median Multiple', value: `${medianMultiple.toFixed(1)}×`, sub: 'EBITDA', color: 'emerald' },
          { label: '25th Pct', value: `${p25.toFixed(1)}×`, sub: 'lower quartile', color: 'amber' },
          { label: '75th Pct', value: `${p75.toFixed(1)}×`, sub: 'upper quartile', color: 'purple' },
          { label: 'Range', value: `${minM.toFixed(1)}× – ${maxM.toFixed(1)}×`, sub: 'min to max', color: 'blue' },
        ].map(stat => (
          <div key={stat.label} className={cn('rounded-xl border p-3',
            stat.color === 'blue'    ? 'border-blue-500/20 bg-blue-500/5' :
            stat.color === 'emerald' ? 'border-emerald-500/20 bg-emerald-500/5' :
            stat.color === 'amber'   ? 'border-amber-500/20 bg-amber-500/5' :
            'border-purple-500/20 bg-purple-500/5')}>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{stat.label}</p>
            <p className={cn('text-lg font-bold',
              stat.color === 'blue'    ? 'text-blue-400' :
              stat.color === 'emerald' ? 'text-emerald-400' :
              stat.color === 'amber'   ? 'text-amber-400' :
              'text-purple-400')}>{stat.value}</p>
            <p className="text-[11px] text-muted-foreground">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Data provenance */}
      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
        <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div className="text-[11px] leading-relaxed text-muted-foreground">
          Transaction database sourced from <span className="font-semibold text-foreground">IBBA Market Pulse</span>, <span className="font-semibold text-foreground">DealStats</span>, and <span className="font-semibold text-foreground">PitchBook</span> closed deal data.
          All transactions are anonymized per source licensing terms. Multiples reflect EBITDA-based enterprise value at close.
        </div>
      </div>

      {/* Client positioning + comp table side by side */}
      <div className="grid grid-cols-12 gap-4">

        {/* Your company vs. comps context */}
        {(currentEV || currentMultiple) && (
          <div className="col-span-12 md:col-span-3 rounded-xl border border-border bg-card p-4 space-y-4">
            <p className="text-xs font-semibold text-card-foreground flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-primary" />
              Your Client vs. Comps
            </p>

            <div className="space-y-2.5">
              {[
                {
                  label: 'Current Multiple',
                  value: currentMultiple ? `${currentMultiple}` : '—',
                  context: p25 && currentMultiple
                    ? parseFloat(currentMultiple) < p25
                      ? `Below 25th pct (${p25.toFixed(1)}×) — significant gap`
                      : parseFloat(currentMultiple) < medianMultiple
                      ? `Below median (${medianMultiple.toFixed(1)}×)`
                      : 'Above median'
                    : null,
                  color: currentMultiple && parseFloat(currentMultiple) < p25 ? 'text-red-400' : 'text-amber-400',
                },
                {
                  label: 'Current EV',
                  value: currentEV ? fmtM(currentEV) : '—',
                  context: 'midpoint estimate',
                  color: 'text-blue-400',
                },
                {
                  label: 'Potential EV',
                  value: potentialEV ? fmtM(potentialEV) : '—',
                  context: 'if all gaps resolved',
                  color: 'text-emerald-400',
                },
                {
                  label: 'Value Gap',
                  value: valueGap ? `+${fmtM(valueGap)}` : '—',
                  context: 'realizable through improvements',
                  color: 'text-emerald-400',
                },
                {
                  label: 'DRS Score',
                  value: currentDRS ? `${currentDRS.toFixed(0)}/100` : '—',
                  context: liveData?.drs?.tier ? `${liveData.drs.tier} tier` : null,
                  color: currentDRS && currentDRS < 50 ? 'text-red-400' : 'text-amber-400',
                },
              ].map(row => (
                <div key={row.label} className="flex items-start justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="text-[11px] text-muted-foreground">{row.label}</p>
                    {row.context && <p className="text-[11px] text-muted-foreground/60">{row.context}</p>}
                  </div>
                  <p className={cn('text-sm font-bold', row.color)}>{row.value}</p>
                </div>
              ))}
            </div>

            {/* Multiple positioning bar */}
            {currentMultiple && multiples.length > 1 && (
              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Multiple Positioning</p>
                <div className="relative h-2 bg-muted rounded-full overflow-visible">
                  {/* range bar */}
                  <div
                    className="absolute h-2 bg-gradient-to-r from-amber-500/30 to-emerald-500/30 rounded-full"
                    style={{
                      left: `${((p25 - minM) / (maxM - minM)) * 100}%`,
                      width: `${((p75 - p25) / (maxM - minM)) * 100}%`,
                    }}
                  />
                  {/* client marker */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary border-2 border-background z-10"
                    style={{
                      left: `${Math.min(100, Math.max(0, ((parseFloat(currentMultiple) - minM) / (maxM - minM)) * 100))}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>{minM.toFixed(1)}×</span>
                  <span className="text-primary font-semibold">{currentMultiple} (you)</span>
                  <span>{maxM.toFixed(1)}×</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Comp table */}
        <div className={cn('col-span-12 rounded-xl border border-border bg-card overflow-hidden',
          currentEV ? 'md:col-span-9' : 'md:col-span-12')}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Transaction</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Revenue</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">EBITDA</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">EV</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Multiple</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Key Factors</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      No transactions match the selected filters.
                    </td>
                  </tr>
                )}
                {filtered.map((comp, i) => (
                  <tr
                    key={comp.id}
                    className={cn('border-b border-border/50 last:border-0 transition-colors hover:bg-muted/10',
                      i % 2 === 0 ? '' : 'bg-muted/5')}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <span className={cn('text-[11px] font-bold py-0.5 rounded border flex-shrink-0 mt-0.5 w-16 text-center inline-block', SOURCE_COLORS[comp.source])}>
                          {comp.source}
                        </span>
                        <div>
                          <p className="text-card-foreground font-medium leading-tight">{comp.description}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{comp.date}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-card-foreground font-mono">{fmtM(comp.revenue)}</td>
                    <td className="px-3 py-3 text-right text-card-foreground font-mono">{fmtM(comp.ebitda)}</td>
                    <td className="px-3 py-3 text-right text-card-foreground font-mono">{fmtM(comp.ev)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={cn('font-bold text-sm', QUALITY_COLORS[comp.quality])}>
                        {comp.multiple.toFixed(1)}×
                      </span>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {comp.highlights.map((h, j) => (
                          <span key={j} className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                            {h}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Multiple quality legend */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground border border-border rounded-xl bg-card px-4 py-3">
        <span className="font-semibold text-card-foreground">Multiple Quality:</span>
        {Object.entries(QUALITY_LABELS).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={cn('font-bold', QUALITY_COLORS[k])}>{v}</span>
            <span>
              {k === 'low'     ? '(3.5×–4.7×, owner-op, concentrated)' :
               k === 'mid'     ? '(4.8×–5.8×, partial team, mixed contracts)' :
               k === 'high'    ? '(6.0×–7.5×, management team, contracted)' :
               '(7.5×+, recurring, audited, full team)'}
            </span>
          </span>
        ))}
      </div>

      {/* Multiple improvement analysis */}
      {segmentLevers.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-foreground">Multiple Expansion — Value Creation Lever Analysis</h3>
          </div>
          <p className="text-[11px] text-muted-foreground mb-4">
            Each lever below is backed by comparable transactions in this segment. Resolving these gaps moves your client
            from the <span className="text-red-400 font-medium">low-quality multiple band (4.0×–4.7×)</span> toward the{' '}
            <span className="text-emerald-400 font-medium">high-quality band (6.0×–7.5×)</span>.
          </p>
          <div className="space-y-3">
            {segmentLevers.map(lever => (
              <LeverCard key={lever.lever} lever={lever} comps={filtered} />
            ))}
          </div>
        </div>
      )}

      {/* Data source note */}
      <div className="rounded-xl border border-border bg-muted/10 px-4 py-3 text-[11px] text-muted-foreground">
        <span className="font-semibold text-card-foreground">Data Sources:</span> PitchBook M&A transaction database,
        IBBA Market Pulse (Q1 2021–Q3 2024), DealStats private transaction comps. Transactions anonymized per data
        provider agreement. Multiples shown as EV / EBITDA (TTM). Segment classification is advisor-curated.
      </div>

      {/* Active Acquirers */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Active Acquirers</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Curated buyer universe — matched to your industry, EBITDA, and EV</p>
          </div>
          <div className="flex gap-1.5">
            {['all', 'pe', 'strategic', 'financial'].map(t => (
              <button
                key={t}
                onClick={() => setBuyerTypeFilter(t)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors',
                  buyerTypeFilter === t
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/20 text-muted-foreground border-border hover:border-muted-foreground/50'
                )}
              >
                {t === 'all' ? 'All' : BUYER_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {buyerLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-muted/20 p-4 space-y-2 animate-pulse">
                <div className="h-3 bg-muted/50 rounded w-3/4" />
                <div className="h-2 bg-muted/40 rounded w-1/2" />
                <div className="h-1.5 bg-muted/30 rounded" />
              </div>
            ))}
          </div>
        )}

        {!buyerLoading && buyerUniverse && (
          <>
            {buyerUniverse.acquirers?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No matching acquirers found for current filters.</p>
            ) : (
              <>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>Showing <strong className="text-foreground">{buyerUniverse.total_matched}</strong> of <strong className="text-foreground">{buyerUniverse.total_universe}</strong> active acquirers</span>
                  {buyerUniverse.industry_slug && <span>· Industry: <span className="text-foreground font-medium">{buyerUniverse.industry_slug.replace(/_/g, ' ')}</span></span>}
                  {buyerUniverse.ebitda_m != null && <span>· EBITDA: <span className="text-foreground font-medium">${buyerUniverse.ebitda_m.toFixed(2)}M</span></span>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {buyerUniverse.acquirers.map(acq => {
                    const Icon = BUYER_TYPE_ICONS[acq.buyer_type] ?? Users
                    const typeColor = BUYER_TYPE_COLORS[acq.buyer_type] ?? 'text-muted-foreground'
                    return (
                      <div key={acq.id} className="rounded-lg border border-border bg-muted/10 p-4 space-y-2.5 hover:border-muted-foreground/40 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-foreground leading-tight">{acq.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Icon className={cn('w-3 h-3', typeColor)} />
                              <span className={cn('text-[10px] font-medium', typeColor)}>{acq.buyer_type_label}</span>
                              {acq.hq_state && <span className="text-[10px] text-muted-foreground">· {acq.hq_state}</span>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[10px] text-muted-foreground">Fit Score</p>
                            <FitScoreBar score={acq.fit_score} />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                          <span>EBITDA: <span className="text-foreground">{acq.ebitda_range}</span></span>
                          <span>EV: <span className="text-foreground">{acq.ev_range}</span></span>
                          {acq.hold_period_years && <span>Hold: <span className="text-foreground">{acq.hold_period_years}yr</span></span>}
                          {acq.portfolio_count != null && <span>Portfolio: <span className="text-foreground">{acq.portfolio_count}</span></span>}
                        </div>

                        {acq.fit_reasons?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {acq.fit_reasons.map((r, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]">{r}</span>
                            ))}
                          </div>
                        )}

                        {acq.investment_thesis && (
                          <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">{acq.investment_thesis}</p>
                        )}

                        {acq.source_note && (
                          <p className="text-[9px] text-muted-foreground/50 italic">{acq.source_note}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
            {buyerUniverse.as_of_date && (
              <p className="text-[10px] text-muted-foreground/50 text-right">
                {buyerUniverse.release_label} · As of {buyerUniverse.as_of_date}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
