import { useState, useEffect } from 'react'
import { Copy, Mail, RefreshCw, Plus, Check } from 'lucide-react'
import { usePageTitle } from '../../hooks/usePageTitle'
import { apiClient, setStoredAdminKey, withAdminHeader } from '../../lib/apiClient'

const ADMIN_KEY_STORAGE = 'admin_demo_key'

function getAdminKey() {
  return localStorage.getItem(ADMIN_KEY_STORAGE) || ''
}

function ensureAdminKey() {
  const current = getAdminKey()
  if (current) return current
  const entered = window.prompt('Enter admin key')
  if (!entered) return ''
  setStoredAdminKey(entered)
  return entered
}

const COLORS = { bg: '#0A1628', gold: '#C9973A', muted: '#8A9BB0', offWhite: '#F0EDE8', card: '#0F2040', border: '#1E3A5F', green: '#4ade80', red: '#f87171' }

const INPUT_STYLE = {
  width: '100%', background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 6,
  padding: '10px 12px', color: COLORS.offWhite, fontFamily: "'DM Sans', sans-serif", fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
}

const LABEL_STYLE = {
  display: 'block', color: COLORS.muted, fontFamily: "'DM Sans', sans-serif",
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5,
}

// ---------------------------------------------------------------------------
// Create link modal
// ---------------------------------------------------------------------------
function CreateLinkModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ recipient_name: '', recipient_firm: '', recipient_email: '', sender_note: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await apiClient.post('/api/demo/create-link', form, withAdminHeader({ 'X-Admin-Key': ensureAdminKey() }))
      onCreated(data)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 101, width: '100%', maxWidth: 460, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: '32px 28px' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ color: COLORS.offWhite, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, fontWeight: 600, margin: '0 0 24px 0' }}>
          Create Personalized Demo Link
        </h3>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={LABEL_STYLE}>Recipient Name *</label>
            <input style={INPUT_STYLE} value={form.recipient_name} onChange={set('recipient_name')} placeholder="Jane Smith" required />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={LABEL_STYLE}>Firm</label>
            <input style={INPUT_STYLE} value={form.recipient_firm} onChange={set('recipient_firm')} placeholder="Smith Advisory Group" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={LABEL_STYLE}>Email</label>
            <input style={INPUT_STYLE} type="email" value={form.recipient_email} onChange={set('recipient_email')} placeholder="jane@smithadvisory.com" />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={LABEL_STYLE}>Personal note (optional)</label>
            <textarea style={{ ...INPUT_STYLE, resize: 'vertical', minHeight: 72 }} value={form.sender_note} onChange={set('sender_note')} placeholder="Hi Jane, I wanted to show you how the platform works for your HVAC client..." />
          </div>

          {error && <p style={{ color: COLORS.red, fontFamily: "'DM Sans', sans-serif", fontSize: 13, marginBottom: 16 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={loading} style={{ flex: 1, background: COLORS.gold, color: COLORS.bg, fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 14, padding: '11px 20px', borderRadius: 7, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Creating...' : 'Create Link'}
            </button>
            <button type="button" onClick={onClose} style={{ background: 'transparent', border: `1px solid ${COLORS.border}`, color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: '11px 20px', borderRadius: 7, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Copy-to-clipboard helper
// ---------------------------------------------------------------------------
function CopyLink({ url }) {
  const [copied, setCopied] = useState(false)
  const handle = () => {
    navigator.clipboard.writeText(`${window.location.origin}${url}`).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }
  return (
    <button onClick={handle} title="Copy link" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: copied ? COLORS.green : COLORS.gold, display: 'flex', alignItems: 'center', gap: 4, padding: 0, fontFamily: "'DM Sans', sans-serif", fontSize: 12 }}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Email reminder helper
// ---------------------------------------------------------------------------
function EmailReminder({ link }) {
  const href = `mailto:${link.recipient_email}?subject=Following up — Your Fracture Systems Demo&body=Hi ${link.recipient_name},%0A%0AI wanted to follow up on the Fracture Systems demo I shared with you.%0A%0AYou can access it here: ${window.location.origin}/demo/${link.slug}%0A%0AWe have a limited number of Founding Advisor spots at $179/mo. Happy to answer any questions.%0A%0ABest,%0AMatthew`
  return (
    <a href={href} title="Send reminder" style={{ color: COLORS.muted, display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'DM Sans', sans-serif", fontSize: 12, textDecoration: 'none' }}>
      <Mail size={13} /> Remind
    </a>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AdminDemos() {
  usePageTitle('Demo Admin')
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newLink, setNewLink] = useState(null)

  const fetchLinks = async () => {
    setLoading(true)
    try {
      const key = ensureAdminKey()
      const data = await apiClient.get('/api/admin/demos', { headers: { 'X-Admin-Key': key } })
      setLinks(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLinks() }, [])

  const handleCreated = (link) => {
    setNewLink(link)
    fetchLinks()
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, padding: '40px 24px' }} className="dark">
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ background: COLORS.gold, borderRadius: 5, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: COLORS.bg, fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 14 }}>F</span>
              </div>
              <span style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Fracture Systems</span>
            </div>
            <h1 style={{ color: COLORS.offWhite, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 28, fontWeight: 700, margin: 0 }}>Demo Links</h1>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={fetchLinks} style={{ background: 'transparent', border: `1px solid ${COLORS.border}`, color: COLORS.muted, borderRadius: 7, padding: '9px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>
              <RefreshCw size={13} /> Refresh
            </button>
            <button onClick={() => setShowCreate(true)} style={{ background: COLORS.gold, color: COLORS.bg, border: 'none', borderRadius: 7, padding: '9px 18px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> New Link
            </button>
          </div>
        </div>

        {/* New link success flash */}
        {newLink && (
          <div style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 8, padding: '14px 18px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ color: COLORS.green, fontFamily: "'DM Sans', sans-serif", fontSize: 13, margin: 0 }}>
              Link created: <strong>{window.location.origin}{newLink.demo_url}</strong>
            </p>
            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${newLink.demo_url}`); setNewLink(null) }} style={{ background: COLORS.gold, color: COLORS.bg, border: 'none', borderRadius: 5, padding: '6px 14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 12 }}>
              Copy & Dismiss
            </button>
          </div>
        )}

        {/* Error */}
        {error && <p style={{ color: COLORS.red, fontFamily: "'DM Sans', sans-serif", fontSize: 14, marginBottom: 20 }}>{error}</p>}

        {/* Table */}
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>Loading...</div>
          ) : links.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>No demo links yet. Create one above.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  {['Recipient', 'Firm', 'Visits', 'First Visited', 'Sections', 'Converted', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {links.map((lnk, i) => (
                  <tr key={lnk.id} style={{ borderBottom: i < links.length - 1 ? `1px solid ${COLORS.border}` : 'none' }}>
                    <td style={{ padding: '13px 16px' }}>
                      <p style={{ color: COLORS.offWhite, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, margin: '0 0 2px 0' }}>{lnk.recipient_name}</p>
                      <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 11, margin: 0 }}>{lnk.recipient_email}</p>
                    </td>
                    <td style={{ padding: '13px 16px', color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>{lnk.recipient_firm || '—'}</td>
                    <td style={{ padding: '13px 16px', color: lnk.visit_count > 0 ? COLORS.offWhite : COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: lnk.visit_count > 0 ? 600 : 400 }}>{lnk.visit_count}</td>
                    <td style={{ padding: '13px 16px', color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 12 }}>
                      {lnk.first_visited_at ? new Date(lnk.first_visited_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '13px 16px', color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 12 }}>
                      {lnk.sections_viewed?.length > 0 ? lnk.sections_viewed.join(', ') : '—'}
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ background: lnk.converted ? 'rgba(74,222,128,0.1)' : 'rgba(139,155,176,0.1)', border: `1px solid ${lnk.converted ? 'rgba(74,222,128,0.25)' : 'rgba(139,155,176,0.2)'}`, color: lnk.converted ? COLORS.green : COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {lnk.converted ? 'Converted' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <CopyLink url={lnk.demo_url} />
                        {lnk.recipient_email && <EmailReminder link={lnk} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 12, marginTop: 16 }}>
          {links.length} link{links.length !== 1 ? 's' : ''}
        </p>
      </div>

      {showCreate && <CreateLinkModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
    </div>
  )
}
