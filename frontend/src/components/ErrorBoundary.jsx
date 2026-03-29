import { Component } from 'react'

const COLORS = { bg: '#0A1628', gold: '#C9973A', muted: '#8A9BB0', text: '#E8EAED' }

/**
 * Top-level error boundary — catches render errors in any child tree.
 * In production a blank screen is otherwise shown when React unmounts on an uncaught throw.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReload() {
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    const msg = this.state.error?.message || 'An unexpected error occurred.'

    return (
      <div
        style={{
          minHeight: '100vh',
          background: COLORS.bg,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          textAlign: 'center',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div
          style={{
            background: COLORS.gold,
            borderRadius: 8,
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <span style={{ color: COLORS.bg, fontWeight: 700, fontSize: 22 }}>!</span>
        </div>
        <h2
          style={{
            color: COLORS.text,
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 24,
            fontWeight: 600,
            margin: '0 0 10px 0',
          }}
        >
          Something went wrong
        </h2>
        <p
          style={{
            color: COLORS.muted,
            fontSize: 14,
            lineHeight: 1.6,
            maxWidth: 400,
            margin: '0 0 28px 0',
          }}
        >
          {msg}
        </p>
        <button
          onClick={this.handleReload}
          style={{
            background: COLORS.gold,
            color: COLORS.bg,
            border: 'none',
            borderRadius: 6,
            padding: '10px 24px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Reload page
        </button>
      </div>
    )
  }
}
