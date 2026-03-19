import { useState, useEffect } from 'react'
import { RotateCcw } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import ProgressBar from '../components/ui/ProgressBar'
import StatusBadge from '../components/ui/StatusBadge'
import SectionDivider from '../components/ui/SectionDivider'

const COMPANY_ID = 1

const DRS_WEIGHTS = {
  revenue_quality:          0.25,
  financial_integrity:      0.20,
  operational_independence: 0.20,
  customer_risk:            0.15,
  management_team:          0.10,
  growth_drivers:           0.10,
}

const CATEGORY_LABELS = {
  revenue_quality:          'Revenue Quality',
  financial_integrity:      'Financial Integrity',
  operational_independence: 'Operational Independence',
  customer_risk:            'Customer Risk',
  management_team:          'Management & Team',
  growth_drivers:           'Growth Drivers',
}

// DRS tier → EBITDA multiple midpoint
const TIER_MULTIPLES = {
  'Institutional Grade':   8.0,
  'Investment Grade':      6.0,
  'Conditional':           4.25,
  'High Risk':             3.0,
  'Pre-Diligence Required':2.0,
}

function classifyTier(drs) {
  if (drs >= 85) return 'Institutional Grade'
  if (drs >= 70) return 'Investment Grade'
  if (drs >= 55) return 'Conditional'
  if (drs >= 40) return 'High Risk'
  return 'Pre-Diligence Required'
}

function tierVariant(tier) {
  const map = {
    'Institutional Grade':   'strong',
    'Investment Grade':      'adequate',
    'Conditional':           'watch',
    'High Risk':             'high',
    'Pre-Diligence Required':'critical',
  }
  return map[tier] ?? 'medium'
}

function computeDRS(scores) {
  return Object.entries(DRS_WEIGHTS).reduce((sum, [k, w]) => sum + (scores[k] ?? 50) * w, 0)
}

function fmtM(n) {
  return `$${(n / 1_000_000).toFixed(2)}M`
}

function scoreColor(s) {
  if (s >= 75) return 'text-primary'
  if (s >= 55) return 'text-warning'
  return 'text-destructive'
}

export default function ScenarioSimulator() {
  const [baseline, setBaseline]   = useState(null)
  const [scores, setScores]       = useState({})
  const [ebitda, setEbitda]       = useState(500000)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    fetch(`/api/analytics/scores/${COMPANY_ID}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          const initial = {}
          for (const k of Object.keys(DRS_WEIGHTS)) {
            initial[k] = d.category_scores?.[k]?.composite ?? 50
          }
          setScores(initial)
          setBaseline(initial)
          if (d.enterprise_value?.ebitda_base) {
            setEbitda(d.enterprise_value.ebitda_base)
          }
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const drs      = computeDRS(scores)
  const tier     = classifyTier(drs)
  const multiple = TIER_MULTIPLES[tier] ?? 4.0
  const ev       = ebitda * multiple

  const baseDRS = baseline ? computeDRS(baseline) : null
  const drsDelta = baseDRS != null ? drs - baseDRS : 0

  function reset() {
    if (baseline) setScores({ ...baseline })
  }

  function setScore(key, val) {
    setScores(prev => ({ ...prev, [key]: Number(val) }))
  }

  return (
    <div>
      <PageHeader
        section="Value Creation"
        title="Scenario Simulator"
        subtitle="Interactively adjust DRS category scores to model the EV impact of improvements"
        badge={`DRS ${drs.toFixed(1)} → ${fmtM(ev)}`}
      />

      {loading && <div className="text-center py-16 text-muted-foreground text-sm">Loading baseline…</div>}

      {!loading && (
        <div className="grid grid-cols-3 gap-4">
          {/* Controls */}
          <div className="col-span-2 space-y-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-card-foreground">Adjust Category Scores</p>
                <button
                  onClick={reset}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-card-foreground transition-colors"
                >
                  <RotateCcw className="w-3 h-3" /> Reset to baseline
                </button>
              </div>
              <div className="space-y-5">
                {Object.entries(DRS_WEIGHTS).map(([key, weight]) => {
                  const val = scores[key] ?? 50
                  const base = baseline?.[key] ?? 50
                  const delta = val - base
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-card-foreground">{CATEGORY_LABELS[key]}</span>
                        <div className="flex items-center gap-2">
                          {delta !== 0 && (
                            <span className={`text-[10px] font-medium ${delta > 0 ? 'text-primary' : 'text-destructive'}`}>
                              {delta > 0 ? '+' : ''}{delta.toFixed(0)}
                            </span>
                          )}
                          <span className={`text-xs font-bold ${scoreColor(val)}`}>{Math.round(val)}</span>
                          <span className="text-[10px] text-muted-foreground">({(weight * 100).toFixed(0)}%)</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="0" max="100" step="1"
                        value={val}
                        onChange={e => setScore(key, e.target.value)}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, hsl(var(--primary)) ${val}%, hsl(var(--muted)) ${val}%)`
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs font-semibold text-card-foreground mb-3">EBITDA Assumption</p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">$</span>
                <input
                  type="number"
                  value={ebitda}
                  onChange={e => setEbitda(Number(e.target.value))}
                  className="bg-muted border border-border rounded-md px-3 py-1.5 text-xs text-card-foreground focus:outline-none focus:ring-1 focus:ring-primary w-40"
                />
                <span className="text-xs text-muted-foreground">
                  = {fmtM(ebitda)} EBITDA base
                </span>
              </div>
            </div>
          </div>

          {/* Results panel */}
          <div className="space-y-4">
            <div className="bg-card border border-primary/30 rounded-lg p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3">Scenario Result</p>
              <div className="text-center mb-4">
                <p className="text-[10px] text-muted-foreground mb-1">DRS Score</p>
                <p className={`text-4xl font-black ${scoreColor(drs)}`}>{drs.toFixed(1)}</p>
                {drsDelta !== 0 && (
                  <p className={`text-xs mt-0.5 ${drsDelta > 0 ? 'text-primary' : 'text-destructive'}`}>
                    {drsDelta > 0 ? '+' : ''}{drsDelta.toFixed(1)} vs baseline
                  </p>
                )}
              </div>
              <StatusBadge variant={tierVariant(tier)} className="w-full justify-center mb-4">
                {tier}
              </StatusBadge>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-[10px] text-muted-foreground">Multiple</span>
                  <span className="text-xs font-bold text-card-foreground">{multiple}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-muted-foreground">Enterprise Value</span>
                  <span className="text-sm font-black text-primary">{fmtM(ev)}</span>
                </div>
              </div>
            </div>

            <SectionDivider label="Category Weights" />
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="divide-y divide-border">
                {Object.entries(DRS_WEIGHTS).map(([key, weight]) => {
                  const contribution = (scores[key] ?? 50) * weight
                  return (
                    <div key={key} className="flex items-center gap-2 px-3 py-2">
                      <span className="text-[10px] text-muted-foreground flex-1 truncate">{CATEGORY_LABELS[key]}</span>
                      <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">{(weight * 100).toFixed(0)}%</span>
                      <span className={`text-[10px] font-bold w-10 text-right ${scoreColor(scores[key] ?? 50)}`}>
                        {contribution.toFixed(1)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
