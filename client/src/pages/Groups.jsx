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
        <p className="text-text-muted">Loading groups...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-text px-4 pt-6 pb-10">
      <div className="w-full max-w-md mx-auto rounded-xl bg-white p-8 shadow-xl border border-slate-200">
        <h1 className="text-2xl font-bold text-text mb-6">Groups</h1>
        {groups.length === 0 ? (
          <p className="text-text-muted">No groups yet. Accept an invite from your notifications to join a group.</p>
        ) : (
          <ul className="space-y-3">
            {groups.map((g, i) => (
              <li key={g?.group_id ?? i}>
                <Link
                  to={`/groups/${g?.group_id ?? ''}`}
                  className="block p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-primary/30 hover:bg-slate-50/80 transition text-text"
                >
                  <p className="font-medium text-text">{g?.group_name ?? 'Unnamed group'}</p>
                  <p className="text-text-muted text-sm mt-1">{g?.group_activity ?? (g?.member_count != null ? `${g.member_count} members` : '')}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
