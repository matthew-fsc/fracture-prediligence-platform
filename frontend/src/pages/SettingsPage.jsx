import { useState, useEffect, useRef } from 'react'
import { UserProfile } from '@clerk/react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'
import { apiClient } from '../lib/apiClient'
import { toast } from '../lib/notify'

// COLORS with improved contrast ratios (WCAG 2.1 AA / ADA compliant):
// - muted upgraded from #8A9BB0 to #AABDCE  → 7.75:1 on card, 8.98:1 on bg (was ~5.4:1 / 6.2:1)
// - border lightened for better non-text contrast (1.4.11)
const COLORS = {
  bg: '#0A1628', gold: '#C9973A', muted: '#AABDCE',
  offWhite: '#F0EDE8', border: '#2A4A7F', card: '#0F2040',
}

// Shared visually-hidden class for sr-only labels
const srOnly = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
}

const inputStyle = {
  background: COLORS.bg, border: `1px solid ${COLORS.border}`,
  borderRadius: 8, padding: '10px 14px', color: COLORS.offWhite,
  fontFamily: "'DM Sans', sans-serif", fontSize: 13, boxSizing: 'border-box',
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
    <div
      id="panel-referral"
      role="tabpanel"
      aria-labelledby="tab-referral"
      tabIndex={-1}
      style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '24px 20px', marginBottom: 24 }}
    >
      <h2 style={{ color: COLORS.offWhite, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, fontWeight: 600, margin: '0 0 6px 0' }}>
        Refer an advisor
      </h2>
      <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14, margin: '0 0 20px 0', lineHeight: 1.6 }}>
        Share your referral link. When an advisor subscribes using your link, you receive a credit on your next invoice.
      </p>

      {loading && <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>Loading...</p>}

      {/* aria-live region announces copy result to screen readers (WCAG 4.1.3) */}
      <div role="status" aria-live="polite" aria-atomic="true" style={srOnly}>
        {copied ? 'Referral link copied to clipboard.' : ''}
      </div>

      {data && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <label htmlFor="referral-url" style={srOnly}>Your referral URL</label>
            <input
              id="referral-url"
              readOnly
              value={data.referral_url}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={copy}
              aria-pressed={copied}
              style={{
                background: copied ? '#16a34a' : COLORS.gold,
                color: COLORS.bg,
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
                <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 12, margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
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
  if (!firm) return null

  const isDisabled = inviting || !inviteId.trim()

  return (
    <div
      id="panel-firm"
      role="tabpanel"
      aria-labelledby="tab-firm"
      tabIndex={-1}
      style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '24px 20px', marginBottom: 24 }}
    >
      <h2 style={{ color: COLORS.offWhite, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, fontWeight: 600, margin: '0 0 6px 0' }}>
        Firm — {firm.name}
      </h2>
      <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14, margin: '0 0 20px 0' }}>
        {firm.seats_used} of {firm.max_seats} seats used
      </p>

      {firm.is_owner && (
        <div>
          <label
            htmlFor="invite-member-id"
            style={{ display: 'block', color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14, margin: '0 0 8px 0' }}
          >
            Invite an associate — enter their Clerk user ID:
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="invite-member-id"
              value={inviteId}
              onChange={e => setInviteId(e.target.value)}
              placeholder="user_2abc..."
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={inviteMember}
              disabled={isDisabled}
              aria-disabled={isDisabled}
              style={{
                background: COLORS.gold, color: COLORS.bg, border: 'none',
                borderRadius: 8, padding: '10px 18px',
                fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 13,
                cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.6 : 1,
              }}
            >
              {inviting ? 'Inviting…' : 'Invite'}
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

  const isDisabled = submitting || !companyId || !clientUserId

  return (
    <div
      id="panel-portal"
      role="tabpanel"
      aria-labelledby="tab-portal"
      tabIndex={-1}
      style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '24px 20px', marginBottom: 24 }}
    >
      <h2 style={{ color: COLORS.offWhite, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, fontWeight: 600, margin: '0 0 6px 0' }}>
        Client portal access
      </h2>
      <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14, margin: '0 0 20px 0', lineHeight: 1.6 }}>
        Give an SMB owner read-only access to their engagement summary. They'll see their DRS score, EV range, and top initiatives.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor="portal-company-id" style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>
          Company ID
        </label>
        <input
          id="portal-company-id"
          type="number"
          value={companyId}
          onChange={e => setCompanyId(e.target.value)}
          placeholder="e.g. 42"
          style={{ ...inputStyle, marginBottom: 8 }}
        />

        <label htmlFor="portal-client-user-id" style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>
          Client Clerk user ID
        </label>
        <input
          id="portal-client-user-id"
          value={clientUserId}
          onChange={e => setClientUserId(e.target.value)}
          placeholder="user_2abc…"
          style={{ ...inputStyle, marginBottom: 8 }}
        />

        <button
          onClick={invite}
          disabled={isDisabled}
          aria-disabled={isDisabled}
          style={{
            background: COLORS.gold, color: COLORS.bg, border: 'none',
            borderRadius: 8, padding: '11px 0',
            fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 14,
            cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.6 : 1,
          }}
        >
          {submitting ? 'Granting access…' : 'Grant client access'}
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
  const tabRefs = useRef({})

  const tabs = [
    { id: 'account',  label: 'Account' },
    { id: 'referral', label: 'Referral' },
    { id: 'portal',   label: 'Client portal' },
    { id: 'firm',     label: 'Firm' },
  ]

  // Roving tabindex keyboard navigation (WAI-ARIA tabs pattern)
  const handleTabKeyDown = (e, index) => {
    const ids = tabs.map(t => t.id)
    let target = null
    if (e.key === 'ArrowRight') target = ids[(index + 1) % ids.length]
    else if (e.key === 'ArrowLeft') target = ids[(index - 1 + ids.length) % ids.length]
    else if (e.key === 'Home') { e.preventDefault(); target = ids[0] }
    else if (e.key === 'End')  { e.preventDefault(); target = ids[ids.length - 1] }
    if (target) { setTab(target); tabRefs.current[target]?.focus() }
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: 1024, margin: '0 auto' }}>
        <Link
          to="/Home"
          aria-label="Back to dashboard"
          style={{ display: 'inline-block', color: COLORS.gold, fontFamily: "'DM Sans', sans-serif", fontSize: 13, textDecoration: 'none', marginBottom: 24 }}
        >
          ← Back to dashboard
        </Link>
        <h1 style={{ color: COLORS.offWhite, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 28, fontWeight: 600, margin: '0 0 24px 0' }}>
          Settings
        </h1>

        {/* Tab bar — WCAG 4.1.2: role, aria-selected, roving tabindex */}
        <div
          role="tablist"
          aria-label="Settings sections"
          style={{ display: 'flex', gap: 4, marginBottom: 28, background: COLORS.card, padding: 4, borderRadius: 10, border: `1px solid ${COLORS.border}`, width: 'fit-content' }}
        >
          {tabs.map((t, index) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                role="tab"
                aria-selected={active}
                aria-controls={`panel-${t.id}`}
                tabIndex={active ? 0 : -1}
                ref={el => { tabRefs.current[t.id] = el }}
                onClick={() => setTab(t.id)}
                onKeyDown={e => handleTabKeyDown(e, index)}
                style={{
                  background: active ? COLORS.gold : 'transparent',
                  color: active ? COLORS.bg : COLORS.offWhite,
                  border: 'none', borderRadius: 7,
                  fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13,
                  padding: '7px 16px', cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {tab === 'account' && (
          <div
            id="panel-account"
            role="tabpanel"
            aria-labelledby="tab-account"
            tabIndex={-1}
            style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}
          >
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
        {tab === 'portal'   && <ClientInviteSection />}
        {tab === 'firm'     && <FirmSection />}
      </div>
    </div>
  )
}
