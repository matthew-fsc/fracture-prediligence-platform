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

const C = {
  bg:     '#0A1628',
  gold:   '#C9973A',
  muted:  '#8A9BB0',
  text:   '#F0EDE8',
  card:   '#0F1E35',
  border: '#1E3050',
}

export default function RoleSelectPage() {
  usePageTitle('Welcome — Select Your Role')
  const navigate = useNavigate()
  const { refreshProfile } = useUserRole()
  const [selected, setSelected] = useState(null)  // 'ADVISOR' | 'CLIENT'
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleContinue() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      await apiClient.post('/api/me', { role: selected })
      await refreshProfile()
      navigate(selected === 'ADVISOR' ? '/Home' : '/client/dashboard', { replace: true })
    } catch (err) {
      setError(err?.message ?? 'Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
        <div
          style={{
            background: C.gold,
            borderRadius: 8,
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              color: C.bg,
              fontFamily: 'Georgia, serif',
              fontWeight: 700,
              fontSize: 20,
            }}
          >
            F
          </span>
        </div>
        <div>
          <p
            style={{
              color: C.text,
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 600,
              fontSize: 15,
              margin: 0,
            }}
          >
            Pre-Diligence Platform
          </p>
          <p
            style={{
              color: C.muted,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              margin: 0,
            }}
          >
            Fracture Systems
          </p>
        </div>
      </div>

      {/* Heading */}
      <h1
        style={{
          color: C.text,
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 32,
          fontWeight: 600,
          margin: '0 0 8px 0',
          textAlign: 'center',
        }}
      >
        Welcome to the Platform
      </h1>
      <p
        style={{
          color: C.muted,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 15,
          margin: '0 0 40px 0',
          textAlign: 'center',
          maxWidth: 440,
          lineHeight: 1.6,
        }}
      >
        Tell us who you are so we can set up the right workspace for you.
      </p>

      {/* Role cards */}
      <div
        style={{
          display: 'flex',
          gap: 20,
          flexWrap: 'wrap',
          justifyContent: 'center',
          width: '100%',
          maxWidth: 700,
          marginBottom: 32,
        }}
      >
        <RoleCard
          roleKey="ADVISOR"
          icon={<Briefcase size={28} />}
          title="M&A Advisor / CEPA"
          description="I advise business owners through exit planning, diligence preparation, and sale execution."
          bullets={[
            'Upload & analyze business data',
            'Generate Diligence Readiness Scores',
            'Create client reports & roadmaps',
            'Invite clients to view their portal',
          ]}
          selected={selected === 'ADVISOR'}
          onSelect={() => setSelected('ADVISOR')}
          colors={C}
        />
        <RoleCard
          roleKey="CLIENT"
          icon={<Building2 size={28} />}
          title="Business Owner"
          description="I own or operate a business and I'm working with an advisor toward a liquidity event or exit."
          bullets={[
            "View my company's readiness score",
            'See my enterprise value range',
            'Track value-creation initiatives',
            'Share my goals & exit preferences',
          ]}
          selected={selected === 'CLIENT'}
          onSelect={() => setSelected('CLIENT')}
          colors={C}
        />
      </div>

      {/* Error */}
      {error && (
        <p
          style={{
            color: '#EF4444',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            margin: '0 0 16px 0',
          }}
        >
          {error}
        </p>
      )}

      {/* Continue button */}
      <button
        onClick={handleContinue}
        disabled={!selected || saving}
        style={{
          background: selected ? C.gold : '#1E3050',
          color: selected ? C.bg : C.muted,
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 600,
          fontSize: 14,
          border: 'none',
          borderRadius: 8,
          padding: '12px 32px',
          cursor: selected && !saving ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          transition: 'background 0.15s, color 0.15s',
          minWidth: 180,
          justifyContent: 'center',
        }}
      >
        {saving ? (
          <>
            <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
            Setting up…
          </>
        ) : (
          <>
            Continue
            <ArrowRight size={16} />
          </>
        )}
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function RoleCard({ roleKey, icon, title, description, bullets, selected, onSelect, colors: C }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        background: selected ? 'rgba(201, 151, 58, 0.08)' : C.card,
        border: `2px solid ${selected ? C.gold : C.border}`,
        borderRadius: 12,
        padding: '28px 24px',
        width: 300,
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
        outline: 'none',
        position: 'relative',
      }}
    >
      {/* Selected indicator */}
      {selected && (
        <div
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            width: 20,
            height: 20,
            background: C.gold,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
            <path d="M1 4L4 7L10 1" stroke="#0A1628" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      {/* Icon */}
      <div
        style={{
          color: selected ? C.gold : C.muted,
          marginBottom: 16,
          transition: 'color 0.15s',
        }}
      >
        {icon}
      </div>

      {/* Title */}
      <h3
        style={{
          color: C.text,
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 20,
          fontWeight: 600,
          margin: '0 0 8px 0',
        }}
      >
        {title}
      </h3>

      {/* Description */}
      <p
        style={{
          color: C.muted,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          lineHeight: 1.6,
          margin: '0 0 20px 0',
        }}
      >
        {description}
      </p>

      {/* Bullets */}
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {bullets.map((b) => (
          <li
            key={b}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              marginBottom: 6,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              color: selected ? '#A0B4C8' : C.muted,
            }}
          >
            <span style={{ color: selected ? C.gold : '#2E4060', marginTop: 2 }}>•</span>
            {b}
          </li>
        ))}
      </ul>
    </button>
  )
}
