import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import SectionDivider from '../components/ui/SectionDivider'

const COMPANY_ID = 1

function fmtM(n) {
  if (!n && n !== 0) return '—'
  return `$${(n / 1_000_000).toFixed(2)}M`
}

function fmtK(n) {
  if (!n && n !== 0) return '—'
  return n >= 1_000_000 ? fmtM(n) : `$${(n / 1000).toFixed(0)}K`
}

export default function Valuation() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    fetch(`/api/analytics/scores/${COMPANY_ID}`)
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const drs = data?.drs
  const ev  = data?.enterprise_value

  // Build waterfall-style bar data for EV range
  const barData = ev ? [
    { label: 'Floor',    value: ev.floor,    fill: 'hsl(var(--muted-foreground))' },
    { label: 'Midpoint', value: ev.midpoint, fill: 'hsl(var(--primary))' },
    { label: 'Ceiling',  value: ev.ceiling,  fill: 'hsl(var(--chart-2))' },
  ] : []

  return (
    <div>
      <PageHeader
        section="Intelligence"
        title="Valuation"
        subtitle="Enterprise value range computed from DRS-adjusted EBITDA multiples"
        badge={ev ? fmtM(ev.midpoint) : undefined}
      />

      {loading && (
        <div className="text-center py-16 text-muted-foreground text-sm">Computing valuation…</div>
      )}
      {error && (
        <div className="text-center py-12 text-sm text-destructive">{error}</div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Hero EV range */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Floor',    value: ev?.floor,    sub: 'Conservative',   color: 'text-muted-foreground' },
              { label: 'Midpoint', value: ev?.midpoint, sub: 'Base case',       color: 'text-primary' },
              { label: 'Ceiling',  value: ev?.ceiling,  sub: 'Optimistic',      color: 'text-card-foreground' },
            ].map(k => (
              <div key={k.label} className="bg-card border border-border rounded-lg p-5 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{k.label}</p>
                <p className={`text-3xl font-black ${k.color}`}>{fmtM(k.value)}</p>
                <p className="text-xs text-muted-foreground mt-1">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          {ev && (
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs font-semibold text-card-foreground mb-4">Enterprise Value Range</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} margin={{ top: 5, right: 20, bottom: 5, left: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={v => `$${(v / 1e6).toFixed(1)}M`}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    axisLine={false} tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }}
                    formatter={v => [fmtM(v), 'Enterprise Value']}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, i) => (
                      <rect key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Methodology */}
          <SectionDivider label="Methodology" />
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">EBITDA Base</p>
              <p className="text-xl font-bold text-card-foreground">{fmtK(ev?.ebitda_base)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">From financial data in ontology</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Multiple Range</p>
              <p className="text-xl font-bold text-card-foreground">{ev?.multiple_used ?? '—'}x</p>
              <p className="text-[11px] text-muted-foreground mt-1">DRS-tier adjusted</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">DRS Tier</p>
              <p className="text-sm font-bold text-card-foreground truncate">{drs?.tier ?? '—'}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Score: {drs?.base ?? '—'}/100</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs font-semibold text-card-foreground mb-3">Multiple Table by DRS Tier</p>
            <div className="divide-y divide-border">
              {[
                { tier: 'Institutional Grade',  range: '7.0–9.0x', drs: '85–100' },
                { tier: 'Investment Grade',      range: '5.0–7.0x', drs: '70–84' },
                { tier: 'Conditional',           range: '3.5–5.0x', drs: '55–69' },
                { tier: 'High Risk',             range: '2.5–3.5x', drs: '40–54' },
                { tier: 'Pre-Diligence Required',range: '1.5–2.5x', drs: '<40'   },
              ].map(row => (
                <div key={row.tier} className={`flex items-center justify-between px-0 py-2 ${drs?.tier === row.tier ? 'bg-primary/5 -mx-4 px-4 rounded' : ''}`}>
                  <span className="text-xs text-card-foreground">{row.tier}</span>
                  <span className="text-xs text-muted-foreground">{row.drs}</span>
                  <span className={`text-xs font-mono font-bold ${drs?.tier === row.tier ? 'text-primary' : 'text-muted-foreground'}`}>{row.range}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
