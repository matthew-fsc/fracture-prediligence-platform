/**
 * RoleSelectPage — shown on first login when the user has no role yet.
 * User chooses: "I'm an M&A Advisor" or "I'm a Business Owner (Client)".
 * Posts to POST /api/me and then redirects to the appropriate portal.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Building2, ArrowRight, Loader2 } from 'lucide-react'
import { apiClient } from '../lib/apiClient'
import { useUserRole } from '../context/UserRoleContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { cn } from '../lib/utils'
import { marketingColors } from '../theme/marketingColors'

export default function RoleSelectPage() {
  usePageTitle('Welcome - Select Your Role')
  const navigate = useNavigate()
  const { refreshProfile } = useUserRole()
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleContinue() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      await apiClient.post('/api/me', { role: selected })
      await refreshProfile()
      // New advisors go to onboarding wizard; returning sign-ins go to /auth-redirect.
      // New clients wait for an advisor invite — send them to the waiting state.
      navigate(selected === 'ADVISOR' ? '/dashboard/onboarding' : '/client/dashboard', { replace: true })
    } catch (err) {
      setError(err?.message ?? 'Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background dark flex flex-col items-center justify-center p-6">
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: marketingColors.gold }}>
          <span className="font-bold text-lg" style={{ color: marketingColors.bg }}>F</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Pre-Diligence Platform</p>
          <p className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground">Fracture Systems</p>
        </div>
      </div>

      <h1 className="text-3xl font-semibold text-foreground text-center mb-2">Welcome to the Platform</h1>
      <p className="text-sm text-muted-foreground text-center max-w-[440px] mb-10 leading-relaxed">
        Tell us who you are so we can set up the right workspace for you.
      </p>

      <div className="w-full max-w-[760px] grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <RoleCard
          icon={<Briefcase size={28} />}
          title="M&A Advisor / CEPA"
          description="I advise business owners through exit planning, diligence preparation, and sale execution."
          bullets={[
            'Upload and analyze business data',
            'Generate Diligence Readiness Scores',
            'Create client reports and roadmaps',
            'Invite clients to view their portal',
          ]}
          selected={selected === 'ADVISOR'}
          onSelect={() => setSelected('ADVISOR')}
        />
        <RoleCard
          icon={<Building2 size={28} />}
          title="Business Owner"
          description="I own or operate a business and I am working with an advisor toward a liquidity event or exit."
          bullets={[
            "View my company's readiness score",
            'See my enterprise value range',
            'Track value-creation initiatives',
            'Share my goals and exit preferences',
          ]}
          selected={selected === 'CLIENT'}
          onSelect={() => setSelected('CLIENT')}
        />
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      <button
        onClick={handleContinue}
        disabled={!selected || saving}
        className={cn(
          'inline-flex items-center justify-center gap-2 min-w-[180px] rounded-lg px-8 py-3 text-sm font-semibold transition-colors',
          selected && !saving
            ? 'text-black'
            : 'bg-muted text-muted-foreground cursor-not-allowed',
        )}
        style={selected && !saving ? { background: marketingColors.gold } : undefined}
      >
        {saving ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Setting up...
          </>
        ) : (
          <>
            Continue
            <ArrowRight size={16} />
          </>
        )}
      </button>
    </div>
  )
}

function RoleCard({ icon, title, description, bullets, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative text-left rounded-xl border p-6 transition-all bg-card',
        selected ? 'border-primary/40 bg-primary/10 ring-1 ring-primary/25' : 'border-border hover:bg-muted/20',
      )}
      style={selected ? { borderColor: `${marketingColors.gold}66`, background: 'rgba(201, 151, 58, 0.10)' } : undefined}
    >
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: marketingColors.gold }}>
          <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
            <path d="M1 4L4 7L10 1" stroke={marketingColors.bg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      <div className="mb-4" style={{ color: selected ? marketingColors.gold : undefined }}>{icon}</div>
      <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">{description}</p>

      <ul className="m-0 p-0 list-none space-y-1.5">
        {bullets.map((b) => (
          <li key={b} className={cn('flex items-start gap-2 text-xs', selected ? 'text-foreground/85' : 'text-muted-foreground')}>
            <span className={cn('mt-[2px]', selected ? '' : 'text-muted-foreground/60')} style={selected ? { color: marketingColors.gold } : undefined}>•</span>
            {b}
          </li>
        ))}
      </ul>
    </button>
  )
}
