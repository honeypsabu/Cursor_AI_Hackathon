import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { INTEREST_OPTIONS } from '../constants/interests'
import { GENDER_OPTIONS, LANGUAGE_OPTIONS } from '../constants/profile'

export default function ViewProfile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingStatus, setEditingStatus] = useState(false)
  const [editingInterests, setEditingInterests] = useState(false)
  const [localStatus, setLocalStatus] = useState('')
  const [localInterests, setLocalInterests] = useState([])
  const [savingStatus, setSavingStatus] = useState(false)
  const [savingInterests, setSavingInterests] = useState(false)
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
      setLoading(false)
    }
    load()
  }, [navigate])

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  async function saveStatus() {
    if (!profile?.id) return
    setSavingStatus(true)
    setError('')
    const value = localStatus.trim() || null
    const { error: err } = await supabase
      .from('profiles')
      .update({ status: value, updated_at: new Date().toISOString() })
      .eq('id', profile.id)
    setSavingStatus(false)
    if (err) {
      setError(err.message)
      return
    }
    setProfile((p) => ({ ...p, status: value ?? '' }))
    setEditingStatus(false)
  }

  function cancelStatus() {
    setLocalStatus(profile?.status ?? '')
    setEditingStatus(false)
  }

  async function saveInterests() {
    if (!profile?.id) return
    setSavingInterests(true)
    setError('')
    const { error: err } = await supabase
      .from('profiles')
      .update({ interests: localInterests, updated_at: new Date().toISOString() })
      .eq('id', profile.id)
    setSavingInterests(false)
    if (err) {
      setError(err.message)
      return
    }
    setProfile((p) => ({ ...p, interests: localInterests }))
    setEditingInterests(false)
  }

  function cancelInterests() {
    setLocalInterests(Array.isArray(profile?.interests) ? [...profile.interests] : [])
    setEditingInterests(false)
  }

  function openStatusEdit() {
    setLocalStatus(profile?.status ?? '')
    setEditingStatus(true)
  }

  function openInterestsEdit() {
    setLocalInterests(Array.isArray(profile?.interests) ? [...profile.interests] : [])
    setEditingInterests(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <p className="text-slate-400">Loading profile...</p>
      </div>
    )
  }

  const interests = Array.isArray(profile?.interests) ? profile.interests : []
  const interestLabels = interests.map(
    (id) => INTEREST_OPTIONS.find((o) => o.id === id)?.label ?? id
  )
  const languages = Array.isArray(profile?.languages) ? profile.languages : []
  const languageLabels = languages.map(
    (id) => LANGUAGE_OPTIONS.find((o) => o.id === id)?.label ?? id
  )
  const genderLabel = profile?.gender ? (GENDER_OPTIONS.find((o) => o.id === profile.gender)?.label ?? profile.gender) : null
  const hasDetails = profile?.age != null || genderLabel || languageLabels.length > 0

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl bg-slate-800 p-8 shadow-xl">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Your profile</h2>
          <div className="flex items-center gap-3">
            <Link
              to="/profile/edit"
              className="text-sm text-emerald-400 hover:text-emerald-300 font-medium"
            >
              Edit profile
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-sm text-slate-400 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
        {error && (
          <p className="mb-4 text-red-400 text-sm">{error}</p>
        )}
        <div className="flex flex-col items-center text-center mb-8">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt="Profile"
              className="w-28 h-28 rounded-full object-cover mb-4"
            />
          ) : (
            <div className="w-28 h-28 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-2xl font-medium mb-4">
              {profile?.full_name?.charAt(0)?.toUpperCase() || profile?.email?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
          <h3 className="text-xl font-semibold text-white">
            {profile?.full_name || 'No name set'}
          </h3>
          {profile?.email && (
            <p className="text-slate-400 text-sm mt-1">{profile.email}</p>
          )}
        </div>
        {hasDetails && (
          <div className="mb-6 flex flex-wrap gap-4 justify-center text-sm text-slate-300">
            {profile?.age != null && <span>Age: {profile.age}</span>}
            {genderLabel && <span>Gender: {genderLabel}</span>}
            {languageLabels.length > 0 && (
              <span>Languages: {languageLabels.join(', ')}</span>
            )}
          </div>
        )}
        {!editingInterests && (
        <div className="mb-6">
          <p className="text-sm font-medium text-slate-300 mb-1">What do you wanna do?</p>
          {editingStatus ? (
            <div className="space-y-2">
              <input
                type="text"
                value={localStatus}
                onChange={(e) => setLocalStatus(e.target.value.slice(0, 100))}
                maxLength={100}
                placeholder="I wanna go for a walk"
                className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
              <p className="text-slate-400 text-xs">{localStatus.length}/100</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveStatus}
                  disabled={savingStatus}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-sm font-medium disabled:opacity-50"
                >
                  {savingStatus ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={cancelStatus}
                  disabled={savingStatus}
                  className="px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-sm font-medium hover:border-slate-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : profile?.status ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-white text-sm bg-slate-700/50 rounded-lg px-4 py-3 border border-slate-600 flex-1">
                {profile.status}
              </p>
              <button
                type="button"
                onClick={openStatusEdit}
                className="text-sm text-emerald-400 hover:text-emerald-300 font-medium shrink-0"
              >
                Edit
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openStatusEdit}
              className="text-slate-400 text-sm hover:text-emerald-400"
            >
              Add something
            </button>
          )}
        </div>
        )}
        {!editingStatus && (
        <div className="mb-6">
          <p className="text-sm font-medium text-slate-300 mb-2">Interests</p>
          {editingInterests ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((opt) => {
                  const selected = localInterests.includes(opt.id)
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setLocalInterests((prev) =>
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
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveInterests}
                  disabled={savingInterests}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-sm font-medium disabled:opacity-50"
                >
                  {savingInterests ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={cancelInterests}
                  disabled={savingInterests}
                  className="px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-sm font-medium hover:border-slate-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : interestLabels.length > 0 ? (
            <div className="flex flex-wrap gap-2 justify-center items-center">
              {interestLabels.map((label) => (
                <span
                  key={label}
                  className="px-3 py-1.5 rounded-full text-sm bg-slate-700 text-slate-300 border border-slate-600"
                >
                  {label}
                </span>
              ))}
              <button
                type="button"
                onClick={openInterestsEdit}
                className="text-sm text-emerald-400 hover:text-emerald-300 font-medium"
              >
                Edit
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openInterestsEdit}
              className="text-slate-400 text-sm hover:text-emerald-400"
            >
              Add some
            </button>
          )}
        </div>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/profile/map"
            className="px-6 py-3 rounded-lg border border-slate-600 hover:bg-slate-700 font-medium transition"
          >
            View my area on map
          </Link>
          <Link
            to="/profile/edit"
            className="px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 font-medium transition"
          >
            Edit profile
          </Link>
        </div>
      </div>
    </div>
  )
}
