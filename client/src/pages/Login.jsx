import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/profile'

  async function handleEmailLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    navigate(from, { replace: true })
  }

  async function handleGoogleLogin() {
    setError('')
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${from}` },
    })
    if (err) setError(err.message)
  }

  return (
    <div className="min-h-screen bg-background text-text flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-xl border border-slate-200">
        <h2 className="text-2xl font-bold mb-6 text-text">Log in</h2>
        {error && (
          <p className="mb-4 text-red-500 text-sm">{error}</p>
        )}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full py-3 rounded-lg border-2 border-primary text-primary hover:bg-primary hover:text-white font-medium mb-6 flex items-center justify-center gap-2 transition"
        >
          Sign in with Google
        </button>
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-text-muted">or</span>
          </div>
        </div>
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-lg bg-background border border-slate-200 text-text placeholder-text-light focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-lg bg-background border border-slate-200 text-text placeholder-text-light focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium disabled:opacity-50 transition"
          >
            {loading ? 'Logging in...' : 'Log in with Email'}
          </button>
        </form>
        <p className="mt-6 text-center text-text-muted text-sm">
          No account?{' '}
          <Link to="/signup" className="text-primary hover:underline font-medium">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
