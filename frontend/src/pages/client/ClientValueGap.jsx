/**
 * ClientValueGap — read-only value gap and initiative roadmap for business owners.
 *
 * Shows the gap between current EV and potential EV, and lists the ranked
 * initiatives recommended by the advisor to close that gap.
 */

import { useQuery } from '@tanstack/react-query'
import { Target, Zap, Clock, DollarSign, TrendingUp, Info } from 'lucide-react'
import { apiClient } from '../../lib/apiClient'
import { cn, fmtM } from '../../lib/utils'
import { Skeleton } from '../../components/ui/Skeleton'
import { useUserRole } from '../../context/UserRoleContext'
import { usePageTitle } from '../../hooks/usePageTitle'
import SectionHeader from '../../components/ui/SectionHeader'

const EFFORT_COLORS = {
  Low:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  Medium: 'text-amber-400   bg-amber-500/10   border-amber-500/20',
  High:   'text-red-400     bg-red-500/10     border-red-500/20',
}

const EV_IMPACT_COLORS = {
  Critical: 'text-red-400     bg-red-500/10    border-red-500/20',
  High:     'text-orange-400  bg-orange-500/10 border-orange-500/20',
  Medium:   'text-amber-400   bg-amber-500/10  border-amber-500/20',
  Low:      'text-blue-400    bg-blue-500/10   border-blue-500/20',
}

export default function ClientValueGap() {
  usePageTitle('Value Roadmap')
  const { clientCompany } = useUserRole()
  const companyId = clientCompany?.id

  const { data: gapData, isPending } = useQuery({
    queryKey: ['analytics-value-gap', companyId],
    queryFn: () => apiClient.get(`/api/analytics/value-gap/${companyId}`),
    enabled: companyId != null,
    staleTime: 60_000,
    meta: { suppressErrorToast: true },
  })

  const { data: scores } = useQuery({
    queryKey: ['analytics-scores', companyId],
    queryFn: () => apiClient.get(`/api/analytics/scores/${companyId}`),
    enabled: companyId != null,
    staleTime: 60_000,
    meta: { suppressErrorToast: true },
  })

  const currentEv = scores?.enterprise_value?.midpoint
  const potentialEv = gapData?.potential_ev_midpoint
  const gap = potentialEv != null && currentEv != null ? Math.max(0, potentialEv - currentEv) : null
  const initiatives = gapData?.initiatives ?? []

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <SectionHeader
        icon={<Target className="w-5 h-5" />}
        title="Value Roadmap"
        subtitle="Targeted initiatives your advisor recommends to increase your enterprise value before going to market."
      />

      {/* ── Gap summary ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Current EV</p>
          {isPending ? (
            <Skeleton className="h-8 w-24" />
          ) : currentEv != null ? (
            <p className="text-2xl font-bold text-primary tabular-nums">{fmtM(currentEv)}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Pending</p>
          )}
        </div>
        <div className="bg-card rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Potential EV</p>
          {isPending ? (
            <Skeleton className="h-8 w-24" />
          ) : potentialEv != null ? (
            <p className="text-2xl font-bold text-emerald-400 tabular-nums">{fmtM(potentialEv)}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Pending</p>
          )}
        </div>
        <div className="bg-card rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Value Gap</p>
          {isPending ? (
            <Skeleton className="h-8 w-24" />
          ) : gap != null ? (
            <p className="text-2xl font-bold text-amber-400 tabular-nums">{fmtM(gap)}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Pending</p>
          )}
        </div>
      </div>

      {/* ── Initiative list ─────────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Recommended Initiatives ({initiatives.length})
        </p>

        {isPending && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        )}

        {!isPending && initiatives.length === 0 && (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <Target className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Your advisor hasn't added specific initiatives yet. Check back soon.
            </p>
          </div>
        )}

        {!isPending && initiatives.length > 0 && (
          <div className="space-y-3">
            {initiatives.map((init, idx) => (
              <div key={init.id ?? idx} className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-primary text-[10px] font-bold">{idx + 1}</span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-[13px] font-semibold text-card-foreground leading-tight">{init.title}</h4>
                      {init.category && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{init.category}</p>
                      )}
                    </div>
                  </div>
                  {init.ev_impact_estimate != null && (
                    <div className="flex-shrink-0 text-right">
                      <p className="text-[11px] text-muted-foreground">EV Impact</p>
                      <p className="text-sm font-semibold text-emerald-400">+{fmtM(init.ev_impact_estimate)}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {init.timeline && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {init.timeline}
                    </span>
                  )}
                  {init.effort && (
                    <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded border', EFFORT_COLORS[init.effort] ?? 'text-muted-foreground bg-muted/30 border-border')}>
                      {init.effort} effort
                    </span>
                  )}
                  {init.ev_impact && (
                    <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded border', EV_IMPACT_COLORS[init.ev_impact] ?? 'text-muted-foreground bg-muted/30 border-border')}>
                      {init.ev_impact} EV impact
                    </span>
                  )}
                  {init.cost_estimate != null && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <DollarSign className="w-3 h-3" />
                      ~{fmtM(init.cost_estimate)} cost
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── How to read this ────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-card-foreground">How to Use This Roadmap</h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Each initiative represents a specific operational or financial improvement that your advisor
          estimates will increase your enterprise value. Work through these with your advisor before
          going to market — completing high-impact items first typically yields the best return on time.
        </p>
      </div>
    </div>
  )
}
