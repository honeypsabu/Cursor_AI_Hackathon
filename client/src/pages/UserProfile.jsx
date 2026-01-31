import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { INTEREST_OPTIONS } from '../constants/interests'
import { GENDER_OPTIONS, LANGUAGE_OPTIONS } from '../constants/profile'

function interestLabel(id) {
  return INTEREST_OPTIONS.find((o) => o.id === id)?.label ?? id
}
function languageLabel(id) {
  return LANGUAGE_OPTIONS.find((o) => o.id === id)?.label ?? id
}
function genderLabel(id) {
  return GENDER_OPTIONS.find((o) => o.id === id)?.label ?? id
}

export default function UserProfile() {
  const { userId } = useParams()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!userId) return
    async function load() {
      const { data, error: err } = await supabase.rpc('get_public_profile', { p_user_id: userId })
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      const row = Array.isArray(data) && data[0] ? data[0] : null
      setProfile(row)
      setLoading(false)
    }
    load()
  }, [userId])

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-text flex items-center justify-center">
        <p className="text-text-muted">Loading profile...</p>
      </div>
    )
  }
  if (error || !profile) {
    return (
      <div className="min-h-screen bg-white text-text flex flex-col items-center justify-center px-4 gap-4">
        <p className="text-text-muted text-center">{error || 'Profile not found'}</p>
        <Link to="/groups" className="text-primary hover:text-primary-hover font-medium">Back to groups</Link>
      </div>
    )
  }

  const interests = Array.isArray(profile.interests) ? profile.interests : []
  const languages = Array.isArray(profile.languages) ? profile.languages : []

  return (
    <div className="min-h-screen bg-white text-text px-4 py-8">
      <div className="max-w-md mx-auto">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-text-muted hover:text-text text-sm mb-6 inline-block"
        >
          ← Back
        </button>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center text-center mb-6">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="w-24 h-24 rounded-full object-cover mb-3"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-3xl font-medium text-primary mb-3">
                {(profile.full_name || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <h1 className="text-xl font-semibold text-text">
              {profile.full_name || 'Someone'}
            </h1>
          </div>
          {profile.status?.trim() && (
            <div className="mb-4">
              <p className="text-text-muted text-sm font-medium mb-1">What do they want to do?</p>
              <p className="text-text">{profile.status.trim()}</p>
            </div>
          )}
          <div className="space-y-3 text-sm">
            {profile.age != null && (
              <p><span className="text-text-muted">Age:</span> {profile.age}</p>
            )}
            {profile.gender && (
              <p><span className="text-text-muted">Gender:</span> {genderLabel(profile.gender)}</p>
            )}
            {languages.length > 0 && (
              <p><span className="text-text-muted">Languages:</span> {languages.map(languageLabel).join(', ')}</p>
            )}
            {interests.length > 0 && (
              <div>
                <p className="text-text-muted mb-2">Interests</p>
                <div className="flex flex-wrap gap-2">
                  {interests.map((id) => (
                    <span
                      key={id}
                      className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs"
                    >
                      {interestLabel(id)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
