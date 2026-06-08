import { useState, useEffect } from 'react'
import { UserProfile } from '@clerk/react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'
import { apiClient } from '../lib/apiClient'
import { toast } from '../lib/notify'
import { Copy, Check } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

// ---------------------------------------------------------------------------
// Referral section
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
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-card-foreground">Refer an advisor</h2>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Share your referral link. When an advisor subscribes using your link, you receive a credit on your next invoice.
        </p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}

      {data && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              readOnly
              value={data.referral_url}
              className="flex-1 bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm text-card-foreground focus:outline-none"
            />
            <button
              onClick={copy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-muted/40 text-sm font-medium text-card-foreground hover:bg-muted transition-colors whitespace-nowrap"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Clicks', value: data.total_clicks },
              { label: 'Conversions', value: data.total_conversions },
              { label: 'Credits earned', value: data.credit_balance_display },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-border bg-muted/20 p-3 text-center">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                <p className="text-xl font-bold text-primary">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Firm management section
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
      toast.success('Member invited successfully')
      setInviteId('')
    } catch (e) {
      toast.error(e.message || 'Invite failed')
    }
    setInviting(false)
  }

  if (loading || !firm) return null

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-card-foreground">Firm — {firm.name}</h2>
        <p className="text-sm text-muted-foreground mt-1">{firm.seats_used} of {firm.max_seats} seats used</p>
      </div>

      {firm.is_owner && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Invite an associate (enter their Clerk user ID):</p>
          <div className="flex gap-2">
            <input
              value={inviteId}
              onChange={e => setInviteId(e.target.value)}
              placeholder="user_2abc..."
              className="flex-1 bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <button
              onClick={inviteMember}
              disabled={inviting || !inviteId.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {inviting ? 'Inviting...' : 'Invite'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Client portal invite section
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
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-card-foreground">Client portal access</h2>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Give an SMB owner read-only access to their engagement summary. They'll see their DRS score, EV range, and top initiatives.
        </p>
      </div>
      <div className="space-y-2">
        <input
          type="number"
          value={companyId}
          onChange={e => setCompanyId(e.target.value)}
          placeholder="Company ID"
          className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <input
          value={clientUserId}
          onChange={e => setClientUserId(e.target.value)}
          placeholder="Client Clerk user ID (user_2abc...)"
          className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <button
          onClick={invite}
          disabled={submitting || !companyId || !clientUserId}
          className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Granting access...' : 'Grant client access'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main settings page
// ---------------------------------------------------------------------------
export default function SettingsPage() {
  usePageTitle('Account settings')
  const [tab, setTab] = useState('account')

  const tabs = [
    { id: 'account',  label: 'Account' },
    { id: 'referral', label: 'Referral' },
    { id: 'portal',   label: 'Client portal' },
    { id: 'firm',     label: 'Firm' },
  ]

  return (
    <div className="space-y-5 max-w-[1400px]">
      <PageHeader
        section="Settings"
        title="Account settings"
        subtitle="Manage your profile, referrals, client access, and firm"
      />

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-muted/40 border border-border rounded-xl w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-card border border-border text-card-foreground shadow-sm'
                : 'text-muted-foreground hover:text-card-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'account' && (
        <div className="rounded-xl border border-border bg-[#0E1420] overflow-hidden w-full">
          <UserProfile
            routing="virtual"
            appearance={{
              variables: {
                colorPrimary: '#17a773',
                colorBackground: '#0E1420',
                colorSurface: '#121824',
                colorText: '#E8ECF2',
                colorTextSecondary: '#A0AEBE',
                colorInputBackground: '#12151A',
                colorInputText: '#E8ECF2',
                colorDanger: '#ef4444',
                colorShimmer: '#1A2538',
                borderRadius: '8px',
                fontFamily: 'inherit',
                fontSize: '14px',
              },
              elements: {
                rootBox: { width: '100%', background: '#0E1420' },
                card: { width: '100%', background: '#0E1420', boxShadow: 'none', border: 'none' },
                navbar: { background: '#121824', borderRight: '1px solid #1E2A3A' },
                scrollBox: { background: '#0E1420' },
                pageScrollBox: { background: '#0E1420' },
                page: { background: '#0E1420' },
                profilePage: { background: '#0E1420' },
                profileSection: { borderColor: '#1E2A3A' },
              },
            }}
          />
        </div>
      )}

      {tab === 'referral' && <ReferralSection />}
      {tab === 'portal' && <ClientInviteSection />}
      {tab === 'firm' && <FirmSection />}
    </div>
  )
}
