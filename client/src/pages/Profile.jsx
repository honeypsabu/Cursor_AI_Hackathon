import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { INTEREST_OPTIONS } from '../constants/interests'

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [selectedInterests, setSelectedInterests] = useState([])
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
      setProfile(data || { id: user.id, email: user.email, full_name: '', avatar_url: '', interests: [] })
      setFullName(data?.full_name ?? user.user_metadata?.full_name ?? '')
      setAvatarUrl(data?.avatar_url ?? user.user_metadata?.avatar_url ?? '')
      setSelectedInterests(Array.isArray(data?.interests) ? data.interests : [])
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
          interests: selectedInterests.length ? selectedInterests : [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setProfile((p) => ({ ...p, full_name: fullName, avatar_url: avatarUrl, interests: selectedInterests }))
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-text flex items-center justify-center">
        <p className="text-text-muted">Loading profile...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-text flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-text">Your profile</h2>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-sm text-text-muted hover:text-text transition"
          >
            Sign out
          </button>
        </div>
        {profile?.avatar_url && (
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="w-24 h-24 rounded-full object-cover ring-2 ring-primary"
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-primary rounded-full border-2 border-white" title="Online" />
            </div>
          </div>
        )}
        {error && (
          <p className="mb-4 text-red-500 text-sm">{error}</p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-text mb-1">
              Full name
            </label>
            <input
              id="full_name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-background border border-slate-200 text-text placeholder-text-light focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Your name"
            />
          </div>
          <div>
            <label htmlFor="avatar_url" className="block text-sm font-medium text-text mb-1">
              Avatar URL
            </label>
            <input
              id="avatar_url"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-background border border-slate-200 text-text placeholder-text-light focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Choose your interests
            </label>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((opt) => {
                const selected = selectedInterests.includes(opt.id)
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedInterests((prev) =>
                        prev.includes(opt.id) ? prev.filter((id) => id !== opt.id) : [...prev, opt.id]
                      )
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                      selected
                        ? 'bg-primary text-white'
                        : 'bg-slate-100 text-text border border-slate-200 hover:border-primary/50'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium disabled:opacity-50 transition"
          >
            {saving ? 'Saving...' : 'Save profile'}
          </button>
        </form>
        {profile?.email && (
          <p className="mt-4 text-text-muted text-sm">Email: {profile.email}</p>
        )}
      </div>
    </div>
  )
}
