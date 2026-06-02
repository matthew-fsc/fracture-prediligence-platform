import { useState, useEffect } from 'react'
import { UserProfile } from '@clerk/react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'
import { apiClient } from '../lib/apiClient'
import { toast } from '../lib/notify'

const COLORS = {
  bg: '#0A1628', gold: '#C9973A', muted: '#8A9BB0',
  offWhite: '#F0EDE8', border: '#1E3A5F', card: '#0F2040',
}

// ---------------------------------------------------------------------------
// Referral section (3B)
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
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '24px 20px', marginBottom: 24 }}>
      <h2 style={{ color: COLORS.offWhite, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, fontWeight: 600, margin: '0 0 6px 0' }}>
        Refer an advisor
      </h2>
      <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13, margin: '0 0 20px 0', lineHeight: 1.6 }}>
        Share your referral link. When an advisor subscribes using your link, you receive a credit on your next invoice.
      </p>

      {loading && <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>Loading...</p>}

      {data && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <input
              readOnly
              value={data.referral_url}
              style={{
                flex: 1, background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                borderRadius: 8, padding: '10px 14px', color: COLORS.offWhite,
                fontFamily: "'DM Sans', sans-serif", fontSize: 13,
              }}
            />
            <button
              onClick={copy}
              style={{
                background: copied ? '#16a34a' : COLORS.gold, color: COLORS.bg,
                border: 'none', borderRadius: 8, padding: '10px 18px',
                fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 13,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {copied ? 'Copied ✓' : 'Copy link'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { label: 'Clicks', value: data.total_clicks },
              { label: 'Conversions', value: data.total_conversions },
              { label: 'Credits earned', value: data.credit_balance_display },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
                <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 11, margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
                <p style={{ color: COLORS.gold, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, fontWeight: 700, margin: 0 }}>{value}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Firm management section (3C — Team tier)
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

  if (loading) return null
  if (!firm) return null  // Only show for Team tier

  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '24px 20px', marginBottom: 24 }}>
      <h2 style={{ color: COLORS.offWhite, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, fontWeight: 600, margin: '0 0 6px 0' }}>
        Firm — {firm.name}
      </h2>
      <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13, margin: '0 0 20px 0' }}>
        {firm.seats_used} of {firm.max_seats} seats used
      </p>

      {firm.is_owner && (
        <div>
          <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13, margin: '0 0 8px 0' }}>
            Invite an associate (enter their Clerk user ID):
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={inviteId}
              onChange={e => setInviteId(e.target.value)}
              placeholder="user_2abc..."
              style={{
                flex: 1, background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                borderRadius: 8, padding: '10px 14px', color: COLORS.offWhite,
                fontFamily: "'DM Sans', sans-serif", fontSize: 13,
              }}
            />
            <button
              onClick={inviteMember}
              disabled={inviting || !inviteId.trim()}
              style={{
                background: COLORS.gold, color: COLORS.bg, border: 'none',
                borderRadius: 8, padding: '10px 18px',
                fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 13,
                cursor: inviting ? 'not-allowed' : 'pointer', opacity: inviting ? 0.7 : 1,
              }}
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
// Client portal invite section (2D)
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
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '24px 20px', marginBottom: 24 }}>
      <h2 style={{ color: COLORS.offWhite, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, fontWeight: 600, margin: '0 0 6px 0' }}>
        Client portal access
      </h2>
      <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13, margin: '0 0 20px 0', lineHeight: 1.6 }}>
        Give an SMB owner read-only access to their engagement summary. They'll see their DRS score, EV range, and top initiatives.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          type="number"
          value={companyId}
          onChange={e => setCompanyId(e.target.value)}
          placeholder="Company ID"
          style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '10px 14px', color: COLORS.offWhite, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}
        />
        <input
          value={clientUserId}
          onChange={e => setClientUserId(e.target.value)}
          placeholder="Client Clerk user ID (user_2abc...)"
          style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '10px 14px', color: COLORS.offWhite, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}
        />
        <button
          onClick={invite}
          disabled={submitting || !companyId || !clientUserId}
          style={{
            background: COLORS.gold, color: COLORS.bg, border: 'none',
            borderRadius: 8, padding: '11px 0',
            fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 14,
            cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
          }}
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
    <div style={{ minHeight: '100vh', background: COLORS.bg, padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: 1024, margin: '0 auto' }}>
        <Link to="/Home" style={{ display: 'inline-block', color: COLORS.gold, fontFamily: "'DM Sans', sans-serif", fontSize: 13, textDecoration: 'none', marginBottom: 24 }}>
          ← Back to dashboard
        </Link>
        <h1 style={{ color: COLORS.offWhite, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 28, fontWeight: 600, margin: '0 0 24px 0' }}>
          Settings
        </h1>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: COLORS.card, padding: 4, borderRadius: 10, border: `1px solid ${COLORS.border}`, width: 'fit-content' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: tab === t.id ? COLORS.gold : 'transparent',
                color: tab === t.id ? COLORS.bg : COLORS.muted,
                border: 'none', borderRadius: 7,
                fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13,
                padding: '7px 16px', cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'account' && (
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
            <UserProfile
              path="/settings"
              routing="path"
              appearance={{
                variables: {
                  colorPrimary: COLORS.gold,
                  colorBackground: COLORS.card,
                  colorSurface: COLORS.bg,
                  colorNeutral: COLORS.border,
                  colorText: COLORS.offWhite,
                  colorTextSecondary: COLORS.muted,
                  colorTextOnPrimaryBackground: COLORS.bg,
                  colorInputBackground: COLORS.bg,
                  colorInputText: COLORS.offWhite,
                  colorDanger: '#ef4444',
                  borderRadius: '8px',
                },
                elements: {
                  rootBox: { background: COLORS.card },
                  card: { background: COLORS.card, boxShadow: 'none', border: 'none' },
                  pageScrollBox: { background: COLORS.card },
                  navbar: { background: COLORS.bg, borderColor: COLORS.border },
                  navbarButton: { color: COLORS.offWhite },
                  navbarButtonIcon: { color: COLORS.muted },
                  headerTitle: { color: COLORS.offWhite },
                  headerSubtitle: { color: COLORS.muted },
                  formFieldLabel: { color: COLORS.muted },
                  formFieldInput: {
                    background: COLORS.bg,
                    color: COLORS.offWhite,
                    borderColor: COLORS.border,
                  },
                  formButtonPrimary: { background: COLORS.gold, color: COLORS.bg },
                  badge: { background: COLORS.bg, borderColor: COLORS.border, color: COLORS.muted },
                  profileSectionTitleText: { color: COLORS.offWhite },
                  profileSectionContent: { color: COLORS.offWhite },
                  accordionTriggerButton: { color: COLORS.offWhite },
                  menuItem: { color: COLORS.offWhite },
                  menuItemIcon: { color: COLORS.muted },
                },
              }}
            />
          </div>
        )}

        {tab === 'referral' && <ReferralSection />}
        {tab === 'portal' && <ClientInviteSection />}
        {tab === 'firm' && <FirmSection />}
      </div>
    </div>
  )
}
