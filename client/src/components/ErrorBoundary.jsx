import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'system-ui, sans-serif',
          background: '#FFFFFF',
          color: '#1E293B',
        }}>
          <h1 style={{ fontSize: 18, marginBottom: 8, color: '#8B5CF6' }}>Something went wrong</h1>
          <pre style={{
            padding: 16,
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            overflow: 'auto',
            fontSize: 12,
            maxWidth: '100%',
          }}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}
