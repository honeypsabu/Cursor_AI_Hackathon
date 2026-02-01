import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Groups() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login', { replace: true })
        return
      }
      const { data } = await supabase.rpc('get_my_groups')
      setGroups(Array.isArray(data) ? data : [])
      setLoading(false)
    }
    load()
  }, [navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-text flex items-center justify-center">
        <p className="text-text-muted">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-text">
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-text">Groups</h2>
          <Link to="/profile" className="text-sm text-primary hover:text-primary-hover font-medium">
            Back to profile
          </Link>
        </div>
        <div>
          <h3 className="text-sm font-medium text-text-muted mb-3">Your groups</h3>
          {groups.length === 0 ? (
            <p className="text-text-muted text-sm py-4">No groups yet. Accept an invite from your notifications to join a group.</p>
          ) : (
            <div className="space-y-2">
              {groups.map((g, i) => (
                <Link
                  key={g?.group_id ?? i}
                  to={`/groups/${g?.group_id ?? ''}`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 hover:border-primary/50 hover:bg-slate-50 transition"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl shrink-0">
                    👥
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text truncate">{g?.group_name ?? 'Unnamed group'}</p>
                    <p className="text-text-muted text-sm truncate">{g?.group_activity ?? (g?.member_count != null ? `${g.member_count} members` : '')}</p>
                  </div>
                  <span className="text-slate-400 shrink-0">→</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
