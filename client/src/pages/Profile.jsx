import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login', { replace: true })
        return
      }
      const { data, error: err } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (err && err.code !== 'PGRST116') {
        setError(err.message)
        setLoading(false)
        return
      }
      setProfile(data || { id: user.id, email: user.email, full_name: '', avatar_url: '' })
      setFullName(data?.full_name ?? user.user_metadata?.full_name ?? '')
      setAvatarUrl(data?.avatar_url ?? user.user_metadata?.avatar_url ?? '')
      setLoading(false)
    }
    load()
  }, [navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error: err } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email: user.email,
          full_name: fullName || null,
          avatar_url: avatarUrl || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setProfile((p) => ({ ...p, full_name: fullName, avatar_url: avatarUrl }))
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <p className="text-slate-400">Loading profile...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl bg-slate-800 p-8 shadow-xl">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Your profile</h2>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-sm text-slate-400 hover:text-white"
          >
            Sign out
          </button>
        </div>
        {profile?.avatar_url && (
          <div className="mb-6 flex justify-center">
            <img
              src={profile.avatar_url}
              alt="Avatar"
              className="w-24 h-24 rounded-full object-cover"
            />
          </div>
        )}
        {error && (
          <p className="mb-4 text-red-400 text-sm">{error}</p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-slate-300 mb-1">
              Full name
            </label>
            <input
              id="full_name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Your name"
            />
          </div>
          <div>
            <label htmlFor="avatar_url" className="block text-sm font-medium text-slate-300 mb-1">
              Avatar URL
            </label>
            <input
              id="avatar_url"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="https://..."
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save profile'}
          </button>
        </form>
        {profile?.email && (
          <p className="mt-4 text-slate-400 text-sm">Email: {profile.email}</p>
        )}
      </div>
    </div>
  )
}
