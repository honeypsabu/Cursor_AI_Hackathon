import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const hasEnv = supabaseUrl && supabaseKey

function Root() {
  if (!hasEnv) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: 'system-ui, sans-serif',
        background: '#0f172a',
        color: '#e2e8f0',
        textAlign: 'center',
      }}>
        <h1 style={{ fontSize: 18, marginBottom: 8 }}>Missing configuration</h1>
        <p style={{ marginBottom: 16, maxWidth: 400 }}>
          Add <code style={{ background: '#1e293b', padding: '2px 6px', borderRadius: 4 }}>VITE_SUPABASE_URL</code> and{' '}
          <code style={{ background: '#1e293b', padding: '2px 6px', borderRadius: 4 }}>VITE_SUPABASE_ANON_KEY</code> to{' '}
          <code style={{ background: '#1e293b', padding: '2px 6px', borderRadius: 4 }}>client/.env</code> for local dev.
        </p>
        <p style={{ fontSize: 14, color: '#94a3b8' }}>Get these from Supabase Dashboard → Project Settings → API.</p>
      </div>
    )
  }

  return (
    <React.StrictMode>
      <BrowserRouter>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </BrowserRouter>
    </React.StrictMode>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />)
