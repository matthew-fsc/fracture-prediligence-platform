const GOLD = '#C9973A'
const DARK = '#0A1628'

export default function DemoBanner({ onClaim, spotsRemaining }) {
  return (
    <div
      style={{
        background: GOLD,
        color: DARK,
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        position: 'sticky',
        top: 0,
        zIndex: 60,
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          fontWeight: 500,
          color: DARK,
        }}
      >
        ⚡ You're viewing a live demo —{' '}
        <strong>
          {spotsRemaining != null ? spotsRemaining : 20} Founding Advisor spots available at $179/mo
        </strong>
      </p>

      <button
        onClick={onClaim}
        style={{
          background: DARK,
          color: '#F0EDE8',
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 600,
          fontSize: 13,
          padding: '8px 20px',
          borderRadius: 6,
          border: 'none',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Claim Your Spot
      </button>
    </div>
  )
}
