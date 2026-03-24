import { Link } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'

const COLORS = { bg: '#0A1628', gold: '#C9973A', muted: '#8A9BB0', offWhite: '#F0EDE8', border: '#1E3A5F' }

export default function NotFoundPage() {
  usePageTitle('404 — Page Not Found')

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
      {/* Logo */}
      <div style={{ background: COLORS.gold, borderRadius: 6, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
        <span style={{ color: COLORS.bg, fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 20 }}>F</span>
      </div>

      {/* 404 */}
      <p style={{ color: COLORS.gold, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>
        404
      </p>
      <h1 style={{ color: COLORS.offWhite, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(36px, 6vw, 60px)', fontWeight: 700, margin: '0 0 16px 0', lineHeight: 1.1 }}>
        Page not found.
      </h1>
      <p style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 16, lineHeight: 1.7, maxWidth: 400, margin: '0 auto 36px' }}>
        The page you're looking for doesn't exist or has been moved.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link
          to="/"
          style={{ background: COLORS.gold, color: COLORS.bg, fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 14, padding: '12px 28px', borderRadius: 8, textDecoration: 'none' }}
        >
          Go Home →
        </Link>
        <Link
          to="/demo"
          style={{ border: `1.5px solid ${COLORS.gold}`, color: COLORS.gold, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, padding: '12px 28px', borderRadius: 8, textDecoration: 'none' }}
        >
          View Demo
        </Link>
      </div>
    </div>
  )
}
