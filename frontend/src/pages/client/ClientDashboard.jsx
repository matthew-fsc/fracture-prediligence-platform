/**
 * ClientDashboard — the business-owner's home page.
 *
 * Shows company overview: DRS, EV estimate, category summary cards,
 * and quick links to other sections of the client portal.
 */

import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Grid3x3, TrendingUp, Target, NotebookPen,
  ArrowRight, Folder, AlertCircle, CheckCircle, Clock, Building2,
} from 'lucide-react'
import { apiClient } from '../../lib/apiClient'
import { cn, fmtM } from '../../lib/utils'
import { Skeleton } from '../../components/ui/Skeleton'
import { useUserRole } from '../../context/UserRoleContext'
import { usePageTitle } from '../../hooks/usePageTitle'
import SectionHeader from '../../components/ui/SectionHeader'

const CATEGORY_LABELS = {
  revenue_quality:           'Revenue Quality',
  financial_integrity:       'Financial Integrity',
  operational_independence:  'Operational Independence',
  customer_risk:             'Customer Risk',
  management_team:           'Management & Team',
  growth_drivers:            'Growth Drivers',
}

function drsTier(score) {
  if (score == null) return null
  if (score >= 85) return { label: 'Institutional Grade', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' }
  if (score >= 70) return { label: 'Investment Grade',    color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' }
  if (score >= 55) return { label: 'Conditional',         color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' }
  if (score >= 40) return { label: 'High Risk',           color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' }
  return                    { label: 'Pre-Diligence',      color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' }
}

function categoryScore(score) {
  if (score == null) return { color: 'text-muted-foreground', bar: 'bg-muted' }
  if (score >= 70)   return { color: 'text-emerald-400',      bar: 'bg-emerald-500' }
  if (score >= 50)   return { color: 'text-amber-400',        bar: 'bg-amber-500' }
  return                    { color: 'text-red-400',          bar: 'bg-red-500' }
}

const QUICK_LINKS = [
  { label: 'My Readiness Score',  path: '/client/readiness',  icon: Grid3x3,    color: 'text-emerald-400', desc: 'See your full DRS breakdown' },
  { label: 'My Valuation',        path: '/client/valuation',  icon: TrendingUp, color: 'text-primary',     desc: 'Enterprise value range' },
  { label: 'Value Roadmap',       path: '/client/value-gap',  icon: Target,     color: 'text-amber-400',   desc: 'How to grow your value' },
  { label: 'My Goals & Profile',  path: '/client/profile',    icon: NotebookPen, color: 'text-blue-400',   desc: 'Exit preferences & timeline' },
  { label: 'Documents',           path: '/client/data-room',  icon: Folder,     color: 'text-purple-400',  desc: 'Files shared by your advisor' },
]

export default function ClientDashboard() {
  usePageTitle('My Dashboard')
  const navigate = useNavigate()
  const { clientCompany } = useUserRole()
  const companyId = clientCompany?.id

  const { data: onboardingState } = useQuery({
    queryKey: ['owner-onboarding', companyId],
    queryFn: () => apiClient.get(`/api/owner-onboarding/${companyId}`),
    enabled: companyId != null,
    staleTime: 60_000,
    meta: { suppressErrorToast: true },
  })

  const { data: scores, isPending: scoresPending } = useQuery({
    queryKey: ['analytics-scores', companyId],
    queryFn: () => apiClient.get(`/api/analytics/scores/${companyId}`),
    enabled: companyId != null,
    staleTime: 60_000,
    meta: { suppressErrorToast: true },
  })

  const { data: gapData } = useQuery({
    queryKey: ['analytics-value-gap', companyId],
    queryFn: () => apiClient.get(`/api/analytics/value-gap/${companyId}`),
    enabled: companyId != null,
    staleTime: 60_000,
    meta: { suppressErrorToast: true },
  })

  const { data: profile } = useQuery({
    queryKey: ['engagement-profile', companyId],
    queryFn: () => apiClient.get(`/api/analytics/engagement-profile/${companyId}`),
    enabled: companyId != null,
    staleTime: 60_000,
    meta: { suppressErrorToast: true },
  })

  const onboardingComplete = onboardingState?.onboarding_complete

  const drs = scores?.drs?.base
  const ev = scores?.enterprise_value?.midpoint
  const evFloor = scores?.enterprise_value?.floor
  const evCeiling = scores?.enterprise_value?.ceiling
  const tier = drsTier(drs)
  const valueGap = gapData?.value_gap_total
  const hasProfile = profile && (profile.exit_timeline || profile.owner_goals_narrative)

  const categories = scores?.category_scores
    ? Object.entries(scores.category_scores).map(([key, val]) => ({
        key,
        label: CATEGORY_LABELS[key] ?? key,
        score: typeof val === 'object' ? val.score : val,
      }))
    : []

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <SectionHeader
        title={`Welcome back${clientCompany?.name ? `, ${clientCompany.name}` : ''}`}
        subtitle="Your exit-readiness dashboard — updated as your advisor refines the analysis."
      />

      {/* ── Onboarding prompt ───────────────────────────────────── */}
      {onboardingComplete === false && (
        <div className="flex items-start gap-3 bg-primary/10 border border-primary/30 rounded-xl p-4">
          <Building2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary mb-0.5">Complete your business profile</p>
            <p className="text-[12px] text-primary/80 mb-3">
              Your advisor has invited you to share your company details and exit goals.
              It takes about 5 minutes and helps personalize your readiness analysis.
            </p>
            <button
              type="button"
              onClick={() => navigate('/owner-onboarding')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/90 transition-colors"
            >
              Start Onboarding
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── KPI row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* DRS */}
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Diligence Readiness Score
          </p>
          {scoresPending ? (
            <Skeleton className="h-10 w-24 mb-2" />
          ) : drs != null ? (
            <>
              <p className={cn('text-4xl font-bold tabular-nums', tier?.color ?? 'text-foreground')}>
                {Math.round(drs)}
                <span className="text-xl font-normal text-muted-foreground">/100</span>
              </p>
              {tier && (
                <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded border mt-2 inline-block', tier.bg, tier.color)}>
                  {tier.label}
                </span>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Not yet computed</p>
          )}
        </div>

        {/* EV */}
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Enterprise Value Estimate
          </p>
          {scoresPending ? (
            <Skeleton className="h-10 w-28 mb-2" />
          ) : ev != null ? (
            <>
              <p className="text-4xl font-bold text-primary tabular-nums">{fmtM(ev)}</p>
              {evFloor != null && evCeiling != null && (
                <p className="text-xs text-muted-foreground mt-1">
                  Range: {fmtM(evFloor)} – {fmtM(evCeiling)}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Pending analysis</p>
          )}
        </div>

        {/* Value Gap */}
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Addressable Value Gap
          </p>
          {scoresPending ? (
            <Skeleton className="h-10 w-24 mb-2" />
          ) : valueGap != null && valueGap > 0 ? (
            <>
              <p className="text-4xl font-bold text-amber-400 tabular-nums">{fmtM(valueGap)}</p>
              <p className="text-xs text-muted-foreground mt-1">Potential uplift from initiatives</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No gap data yet</p>
          )}
        </div>
      </div>

      {/* ── Category scores ─────────────────────────────────────── */}
      {categories.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">
            Readiness by Category
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {categories.map(({ key, label, score }) => {
              const s = categoryScore(score)
              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-card-foreground font-medium">{label}</span>
                    <span className={cn('font-semibold tabular-nums', s.color)}>
                      {score != null ? `${Math.round(score)}/100` : '—'}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', s.bar)}
                      style={{ width: `${Math.min(100, score ?? 0)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Status notices ──────────────────────────────────────── */}
      <div className="space-y-2">
        {!hasProfile && (
          <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-amber-300 font-medium mb-0.5">Complete your profile</p>
              <p className="text-amber-400/80 text-xs">
                Share your exit goals and timeline so your advisor can tailor the engagement.{' '}
                <button
                  type="button"
                  onClick={() => navigate('/client/profile')}
                  className="underline underline-offset-2 hover:text-amber-300"
                >
                  Add now →
                </button>
              </p>
            </div>
          </div>
        )}
        {drs != null && (
          <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-400">
              Readiness analysis is up to date. Your advisor will notify you when scores are refreshed.
            </p>
          </div>
        )}
        {drs == null && !scoresPending && (
          <div className="flex items-start gap-3 bg-muted/30 border border-border rounded-lg p-4">
            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Your advisor is still uploading and processing your company data. Check back soon.
            </p>
          </div>
        )}
      </div>

      {/* ── Quick links ─────────────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Quick Access
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {QUICK_LINKS.map(({ label, path, icon: Icon, color, desc }) => (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              className="group text-left bg-card border border-border hover:border-primary/40 rounded-xl p-4 transition-colors"
            >
              <div className="flex items-center gap-2.5 mb-2">
                <Icon className={cn('w-4 h-4', color)} />
                <span className="text-[13px] font-medium text-card-foreground">{label}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              <div className="mt-3 flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Open <ArrowRight className="w-3 h-3" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
