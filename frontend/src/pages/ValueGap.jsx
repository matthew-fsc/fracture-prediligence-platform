import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TrendingUp } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import SectionDivider from '../components/ui/SectionDivider'
import ProgressBar from '../components/ui/ProgressBar'

const COMPANY_ID = 1

function fmtM(n) {
  if (!n && n !== 0) return '—'
  return `$${(n / 1_000_000).toFixed(2)}M`
}

function fmtK(n) {
  if (!n && n !== 0) return '—'
  return n >= 1_000_000 ? fmtM(n) : `$${Math.round(n / 1000)}K`
}

function priorityVariant(p) {
  if (p === 1) return 'critical'
  if (p === 2) return 'high'
  if (p === 3) return 'watch'
  return 'medium'
}

export default function ValueGap() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    fetch(`/api/analytics/value-gap/${COMPANY_ID}`)
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const gaps = data?.gaps ?? []

  const barData = gaps.map(g => ({
    name:   g.label.replace(' ', '\n'),
    uplift: Math.round(g.ev_uplift / 1000),  // $K
    fill:   g.priority <= 2 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
  }))

  return (
    <div>
      <PageHeader
        section="Value Creation"
        title="Value Gap"
        subtitle="Quantified EV uplift available if each diligence gap is resolved"
        badge={data ? `${fmtM(data.total_value_gap)} gap` : undefined}
      />

      {loading && <div className="text-center py-16 text-muted-foreground text-sm">Analysing gaps…</div>}
      {error && <div className="text-center py-12 text-sm text-destructive">{error}</div>}

      {data && (
        <div className="space-y-6">
          {/* Hero */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Current EV',   value: fmtM(data.current_ev_midpoint),   sub: 'Today' },
              { label: 'Potential EV', value: fmtM(data.potential_ev_midpoint),  sub: 'All gaps resolved' },
              { label: 'Total Gap',    value: fmtM(data.total_value_gap),        sub: 'Addressable uplift', highlight: true },
              { label: 'DRS Uplift',   value: `+${(data.potential_drs - data.current_drs).toFixed(1)} pts`, sub: `${data.current_drs} → ${data.potential_drs}` },
            ].map(k => (
              <div key={k.label} className={`bg-card border rounded-lg p-4 text-center ${k.highlight ? 'border-primary/40' : 'border-border'}`}>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{k.label}</p>
                <p className={`text-2xl font-black ${k.highlight ? 'text-primary' : 'text-card-foreground'}`}>{k.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          {barData.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs font-semibold text-card-foreground mb-4">EV Uplift by Category (if resolved to 80+)</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} margin={{ top: 5, right: 20, bottom: 5, left: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `$${v}K`} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }}
                    formatter={v => [`$${v}K`, 'EV Uplift']}
                  />
                  <Bar dataKey="uplift" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Gap table */}
          <SectionDivider label="Prioritized Gap Analysis" />
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="divide-y divide-border">
              {gaps.map(g => (
                <div key={g.category} className="flex items-center gap-4 px-4 py-3">
                  <StatusBadge variant={priorityVariant(g.priority)} className="w-6 text-center flex-shrink-0">
                    #{g.priority}
                  </StatusBadge>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-card-foreground">{g.label}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <ProgressBar value={g.current_score} className="w-24" />
                      <span className="text-[10px] text-muted-foreground">{g.current_score} → {g.target_score}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-primary">+{fmtK(g.ev_uplift)}</p>
                    <p className="text-[10px] text-muted-foreground">+{g.drs_uplift.toFixed(1)} DRS pts</p>
                  </div>
                </div>
              ))}
              {gaps.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No material gaps identified — all categories are at or above target.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
