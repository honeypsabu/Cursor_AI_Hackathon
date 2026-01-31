import { useState, useEffect } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ProtectedLayout() {
  const [inviteCount, setInviteCount] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchCount() {
      const { data } = await supabase.rpc('get_invite_count')
      setInviteCount(data ?? 0)
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    const onRefresh = () => fetchCount()
    window.addEventListener('refresh-invite-count', onRefresh)
    return () => {
      clearInterval(interval)
      window.removeEventListener('refresh-invite-count', onRefresh)
    }
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-white/95 border-b border-slate-200 backdrop-blur-sm shadow-sm">
        <Link to="/profile" className="text-lg font-semibold text-primary">
          Glimmer
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            to="/notifications"
            className="relative p-2 rounded-lg text-text-muted hover:text-text hover:bg-slate-50 transition-colors"
            aria-label={`${inviteCount} notifications`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {inviteCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                {inviteCount > 9 ? '9+' : inviteCount}
              </span>
            )}
          </Link>
          <Link
            to="/profile/map"
            className="px-3 py-2 rounded-lg text-text-muted hover:text-text hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            Map
          </Link>
          <Link
            to="/groups"
            className="px-3 py-2 rounded-lg text-text-muted hover:text-text hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            Groups
          </Link>
          <Link
            to="/profile"
            className="px-3 py-2 rounded-lg text-text-muted hover:text-text hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            Profile
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="px-3 py-2 rounded-lg text-text-light hover:text-text hover:bg-slate-50 transition-colors text-sm"
          >
            Sign out
          </button>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
