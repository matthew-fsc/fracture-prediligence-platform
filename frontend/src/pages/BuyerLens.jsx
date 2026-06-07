import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AlertCircle, AlertTriangle, Info, FileText, ChevronDown, ChevronRight, ExternalLink, Sparkles, RefreshCw } from 'lucide-react'
import SectionHeader from '../components/ui/SectionHeader'
import { cn } from '../lib/utils'
import { Skeleton } from '../components/ui/Skeleton'
import { useCompanyId } from '../context/CompanyContext'
import { apiClient } from '../lib/apiClient'
import { withCompanyQuery, resolvePath } from '../lib/navLinks'
import { toast } from '../lib/notify'
import { drsCategoryBadgeClass } from '../lib/drsCategoryColors'

const CATEGORY_LABELS = {
  revenue_quality:          'Revenue Quality',
  financial_integrity:      'Financial Integrity',
  operational_independence: 'Operational Independence',
  customer_risk:            'Customer Risk',
  management_team:          'Management & Team',
  growth_drivers:           'Growth Drivers',
}

const CATEGORIES = ['all', ...Object.keys(CATEGORY_LABELS)]
const SEVERITIES = ['all', 'CRITICAL', 'HIGH', 'MEDIUM']
const BUYER_FILTERS = [
  { value: 'all', label: 'All buyer types' },
  { value: 'preferred', label: 'Match engagement profile' },
  { value: 'PE', label: 'PE only' },
  { value: 'Strategic', label: 'Strategic only' },
  { value: 'Financial', label: 'Financial only' },
]

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'answered', label: 'Answered' },
  { value: 'mitigated', label: 'Mitigated' },
  { value: 'waived', label: 'Waived' },
]

/** API may omit tracking row — treat as open */
function trackingStatusOf(q) {
  return q.tracking_status && q.tracking_status !== '' ? q.tracking_status : 'open'
}

const TRACKING_STATUS_KEYS = ['all', 'open', 'in_progress', 'answered', 'mitigated', 'waived']

function SeverityIcon({ severity }) {
  if (severity === 'CRITICAL') return <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
  if (severity === 'HIGH')     return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
  if (severity === 'MEDIUM')   return <Info className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
  return <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
}

function severityBadge(s) {
  if (s === 'CRITICAL') return 'border-red-500/25 bg-red-500/10 text-red-400'
  if (s === 'HIGH')     return 'border-amber-500/25 bg-amber-500/10 text-amber-400'
  if (s === 'MEDIUM')   return 'border-sky-500/25 bg-sky-500/10 text-sky-400'
  return 'border-border bg-muted text-muted-foreground'
}

/** Row accent + tint by diligence severity */
function severityRowStyles(s) {
  if (s === 'CRITICAL') return 'border-l-[3px] border-l-red-500 bg-red-500/5'
  if (s === 'HIGH')     return 'border-l-[3px] border-l-amber-500 bg-amber-500/5'
  if (s === 'MEDIUM')   return 'border-l-[3px] border-l-sky-500 bg-sky-500/[0.07]'
  return 'border-l-[3px] border-l-border bg-card'
}

/** Workflow / tracking status — distinct from severity */
function trackingStatusBadge(s) {
  switch (s) {
    case 'open':
      return 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400'
    case 'in_progress':
      return 'border-blue-500/25 bg-blue-500/10 text-blue-400'
    case 'answered':
      return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
    case 'mitigated':
      return 'border-teal-500/25 bg-teal-500/10 text-teal-400'
    case 'waived':
      return 'border-violet-500/25 bg-violet-500/10 text-violet-400'
    default:
      return 'border-border bg-muted text-muted-foreground'
  }
}

function trackingStatusFilterSelectedClass(s) {
  switch (s) {
    case 'all':
      return 'border-primary/25 bg-primary/10 text-primary'
    case 'open':
      return 'border-zinc-500/40 bg-zinc-500/15 text-zinc-300'
    case 'in_progress':
      return 'border-blue-500/40 bg-blue-500/15 text-blue-300'
    case 'answered':
      return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
    case 'mitigated':
      return 'border-teal-500/40 bg-teal-500/15 text-teal-300'
    case 'waived':
      return 'border-violet-500/40 bg-violet-500/15 text-violet-300'
    default:
      return 'border-primary/25 bg-primary/10 text-primary'
  }
}

