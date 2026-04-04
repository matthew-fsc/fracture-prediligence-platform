/**
 * ClientValuation — read-only enterprise value summary for business owners.
 *
 * Shows EV floor/midpoint/ceiling, EBITDA summary (no raw addback details),
 * and an explanation of the valuation methodology.
 */

import { useQuery } from '@tanstack/react-query'
import { TrendingUp, Info } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { apiClient } from '../../lib/apiClient'
import { cn, fmtM } from '../../lib/utils'
import { Skeleton } from '../../components/ui/Skeleton'
import { useUserRole } from '../../context/UserRoleContext'
import { usePageTitle } from '../../hooks/usePageTitle'
import SectionHeader from '../../components/ui/SectionHeader'

export default function ClientValuation() {
  usePageTitle('My Valuation')
  const { clientCompany } = useUserRole()
  const companyId = clientCompany?.id

  const { data: scores, isPending } = useQuery({
    queryKey: ['analytics-scores', companyId],
    queryFn: () => apiClient.get(`/api/analytics/scores/${companyId}`),
    enabled: companyId != null,
    staleTime: 60_000,
    meta: { suppressErrorToast: true },
  })

  const ev = scores?.enterprise_value
  const ebitda = scores?.ebitda
  const drs = scores?.drs?.base

  const evFloor = ev?.floor
  const evMid = ev?.midpoint
  const evCeiling = ev?.ceiling
  const ebitdaBase = ebitda?.base
  const multipleFloor = ev?.multiple_floor
  const multipleCeiling = ev?.multiple_ceiling

  const barData = evFloor != null && evMid != null && evCeiling != null
    ? [
        { label: 'Conservative', value: evFloor,   color: '#EF4444' },
        { label: 'Base Case',    value: evMid,      color: 'hsl(var(--primary))' },
        { label: 'Optimistic',   value: evCeiling,  color: '#4ADE80' },
      ]
    : []

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <SectionHeader
        icon={<TrendingUp className="w-5 h-5" />}
        title="My Valuation"
        subtitle="Enterprise value estimate based on your normalized EBITDA and Diligence Readiness Score."
      />

      {/* ── EV Range cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Conservative Floor', value: evFloor,   color: 'text-red-400',  border: 'border-red-500/20',     bg: 'bg-red-500/5' },
          { label: 'Base Case Midpoint', value: evMid,     color: 'text-primary',  border: 'border-primary/20',     bg: 'bg-primary/5' },
          { label: 'Optimistic Ceiling', value: evCeiling, color: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5' },
        ].map(({ label, value, color, border, bg }) => (
          <div key={label} className={cn('rounded-xl border p-5', border, bg)}>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
            {isPending ? (
              <Skeleton className="h-10 w-24" />
            ) : value != null ? (
              <p className={cn('text-3xl font-bold tabular-nums', color)}>{fmtM(value)}</p>
            ) : (
              <p className="text-muted-foreground text-sm">Pending</p>
            )}
          </div>
        ))}
      </div>

      {/* ── Waterfall chart ─────────────────────────────────────── */}
      {barData.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">
            Enterprise Value Scenarios
          </p>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} barSize={48} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(v) => fmtM(v)}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip
                  formatter={(v) => [fmtM(v), 'Enterprise Value']}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Key metrics ─────────────────────────────────────────── */}
      {(ebitdaBase != null || multipleFloor != null) && (
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">
            Key Inputs
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {ebitdaBase != null && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Normalized EBITDA</p>
                <p className="text-base font-semibold text-card-foreground">{fmtM(ebitdaBase)}</p>
              </div>
            )}
            {multipleFloor != null && multipleCeiling != null && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">EBITDA Multiple Range</p>
                <p className="text-base font-semibold text-card-foreground">
                  {multipleFloor.toFixed(1)}× – {multipleCeiling.toFixed(1)}×
                </p>
              </div>
            )}
            {drs != null && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Readiness Score (DRS)</p>
                <p className="text-base font-semibold text-primary">{Math.round(drs)}/100</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Methodology note ────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-card-foreground">How Your Valuation Is Calculated</h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your enterprise value is calculated using a normalized EBITDA (earnings before interest, taxes,
          depreciation, and amortization) adjusted for owner add-backs, then multiplied by an EBITDA
          multiple range that reflects your Diligence Readiness Score and current market benchmarks for
          your industry. A higher DRS typically supports a higher multiple.
        </p>
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
          <strong className="text-card-foreground">Note:</strong> These figures are advisory estimates
          prepared for planning purposes only. Actual transaction value depends on buyer appetite,
          deal structure, and final due-diligence findings.
        </p>
      </div>
    </div>
  )
}
