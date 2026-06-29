import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  House, Building, Workflow, Grid3x3,
  Eye, TrendingUp, Target, Activity, Plug,
  Folder, FileText, Bot, Settings, ChevronLeft,
  GitCompare, NotebookPen, UserPlus, X, Handshake,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useCompanyId } from '../../context/CompanyContext'
import { withCompanyQuery } from '../../lib/navLinks'
import { apiClient } from '../../lib/apiClient'
import { toast } from '../../lib/notify'

const groups = [
  {
    label: 'Workspace',
    items: [
      { label: 'Home',               href: '/Home',             icon: House },
      { label: 'Company Workspace',  href: '/CompanyWorkspace', icon: Building },
      { label: 'Client Profile',     href: '/EngagementIntake', icon: NotebookPen },
      { label: 'Advisory Workflow',  href: '/AdvisoryWorkflow', icon: Workflow },
      { label: 'Deal Outcome',       href: '/DealOutcome',      icon: Handshake },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'Readiness Score',    href: '/Readiness',        icon: Grid3x3 },
      { label: 'Buyer Risk Profile', href: '/BuyerLens',        icon: Eye },
      { label: 'Valuation',          href: '/Valuation',        icon: TrendingUp },
      { label: 'Market Comps',       href: '/MarketComps',      icon: GitCompare },
    ],
  },
  {
    label: 'Value Creation',
    items: [
      { label: 'Value Gap',          href: '/ValueGap',         icon: Target },
      { label: 'Scenario Simulator', href: '/ScenarioSimulator',icon: Activity },
    ],
  },
  {
    label: 'Data Pipeline',
    items: [
      { label: 'Data Sources',       href: '/Connectors',       icon: Plug },
      { label: 'Data Room (VDR)',    href: '/DataRoom',         icon: Folder },
    ],
  },
  {
    label: 'Output',
    items: [
      { label: 'Reports',            href: '/Reports',          icon: FileText },
      { label: 'AI Copilot',         href: '/AICopilot',        icon: Bot },
      { label: 'Admin',              href: '/Admin',            icon: Settings },
    ],
  },
]

// ---------------------------------------------------------------------------
// Client invite modal
// ---------------------------------------------------------------------------
function InviteClientModal({ companyId, onClose }) {
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  async function handleInvite(e) {
    e.preventDefault()
    if (!email.trim() || !companyId) return
    setSaving(true)
    try {
      const data = await apiClient.post('/api/me/invite-client', {
        company_id: companyId,
        invite_email: email.trim(),
      })
      setResult(data)
    } catch (err) {
      toast.error(err?.message ?? 'Could not create invite')
    } finally {
      setSaving(false)
    }
  }

  const inviteUrl = result?.invite_token
    ? `${window.location.origin}/client-invite/${result.invite_token}`
    : null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            Invite Business Owner
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!result ? (
          <>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Enter the business owner's email. They'll receive a link to create their
              client portal account and view their company's readiness data.
            </p>
            <form onSubmit={handleInvite} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@business.com"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {!companyId && (
                <p className="text-xs text-amber-400">Select a company first to invite a client.</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs rounded-lg border border-border text-muted-foreground hover:bg-muted/30"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !companyId || !email.trim()}
                  className="px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? 'Creating…' : 'Create Invite'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <p className="text-xs text-emerald-400 mb-1 font-medium">
              ✓ Invite created for <strong>{result.invite_email}</strong>
            </p>
            <p className="text-[11px] text-muted-foreground mb-3">
              {result.email_sent
                ? 'An email was sent to the business owner.'
                : 'Email delivery is not configured — share the link below manually.'}
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              Share this link with the business owner:
            </p>
            <div className="bg-background border border-border rounded-lg p-3 flex items-center gap-2 mb-4">
              <code className="text-xs text-primary flex-1 truncate">{inviteUrl}</code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(inviteUrl)
                  toast.success('Copied to clipboard')
                }}
                className="text-xs text-primary hover:underline flex-shrink-0"
              >
                Copy
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2 text-xs rounded-lg border border-border text-muted-foreground hover:bg-muted/30"
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
export default function Sidebar({ mobileOpen = false, onNavigate }) {
  const companyId = useCompanyId()
  const [inviteOpen, setInviteOpen] = useState(false)

  return (
    <>
      <aside
        className={cn(
          'fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col z-[70] w-56 max-w-[85vw]',
          'transition-transform duration-200 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {/* Brand */}
        <div className="h-14 flex items-center px-3 border-b border-sidebar-border flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/logo.png" alt="Exit Blueprint" className="w-10 h-10 flex-shrink-0 object-contain rounded-md" />
            <div className="min-w-0">
              <h1 className="text-[12px] font-semibold text-sidebar-accent-foreground truncate leading-tight">
                Advisor Dashboard
              </h1>
              <p className="text-[11px] text-sidebar-foreground tracking-widest uppercase leading-tight">
                Exit Blueprint
              </p>
            </div>
          </div>
        </div>

        {/* Invite client shortcut */}
        <div className="px-3 pt-2 pb-1 border-b border-sidebar-border flex-shrink-0">
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-[11px] font-medium text-primary hover:bg-sidebar-accent/40 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5 flex-shrink-0" />
            Invite client to portal
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.label} className="mb-1">
              <p className="text-[11px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest px-4 py-1.5">
                {group.label}
              </p>
              <div className="px-2 space-y-0.5">
                {group.items.map(({ label, href, icon: Icon }) => (
                  <NavLink
                    key={href}
                    to={withCompanyQuery(href, companyId)}
                    onClick={() => onNavigate?.()}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors duration-100',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/40',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                        <span className="truncate">{label}</span>
                        {isActive && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-2 border-t border-sidebar-border pt-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => onNavigate?.()}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-sidebar-foreground/40 min-h-[44px] md:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring rounded w-full"
          >
            <ChevronLeft className="w-3 h-3" />
            <span className="md:hidden">Close menu</span>
            <span className="hidden md:inline">Collapse</span>
          </button>
        </div>
      </aside>

      {/* Invite client modal */}
      {inviteOpen && (
        <InviteClientModal
          companyId={companyId}
          onClose={() => setInviteOpen(false)}
        />
      )}
    </>
  )
}
