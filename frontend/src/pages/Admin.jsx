/**
 * Admin — platform metrics dashboard.
 *
 * Shows unit economics (MRR/ARR/churn/tier breakdown) from the admin metrics endpoint.
 * Requires the ADMIN_API_KEY which the logged-in operator enters once per session.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Lock, TrendingUp, Users, DollarSign, AlertCircle, RefreshCw, BarChart2, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { apiClient } from '../lib/apiClient'
import { cn, fmtM } from '../lib/utils'
import PageHeader from '../components/ui/PageHeader'

function fmt$(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toLocaleString()}`
}

function fmtPct(n) {
  if (n == null) return '—'
  return `${n.toFixed(2)}%`
}

function StatCard({ label, value, sub, color = 'blue', icon: Icon, delta }) {
  const colorMap = {
    blue:    { border: 'border-blue-500/20',    bg: 'bg-blue-500/5',    text: 'text-blue-400' },
    emerald: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', text: 'text-emerald-400' },
    amber:   { border: 'border-amber-500/20',   bg: 'bg-amber-500/5',   text: 'text-amber-400' },
    red:     { border: 'border-red-500/20',     bg: 'bg-red-500/5',     text: 'text-red-400' },
    purple:  { border: 'border-purple-500/20',  bg: 'bg-purple-500/5',  text: 'text-purple-400' },
  }
  const c = colorMap[color] ?? colorMap.blue

  return (
    <div className={cn('rounded-xl border p-4 space-y-2', c.border, c.bg)}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        {Icon && <Icon className={cn('w-4 h-4', c.text)} />}
      </div>
      <p className={cn('text-2xl font-bold', c.text)}>{value}</p>
      <div className="flex items-center justify-between">
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
        {delta != null && (
          <span className={cn('flex items-center gap-0.5 text-[11px] font-semibold', delta >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {fmt$(Math.abs(delta))} / 30d
          </span>
        )}
      </div>
    </div>
  )
}

function TierRow({ tier, count, mrr }) {
  const tierLabels = { founding: 'Founding', pro: 'Pro', team: 'Team' }
  const label = tierLabels[tier] ?? tier
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0 text-sm">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary" />
        <span className="font-medium text-card-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{count} {count === 1 ? 'subscriber' : 'subscribers'}</span>
      </div>
      <span className="font-semibold text-card-foreground">{fmt$(mrr)}<span className="text-muted-foreground font-normal">/mo</span></span>
    </div>
  )
}

export default function Admin() {
  const [adminKey, setAdminKey] = useState('')
  const [submittedKey, setSubmittedKey] = useState('')
  const [keyInput, setKeyInput] = useState('')

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['admin-unit-economics', submittedKey],
    queryFn: () =>
      fetch('/api/admin/unit-economics', {
        headers: { 'X-Admin-Key': submittedKey },
      }).then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.detail ?? `HTTP ${res.status}`)
        }
        return res.json()
      }),
    enabled: Boolean(submittedKey),
    retry: false,
    staleTime: 60_000,
  })

  function handleKeySubmit(e) {
    e.preventDefault()
    if (keyInput.trim()) setSubmittedKey(keyInput.trim())
  }

  const as_of = data?.as_of ? new Date(data.as_of).toLocaleString() : null

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Platform Admin"
        subtitle="Unit economics and subscriber metrics for the Exit Blueprint platform."
      />

      {!submittedKey ? (
        <div className="rounded-xl border border-border bg-card p-8 max-w-md">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Lock className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-card-foreground">Admin Access Required</p>
              <p className="text-xs text-muted-foreground">Enter your ADMIN_API_KEY to view platform metrics</p>
            </div>
          </div>
          <form onSubmit={handleKeySubmit} className="space-y-3">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Admin API key…"
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
            />
            <button
              type="submit"
              disabled={!keyInput.trim()}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              View Metrics
            </button>
          </form>
        </div>
      ) : isLoading ? (
        <div className="rounded-xl border border-border bg-card p-10 flex items-center justify-center gap-3 text-muted-foreground text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading metrics…
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-400">Access Denied</p>
            <p className="text-xs text-red-300/80 mt-1">{error?.message ?? 'Invalid admin key or endpoint unavailable.'}</p>
            <button
              onClick={() => setSubmittedKey('')}
              className="mt-3 text-xs text-primary hover:underline"
            >
              Try a different key
            </button>
          </div>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Timestamp + refresh */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Snapshot as of {as_of}
            </p>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className={cn('w-3 h-3', isFetching && 'animate-spin')} />
              Refresh
            </button>
          </div>

          {/* Key metrics row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="MRR"
              value={fmt$(data.total_mrr_usd)}
              sub="monthly recurring revenue"
              color="emerald"
              icon={DollarSign}
              delta={data.net_mrr_movement_last_30d_usd}
            />
            <StatCard
              label="ARR"
              value={fmt$(data.total_arr_usd)}
              sub="annualised run-rate"
              color="blue"
              icon={TrendingUp}
            />
            <StatCard
              label="Active Subscribers"
              value={data.active_subscribers}
              sub={`${data.annual_subscribers} annual · ${data.monthly_subscribers} monthly`}
              color="purple"
              icon={Users}
            />
            <StatCard
              label="Monthly Churn"
              value={fmtPct(data.monthly_churn_rate_pct)}
              sub={`${data.churned_subscribers_last_30d} churned (30d)`}
              color={data.monthly_churn_rate_pct > 5 ? 'red' : 'amber'}
              icon={BarChart2}
            />
          </div>

          {/* Secondary metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Contracted ARR"
              value={fmt$(data.contracted_arr_usd)}
              sub="from annual subscriptions"
              color="blue"
            />
            <StatCard
              label="New MRR (30d)"
              value={fmt$(data.new_mrr_last_30d_usd)}
              sub={`${data.new_subscribers_last_30d} new subscribers`}
              color="emerald"
            />
            <StatCard
              label="Churned MRR (30d)"
              value={fmt$(data.churned_mrr_last_30d_usd)}
              sub="lost in last 30 days"
              color="red"
            />
            <StatCard
              label="Past Due"
              value={data.past_due_subscribers}
              sub="payment failures"
              color={data.past_due_subscribers > 0 ? 'amber' : 'blue'}
            />
          </div>

          {/* Tier breakdown */}
          {Object.keys(data.mrr_by_tier ?? {}).length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm font-semibold text-card-foreground mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-primary" />
                Revenue by Tier
              </p>
              <div>
                {Object.entries(data.mrr_by_tier).map(([tier, mrr]) => (
                  <TierRow
                    key={tier}
                    tier={tier}
                    count={data.subscriber_count_by_tier?.[tier] ?? 0}
                    mrr={mrr}
                  />
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">Total MRR</span>
                <span className="font-bold text-card-foreground">{fmt$(data.total_mrr_usd)}<span className="text-muted-foreground font-normal">/mo</span></span>
              </div>
            </div>
          )}

          <button
            onClick={() => setSubmittedKey('')}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out of admin view
          </button>
        </div>
      ) : null}
    </div>
  )
}
