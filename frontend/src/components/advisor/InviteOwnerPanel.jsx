/**
 * InviteOwnerPanel — lets an advisor invite a business owner to self-enter data.
 *
 * Shows current invite status (none / pending / accepted / onboarding complete)
 * and lets the advisor send or resend the invite email.
 */

import { useState, useEffect } from 'react'
import {
  Mail, Send, Copy, Check, RefreshCw, UserCheck, AlertCircle, Clock,
  ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react'
import { apiClient, ApiError } from '../../lib/apiClient'
import { toast } from '../../lib/notify'
import { cn } from '../../lib/utils'

export default function InviteOwnerPanel({ companyId, companyData }) {
  const [expanded, setExpanded] = useState(false)
  const [invites, setInvites] = useState(null)
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [resending, setResending] = useState(null)
  const [copied, setCopied] = useState(null)

  useEffect(() => {
    if (!companyId) return
    apiClient
      .get(`/api/me/invites?company_id=${companyId}`)
      .then(setInvites)
      .catch(() => setInvites([]))
  }, [companyId])

  const pending   = invites?.find((i) => i.status === 'PENDING')
  const accepted  = invites?.find((i) => i.status === 'ACCEPTED')
  const active    = accepted || pending

  const isComplete = !!companyData?.owner_onboarding_completed_at
  const statusBadge = isComplete
    ? { label: 'Onboarding Complete', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: UserCheck }
    : accepted
    ? { label: 'Invite Accepted', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: UserCheck }
    : pending
    ? { label: 'Invite Pending', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: Clock }
    : { label: 'Not Invited', color: 'text-muted-foreground', bg: 'bg-muted/30 border-border', icon: Mail }

  async function handleSend(e) {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    try {
      const result = await apiClient.post('/api/me/invite-client', {
        company_id: companyId,
        invite_email: email.trim(),
      })
      toast.success(
        result.email_sent
          ? `Invite sent to ${email.trim()}`
          : `Invite created — copy the link below to share manually`,
      )
      setEmail('')
      // Refresh invite list
      const updated = await apiClient.get(`/api/me/invites?company_id=${companyId}`)
      setInvites(updated)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to send invite')
    } finally {
      setSending(false)
    }
  }

  async function handleResend(invite) {
    setResending(invite.id)
    try {
      const result = await apiClient.post(`/api/me/invites/${invite.id}/resend`)
      toast.success(
        result.email_sent
          ? `Invite resent to ${invite.invite_email}`
          : 'Invite URL refreshed — copy it below',
      )
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Resend failed')
    } finally {
      setResending(null)
    }
  }

  function copyLink(url, id) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const StatusIcon = statusBadge.icon

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header row — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <Mail className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-[13px] font-semibold text-card-foreground">Owner Onboarding</span>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded border',
              statusBadge.bg,
              statusBadge.color,
            )}
          >
            <StatusIcon className="w-3 h-3" />
            {statusBadge.label}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
          {/* Explainer */}
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            Invite the business owner to self-enter their company details and exit goals.
            They'll receive an email with a secure link to a guided onboarding wizard —
            no advisor input required.
          </p>

          {/* Active invite status */}
          {active && (
            <div
              className={cn(
                'rounded-lg border p-3 space-y-2',
                isComplete
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : accepted
                  ? 'bg-blue-500/5 border-blue-500/20'
                  : 'bg-amber-500/5 border-amber-500/20',
              )}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <StatusIcon className={cn('w-4 h-4', statusBadge.color)} />
                  <span className="text-[12px] font-semibold text-card-foreground">
                    {active.invite_email}
                  </span>
                </div>
                {isComplete && (
                  <span className="text-[11px] text-emerald-400 font-medium">
                    Completed{' '}
                    {new Date(companyData.owner_onboarding_completed_at).toLocaleDateString()}
                  </span>
                )}
                {accepted && !isComplete && (
                  <span className="text-[11px] text-blue-400 font-medium">
                    Accepted{' '}
                    {active.accepted_at
                      ? new Date(active.accepted_at).toLocaleDateString()
                      : ''}
                    {' '}— onboarding in progress
                  </span>
                )}
                {pending && !accepted && (
                  <span className="text-[11px] text-amber-400/80">
                    Sent{' '}
                    {active.created_at
                      ? new Date(active.created_at).toLocaleDateString()
                      : ''}
                  </span>
                )}
              </div>

              {/* Copy link + resend row (only for pending) */}
              {pending && !accepted && active.invite_url && (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 bg-background rounded border border-border px-2.5 py-1.5 min-w-0">
                      <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-[11px] text-muted-foreground truncate font-mono">
                        {active.invite_url}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyLink(active.invite_url, active.id)}
                    className={cn(
                      'flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded border transition-colors flex-shrink-0',
                      copied === active.id
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-muted/30 border-border text-card-foreground hover:bg-muted/50',
                    )}
                  >
                    {copied === active.id ? (
                      <><Check className="w-3 h-3" /> Copied</>
                    ) : (
                      <><Copy className="w-3 h-3" /> Copy link</>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResend(active)}
                    disabled={resending === active.id}
                    className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded border border-border bg-muted/30 text-card-foreground hover:bg-muted/50 transition-colors flex-shrink-0 disabled:opacity-50"
                  >
                    <RefreshCw className={cn('w-3 h-3', resending === active.id && 'animate-spin')} />
                    Resend email
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Invite form — show if no active/accepted invite yet */}
          {!active && (
            <form onSubmit={handleSend} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@company.com"
                  required
                  className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <button
                type="submit"
                disabled={sending || !email.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Send Invite
                  </>
                )}
              </button>
            </form>
          )}

          {/* Send to different email — shown when there's already an active invite */}
          {active && !isComplete && (
            <details className="group">
              <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-card-foreground list-none flex items-center gap-1">
                <span className="group-open:hidden">+ Send to a different email</span>
                <span className="hidden group-open:inline">- Cancel</span>
              </summary>
              <form onSubmit={handleSend} className="flex items-center gap-2 mt-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="new-owner@company.com"
                    required
                    className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <button
                  type="submit"
                  disabled={sending || !email.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {sending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {sending ? 'Sending…' : 'Send'}
                </button>
              </form>
            </details>
          )}

          {/* Onboarding complete summary */}
          {isComplete && (
            <div className="flex items-start gap-2 text-[12px] text-emerald-400/80">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <p>
                The owner completed onboarding. Their goals and company details are now
                reflected in the engagement profile and analytics.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
