import { useState, useEffect } from 'react'
import { useUser, useClerk } from '@clerk/react'
import { usePageTitle } from '../hooks/usePageTitle'
import { apiClient } from '../lib/apiClient'
import { toast } from '../lib/notify'
import {
  Copy, Check, User, Mail, Shield, ExternalLink, LogOut,
  Users, Link2, Building2, ChevronRight,
} from 'lucide-react'

const HAS_CLERK = Boolean((import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim())

function Section({ title, description, children }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function FieldRow({ icon: Icon, label, value, mono }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
      <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{label}</span>
      <span className={`text-sm text-card-foreground truncate ${mono ? 'font-mono text-xs' : 'font-medium'}`}>
        {value}
      </span>
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', ...props }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-sm text-card-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-shadow"
      {...props}
    />
  )
}

function PrimaryButton({ onClick, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Profile card
// ---------------------------------------------------------------------------
function ProfileSection() {
  const { user } = useUser()
  const { signOut } = useClerk()

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'Your account'
    : 'Your account'
  const email = user?.primaryEmailAddress?.emailAddress ?? null
  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?'
    : '?'

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header band */}
      <div className="h-16 bg-gradient-to-br from-primary/20 to-primary/5" />

      {/* Avatar + identity */}
      <div className="px-5 pb-5 -mt-8">
        <div className="flex items-end justify-between gap-3">
          <div className="relative">
            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt=""
                className="w-16 h-16 rounded-2xl object-cover border-2 border-card ring-2 ring-primary/20 shadow-lg"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 border-2 border-card ring-2 ring-primary/20 flex items-center justify-center text-xl font-bold text-primary-foreground shadow-lg">
                {initials}
              </div>
            )}
          </div>
          <div className="flex gap-2 pb-1">
            {HAS_CLERK && (
              <a
                href="https://accounts.clerk.dev/user"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border bg-muted/40 rounded-lg text-xs font-medium text-card-foreground hover:bg-muted transition-colors"
              >
                Edit profile <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </a>
            )}
            {HAS_CLERK && signOut && (
              <button
                onClick={() => signOut()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-500/20 bg-red-500/10 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <LogOut className="w-3 h-3" /> Sign out
              </button>
            )}
          </div>
        </div>

        <div className="mt-3">
          <p className="text-base font-semibold text-card-foreground">{displayName}</p>
          {email && <p className="text-sm text-muted-foreground">{email}</p>}
          <p className="text-xs text-muted-foreground/60 mt-0.5">Exit Blueprint · M&A Advisory</p>
        </div>
      </div>

      {/* Fields */}
      <div className="border-t border-border divide-y divide-border/60">
        <FieldRow icon={User}   label="Display name" value={displayName} />
        <FieldRow icon={Mail}   label="Email"         value={email ?? '—'} />
        <FieldRow icon={Shield} label="Account ID"    value={user?.id ? `${user.id.slice(0, 20)}…` : '—'} mono />
      </div>

      {!HAS_CLERK && (
        <p className="px-5 py-3 text-xs text-muted-foreground/70 border-t border-border">
          Clerk authentication is not configured. Profile management unavailable in this environment.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Referral
// ---------------------------------------------------------------------------
function ReferralSection() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    apiClient.get('/api/referrals/my-code')
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const copy = () => {
    if (!data?.referral_url) return
    navigator.clipboard.writeText(data.referral_url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Section
      title="Refer an advisor"
      description="When an advisor subscribes using your link, you receive a credit on your next invoice."
    >
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Loading referral data…</p>}

        {data && (
          <>
            <div className="flex gap-2">
              <input
                readOnly
                value={data.referral_url}
                className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-sm text-card-foreground focus:outline-none font-mono text-xs"
              />
              <button
                onClick={copy}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-border bg-muted/40 text-sm font-medium text-card-foreground hover:bg-muted transition-colors whitespace-nowrap"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Clicks',         value: data.total_clicks },
                { label: 'Conversions',    value: data.total_conversions },
                { label: 'Credits earned', value: data.credit_balance_display },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-border bg-muted/20 p-3 text-center">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                  <p className="text-xl font-bold text-primary">{value}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Firm management
// ---------------------------------------------------------------------------
function FirmSection() {
  const [firm, setFirm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [inviteId, setInviteId] = useState('')
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    apiClient.get('/api/firms/me')
      .then(d => { setFirm(d.firm); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const inviteMember = async () => {
    if (!inviteId.trim()) return
    setInviting(true)
    try {
      await apiClient.post('/api/firms/invite-member', { member_user_id: inviteId.trim() })
      toast.success('Member invited')
      setInviteId('')
    } catch (e) {
      toast.error(e.message || 'Invite failed')
    }
    setInviting(false)
  }

  if (loading || !firm) return null

  const seatPct = Math.round((firm.seats_used / Math.max(firm.max_seats, 1)) * 100)

  return (
    <Section title="Firm" description="Manage your advisory firm and team seats.">
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-card-foreground">{firm.name}</p>
            <p className="text-xs text-muted-foreground">{firm.seats_used} of {firm.max_seats} seats used</p>
          </div>
          <div className="ml-auto w-24">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-1.5 rounded-full ${seatPct >= 90 ? 'bg-red-500' : 'bg-primary'}`}
                style={{ width: `${seatPct}%` }}
              />
            </div>
          </div>
        </div>

        {firm.is_owner && (
          <div className="border-t border-border pt-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Invite a team member</p>
            <div className="flex gap-2">
              <Input
                value={inviteId}
                onChange={e => setInviteId(e.target.value)}
                placeholder="Clerk user ID  (user_2abc…)"
              />
              <PrimaryButton onClick={inviteMember} disabled={inviting || !inviteId.trim()}>
                {inviting ? 'Inviting…' : 'Invite'}
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Client portal
// ---------------------------------------------------------------------------
function ClientInviteSection() {
  const [companyId, setCompanyId] = useState('')
  const [clientUserId, setClientUserId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const invite = async () => {
    if (!companyId || !clientUserId) return
    setSubmitting(true)
    try {
      await apiClient.post('/api/portal/invite', {
        company_id: Number(companyId),
        client_user_id: clientUserId.trim(),
      })
      toast.success('Client access granted')
      setCompanyId('')
      setClientUserId('')
    } catch (e) {
      toast.error(e.message || 'Invite failed')
    }
    setSubmitting(false)
  }

  return (
    <Section
      title="Client portal access"
      description="Give a business owner read-only access to their engagement summary — DRS score, EV range, and top initiatives."
    >
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <Input
          type="number"
          value={companyId}
          onChange={e => setCompanyId(e.target.value)}
          placeholder="Company ID"
        />
        <Input
          value={clientUserId}
          onChange={e => setClientUserId(e.target.value)}
          placeholder="Client Clerk user ID  (user_2abc…)"
        />
        <PrimaryButton onClick={invite} disabled={submitting || !companyId || !clientUserId}>
          {submitting ? 'Granting access…' : 'Grant client access'}
        </PrimaryButton>
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Main settings page
// ---------------------------------------------------------------------------
export default function SettingsPage() {
  usePageTitle('Settings')

  return (
    <div className="max-w-xl space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Settings</p>
        <h1 className="text-xl font-bold text-card-foreground">Account & preferences</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your profile, firm, referrals, and client access.</p>
      </div>

      <ProfileSection />
      <ReferralSection />
      <FirmSection />
      <ClientInviteSection />
    </div>
  )
}
