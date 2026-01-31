import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { INTEREST_OPTIONS } from '../constants/interests'
import { GENDER_OPTIONS, LANGUAGE_OPTIONS } from '../constants/profile'

const AVATAR_BUCKET = 'avatars'

export default function EditProfile() {
  const [profile, setProfile] = useState(null)
  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [status, setStatus] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('')
  const [selectedLanguages, setSelectedLanguages] = useState([])
  const [selectedInterests, setSelectedInterests] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
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
      setProfile(data || { id: user.id, email: user.email, full_name: '', avatar_url: '', status: '', interests: [], age: null, gender: '', languages: [] })
      setFullName(data?.full_name ?? user.user_metadata?.full_name ?? '')
      setAvatarUrl(data?.avatar_url ?? user.user_metadata?.avatar_url ?? '')
      setStatus(data?.status ?? '')
      setAge(data?.age != null ? String(data.age) : '')
      setGender(data?.gender ?? '')
      setSelectedLanguages(Array.isArray(data?.languages) ? data.languages : [])
      setSelectedInterests(Array.isArray(data?.interests) ? data.interests : [])
      setLoading(false)
    }
    load()
  }, [navigate])

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !profile?.id) return
    setError('')
    setUploading(true)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${profile.id}/${Date.now()}.${ext}`
    const { data, error: uploadErr } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, { upsert: true })
    setUploading(false)
    if (uploadErr) {
      setError(uploadErr.message)
      return
    }
    const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(data.path)
    setAvatarUrl(urlData.publicUrl)
  }

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
          status: status?.trim() || null,
          age: age !== '' ? (parseInt(age, 10) || null) : null,
          gender: gender || null,
          languages: selectedLanguages.length ? selectedLanguages : [],
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
    setProfile((p) => ({
      ...p,
      full_name: fullName,
      avatar_url: avatarUrl,
      status: status?.trim() || '',
      age: age !== '' ? parseInt(age, 10) : null,
      gender: gender || '',
      languages: selectedLanguages,
      interests: selectedInterests,
    }))
    navigate('/profile', { replace: true })
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
          <h2 className="text-2xl font-bold">Edit profile</h2>
          <Link
            to="/profile"
            className="text-sm text-slate-400 hover:text-white"
          >
            Back to profile
          </Link>
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
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Profile picture
            </label>
            <div className="flex flex-wrap gap-3 items-center">
              <label className="cursor-pointer px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 hover:border-slate-500 text-sm font-medium">
                {uploading ? 'Uploading...' : 'Upload photo'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                />
              </label>
              <span className="text-slate-400 text-sm">or paste URL below</span>
            </div>
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
            <label htmlFor="status" className="block text-sm font-medium text-slate-300 mb-1">
              What do you wanna do?
            </label>
            <input
              id="status"
              type="text"
              value={status}
              onChange={(e) => setStatus(e.target.value.slice(0, 100))}
              maxLength={100}
              className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="I wanna go for a walk"
            />
            <p className="text-slate-400 text-xs mt-1">{status.length}/100</p>
          </div>
          <div>
            <label htmlFor="age" className="block text-sm font-medium text-slate-300 mb-1">
              Age
            </label>
            <input
              id="age"
              type="number"
              min={1}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Your age"
            />
          </div>
          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-slate-300 mb-1">
              Gender
            </label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {GENDER_OPTIONS.map((opt) => (
                <option key={opt.id || 'none'} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Languages I speak
            </label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map((opt) => {
                const selected = selectedLanguages.includes(opt.id)
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedLanguages((prev) =>
                        prev.includes(opt.id) ? prev.filter((id) => id !== opt.id) : [...prev, opt.id]
                      )
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                      selected
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-700 text-slate-300 border border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
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
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-700 text-slate-300 border border-slate-600 hover:border-slate-500'
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
