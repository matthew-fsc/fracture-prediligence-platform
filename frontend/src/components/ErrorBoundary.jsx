import { Component } from 'react'

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
    const stack = this.state.error?.stack || ''

    return (
      <div style={{ minHeight: '100vh', background: '#c00', padding: '24px', fontFamily: 'monospace' }}>
        <pre style={{ color: '#fff', fontSize: 13, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '0 0 16px 0' }}>
          {'[React Error] ' + msg + '\n\n' + stack}
        </pre>
        <button
          onClick={this.handleReload}
          style={{ background: '#fff', color: '#c00', border: 'none', borderRadius: 6, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          Reload
        </button>
      </div>
    )
  }
}