function buyerBadge(t) {
  if (t === 'PE')        return 'border-primary/20 bg-primary/10 text-primary'
  if (t === 'Strategic') return 'border-blue-500/20 bg-blue-500/10 text-blue-400'
  if (t === 'Financial') return 'border-purple-500/20 bg-purple-500/10 text-purple-400'
  return 'border-border bg-muted text-muted-foreground'
}

export default function BuyerLens() {
  const companyId = useCompanyId()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const go = (appPath) => navigate(withCompanyQuery(resolvePath(appPath, pathname), companyId))
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [filterCat, setFilterCat] = useState('all')
  const [filterSev, setFilterSev] = useState('all')
  const [filterTracking, setFilterTracking] = useState('all')
  const [filterBuyer, setFilterBuyer] = useState('all')
  const [preferredBuyers, setPreferredBuyers] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [initiatives, setInitiatives] = useState([])
  const [draft, setDraft] = useState({ status: 'open', response_text: '', answer_draft: '', mitigating_initiative_id: '' })
  const [savingId, setSavingId] = useState(null)
  const [generatingDraftId, setGeneratingDraftId] = useState(null)
  const [aiSimulation, setAiSimulation] = useState(null)
  const [aiSimLoading, setAiSimLoading] = useState(false)
  const [aiSimError, setAiSimError] = useState(null)
  const [scores, setScores] = useState(null)

  const load = useCallback(() => {
    if (companyId == null || companyId < 1) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    Promise.all([
      apiClient.get(`/api/analytics/buyer-questions/${companyId}`),
      apiClient.get(`/api/analytics/engagement-profile/${companyId}`).catch(() => ({ preferred_buyer_types: [] })),
      apiClient.get(`/api/analytics/initiatives/${companyId}`).catch(() => ({ initiatives: [] })),
      apiClient.get(`/api/analytics/scores/${companyId}`).catch(() => null),
    ])
      .then(([qData, profile, inits, sc]) => {
        setData(qData)
        setScores(sc)
        const prefs = Array.isArray(profile.preferred_buyer_types) ? profile.preferred_buyer_types : []
        setPreferredBuyers(prefs)
        if (prefs.length > 0) setFilterBuyer('preferred')
        setInitiatives(inits.initiatives ?? [])
        setLoading(false)
      })
      .catch(e => {
        setError(e.message)
        setLoading(false)
      })
  }, [companyId])

  useEffect(() => { load() }, [load])

  function openRow(q) {
    if (expandedId === q.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(q.id)
    setDraft({
      status: q.tracking_status ?? 'open',
      response_text: q.response_text ?? '',
      answer_draft: q.answer_draft ?? '',
      mitigating_initiative_id: q.mitigating_initiative_id != null ? String(q.mitigating_initiative_id) : '',
    })
  }

  async function generateDraft(q) {
    setGeneratingDraftId(q.id)
    try {
      const result = await apiClient.post(
        `/api/analytics/buyer-questions/${companyId}/${q.id}/generate-draft`,
        {}
      )
      setDraft(d => ({ ...d, answer_draft: result.answer_draft || '' }))
      toast.success('AI draft generated')
    } catch (e) {
      toast.error(e?.message || 'Draft generation failed')
    }
    setGeneratingDraftId(null)
  }

  async function saveTracking(q) {
    setSavingId(q.id)
    try {
      const body = {
        status: draft.status,
        response_text: draft.response_text.trim() || null,
        answer_draft: draft.answer_draft.trim() || null,
        mitigating_initiative_id: draft.mitigating_initiative_id === '' ? null : Number(draft.mitigating_initiative_id),
      }
      await apiClient.patch(`/api/analytics/buyer-questions/${companyId}/${q.id}`, body)
      setData(prev => {
        if (!prev?.questions) return prev
        return {
          ...prev,
          questions: prev.questions.map(x =>
            x.id === q.id
              ? {
                  ...x,
                  tracking_status: body.status,
                  response_text: body.response_text,
                  mitigating_initiative_id: body.mitigating_initiative_id,
                }
              : x,
          ),
        }
      })
      toast.success('Response saved')
    } catch (e) {
      toast.error(e?.message || 'Save failed')
    }
    setSavingId(null)
  }

  async function runAiSimulation() {
    if (!companyId || !scores) return
    setAiSimLoading(true)
    setAiSimError(null)
    const catScores = {}
    const cats = scores?.category_scores ?? {}
    for (const [k, v] of Object.entries(cats)) {
      catScores[k] = v?.composite ?? 0
    }
    const riskFlags = []
    if (cats.customer_risk?.sub_scores?.concentration_score) {
      const top = cats.customer_risk.sub_scores.concentration_score
      riskFlags.push({ label: 'Customer concentration', value: `Top customers = ${top.value ?? '?'}% of revenue` })
    }
    if (cats.operational_independence?.sub_scores?.owner_dependency) {
      const od = cats.operational_independence.sub_scores.owner_dependency
      riskFlags.push({ label: 'Owner dependency', value: String(od.value ?? '') })
    }
    if (cats.revenue_quality?.sub_scores?.recurring_rate) {
      const rr = cats.revenue_quality.sub_scores.recurring_rate
      riskFlags.push({ label: 'Recurring revenue', value: `${rr.value ?? 0}%` })
    }
    try {
      const result = await apiClient.post(`/api/insights/${companyId}`, {
        module: 'buyer_questions',
        payload: {
          drs_score: scores.drs_score ?? 0,
          drs_tier: scores.tier ?? '',
          ebitda: scores.ev_data?.ebitda_base ?? 0,
          ev_floor: scores.ev_data?.ev_floor ?? 0,
          ev_ceiling: scores.ev_data?.ev_ceiling ?? 0,
          category_scores: catScores,
          risk_flags: riskFlags,
        },
      })
      if (result.result) setAiSimulation(result.result)
      else setAiSimError(result.error || 'AI simulation unavailable')
    } catch (e) {
      setAiSimError(e?.message || 'AI simulation unavailable')
    }
    setAiSimLoading(false)
  }

  const questions = (data?.questions ?? []).filter(q => {
    if (filterCat !== 'all' && q.category !== filterCat) return false
    if (filterSev !== 'all' && q.severity !== filterSev) return false
    if (filterTracking !== 'all' && trackingStatusOf(q) !== filterTracking) return false
    if (filterBuyer === 'all') return true
    if (filterBuyer === 'preferred') {
      if (!preferredBuyers.length) return true
      return q.buyer_type === 'All' || preferredBuyers.includes(q.buyer_type)
    }
    return q.buyer_type === filterBuyer || q.buyer_type === 'All'
  })

  const allQs = data?.questions ?? []
  const criticalCount = allQs.filter(q => q.severity === 'CRITICAL').length
  const highCount = allQs.filter(q => q.severity === 'HIGH').length
  const mediumCount = allQs.filter(q => q.severity === 'MEDIUM').length
  const trackingLabel = (s) => STATUS_OPTIONS.find(o => o.value === s)?.label ?? s.replace(/_/g, ' ')

  if (companyId == null || companyId < 1) {
    return (
      <div className="space-y-5 max-w-[1400px]">
        <SectionHeader title="Buyer Risk Profile" subtitle="Simulated due diligence questions prioritized by DRS weakness" />
        <p className="text-sm text-muted-foreground">Select a client in the header to load buyer questions.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader
        title="Buyer Risk Profile"
        subtitle="Simulated due diligence questions a buyer would raise — prioritized by DRS weakness"
        action={data ? (
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-border bg-muted text-muted-foreground">
            {data.total} questions
          </span>
        ) : null}
      />

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex gap-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-20" /></div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center text-sm text-red-400">
          {error}
        </div>
      )}

      {/* AI Buyer Question Simulation */}
      {data && (
        <div className="rounded-xl border border-violet-500/20 bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-violet-500/15 bg-violet-500/5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <div>
                <h3 className="text-sm font-semibold text-card-foreground">AI PE Diligence Simulation</h3>
                <p className="text-[10px] text-muted-foreground">Questions a PE buyer would ask, anchored to this company's specific metrics</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold text-violet-400/70 uppercase tracking-wider">AI-Generated Analysis</span>
              <button
                onClick={runAiSimulation}
                disabled={aiSimLoading || !scores}
                className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 disabled:opacity-50 transition-colors"
              >
                {aiSimLoading
                  ? <><RefreshCw className="w-3 h-3 animate-spin" /> Simulating…</>
                  : <><Sparkles className="w-3 h-3" /> {aiSimulation ? 'Regenerate' : 'Run AI Simulation'}</>
                }
              </button>
            </div>
          </div>
          <div className="p-5">
            {!aiSimulation && !aiSimLoading && !aiSimError && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Click "Run AI Simulation" to generate PE-specific diligence questions anchored to this company's DRS score and risk flags.
              </p>
            )}
            {aiSimLoading && (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))}
              </div>
            )}
            {aiSimError && !aiSimLoading && (
              <p className="text-xs text-red-400/70 text-center py-4">{aiSimError}</p>
            )}
            {aiSimulation && !aiSimLoading && Array.isArray(aiSimulation) && (
              <div className="space-y-3">
                {aiSimulation.map((q, i) => (
                  <div key={i} className="rounded-lg border border-border bg-muted/20 p-4">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-[10px] font-bold text-violet-400/60 mt-0.5 flex-shrink-0">{String(i+1).padStart(2,'0')}</span>
                      <p className="text-xs font-semibold text-card-foreground leading-snug flex-1">{q.question}</p>
                    </div>
                    <div className="flex items-center gap-2 mb-2 ml-5">
                      <span className="text-[9px] font-semibold text-violet-400/70 uppercase tracking-wider border border-violet-500/20 bg-violet-500/5 rounded px-1.5 py-0.5">
                        {(q.risk_category ?? '').replace(/_/g, ' ')}
                      </span>
                      {q.metric_anchor && (
                        <span className="text-[10px] text-muted-foreground italic">↳ {q.metric_anchor}</span>
                      )}
                    </div>
                    {Array.isArray(q.documentation_checklist) && q.documentation_checklist.length > 0 && (
                      <div className="ml-5">
                        <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Documentation needed</p>
                        <ul className="space-y-0.5">
                          {q.documentation_checklist.map((doc, j) => (
                            <li key={j} className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                              <span className="text-muted-foreground/40 flex-shrink-0 mt-0.5">·</span>{doc}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {data && (
        <>
          {/* Completion progress */}
          {(() => {
            const answered = allQs.filter(q => ['answered', 'mitigated'].includes(trackingStatusOf(q))).length
            const pct = allQs.length > 0 ? Math.round(answered / allQs.length * 100) : 0
            return (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Answer completion</p>
                  <span className="text-[11px] font-bold text-card-foreground">{answered} / {allQs.length} answered</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{pct}% ready for diligence</p>
              </div>
            )
          })()}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Critical</p>
              <p className="text-3xl font-black text-red-400">{criticalCount}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Must-answer for any deal</p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">High</p>
              <p className="text-3xl font-black text-amber-400">{highCount}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Significant deal risk</p>
            </div>
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 text-center">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Medium</p>
              <p className="text-3xl font-black text-sky-400">{mediumCount}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Prepare before diligence</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total</p>
              <p className="text-3xl font-black text-card-foreground">{data.total}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Questions generated</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-full sm:w-auto sm:mr-1">Severity</span>
              <div className="flex items-center gap-1 flex-wrap">
                {SEVERITIES.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFilterSev(s)}
                    className={cn(
                      'text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors',
                      filterSev === s
                        ? s === 'CRITICAL' ? 'border-red-500/30 bg-red-500/15 text-red-300'
                          : s === 'HIGH'   ? 'border-amber-500/30 bg-amber-500/15 text-amber-300'
                          : s === 'MEDIUM' ? 'border-sky-500/30 bg-sky-500/15 text-sky-300'
                          : 'border-primary/25 bg-primary/10 text-primary'
                        : 'border-border bg-transparent text-muted-foreground hover:bg-muted/30'
                    )}
                  >
                    {s === 'all' ? 'All' : s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-full sm:w-auto sm:mr-1">Status</span>
              <div className="flex items-center gap-1 flex-wrap">
                {TRACKING_STATUS_KEYS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFilterTracking(s)}
                    className={cn(
                      'text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors',
                      filterTracking === s
                        ? trackingStatusFilterSelectedClass(s)
                        : 'border-border bg-transparent text-muted-foreground hover:bg-muted/30'
                    )}
                  >
                    {s === 'all' ? 'All' : trackingLabel(s)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filterCat}
                onChange={e => setFilterCat(e.target.value)}
                className="bg-muted border border-border rounded-md px-3 py-1.5 text-xs text-card-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Categories</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <select
                value={filterBuyer}
                onChange={e => setFilterBuyer(e.target.value)}
                className="bg-muted border border-border rounded-md px-3 py-1.5 text-xs text-card-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {BUYER_FILTERS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <span className="text-[11px] text-muted-foreground sm:ml-auto">{questions.length} showing</span>
            </div>
          </div>

          {filterBuyer === 'preferred' && preferredBuyers.length === 0 && (
            <p className="text-[11px] text-muted-foreground rounded-lg border border-border bg-muted/20 px-3 py-2">
              No preferred buyer types saved yet — showing all questions. Set them under Engagement intake.
            </p>
          )}
          {filterBuyer === 'preferred' && preferredBuyers.length > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <Info className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span>Filtered to match engagement profile: <span className="font-semibold text-primary">{preferredBuyers.join(', ')}</span></span>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="divide-y divide-border">
              {questions.map(q => {
                const open = expandedId === q.id
                return (
                  <div key={q.id} className={cn(severityRowStyles(q.severity))}>
                    <button
                      type="button"
                      onClick={() => openRow(q)}
                      className="flex items-start gap-3 px-4 py-3.5 w-full text-left hover:bg-muted/20 transition-colors"
                    >
                      <SeverityIcon severity={q.severity} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded border uppercase', severityBadge(q.severity))}>
                            {q.severity}
                          </span>
                          <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded border', buyerBadge(q.buyer_type))}>
                            {q.buyer_type}
                          </span>
                          <span className={cn('text-[11px] font-semibold px-1.5 py-0.5 rounded border', drsCategoryBadgeClass(q.category))}>
                            {CATEGORY_LABELS[q.category] ?? q.category}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] font-semibold px-1.5 py-0.5 rounded border',
                              trackingStatusBadge(trackingStatusOf(q)),
                            )}
                          >
                            {trackingLabel(trackingStatusOf(q))}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-card-foreground leading-relaxed">{q.question}</p>
                        <div className="flex items-start gap-1.5 mt-1.5">
                          <FileText className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <p className="text-[11px] text-muted-foreground">{q.data_needed}</p>
                        </div>
                      </div>
                      {open ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />}
                    </button>
                    {open && (
                      <div className="px-4 pb-4 pt-3 border-t border-border/60 bg-muted/10 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Status</label>
                            <select
                              value={draft.status}
                              onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}
                              className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-muted-foreground focus:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                            >
                              {STATUS_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Mitigating initiative</label>
                              <button
                                type="button"
                                onClick={() => go('/ValueGap')}
                                className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                                View initiatives
                              </button>
                            </div>
                            <select
                              value={draft.mitigating_initiative_id}
                              onChange={e => setDraft(d => ({ ...d, mitigating_initiative_id: e.target.value }))}
                              className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-muted-foreground focus:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                            >
                              <option value="">— None —</option>
                              {(() => {
                                const STATUS_LABEL = { planned: 'planned', in_progress: 'in progress', complete: 'done' }
                                const same = initiatives.filter(i => i.category === q.category)
                                const other = initiatives.filter(i => i.category !== q.category)
                                return (
                                  <>
                                    {same.length > 0 && (
                                      <optgroup label={`Suggested — ${CATEGORY_LABELS[q.category] ?? q.category}`}>
                                        {same.map(i => (
                                          <option key={i.id} value={String(i.id)}>
                                            {i.title}{i.status ? ` [${STATUS_LABEL[i.status] ?? i.status}]` : ''}
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                    {other.length > 0 && (
                                      <optgroup label="Other initiatives">
                                        {other.map(i => (
                                          <option key={i.id} value={String(i.id)}>{i.title}</option>
                                        ))}
                                      </optgroup>
                                    )}
                                  </>
                                )
                              })()}
                            </select>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">AI answer draft</label>
                            <button
                              type="button"
                              disabled={generatingDraftId === q.id}
                              onClick={() => generateDraft(q)}
                              className="text-[10px] font-semibold px-2 py-1 rounded border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
                            >
                              {generatingDraftId === q.id ? 'Generating…' : '✦ Generate AI draft'}
                            </button>
                          </div>
                          <textarea
                            value={draft.answer_draft}
                            onChange={e => setDraft(d => ({ ...d, answer_draft: e.target.value }))}
                            rows={4}
                            placeholder="AI-generated answer will appear here. Click 'Generate AI draft' or write your own…"
                            className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-muted-foreground placeholder:text-muted-foreground/45 focus:text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Response / notes</label>
                          <textarea
                            value={draft.response_text}
                            onChange={e => setDraft(d => ({ ...d, response_text: e.target.value }))}
                            rows={2}
                            placeholder="Data room location, advisor notes, or mitigation plan…"
                            className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-muted-foreground placeholder:text-muted-foreground/45 focus:text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={savingId === q.id}
                          onClick={() => saveTracking(q)}
                          className="text-xs font-semibold px-3 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                        >
                          {savingId === q.id ? 'Saving…' : 'Save tracking'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
              {questions.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No questions match the current filters.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
