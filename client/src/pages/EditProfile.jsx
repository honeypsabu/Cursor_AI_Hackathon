import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { INTEREST_OPTIONS } from '../constants/interests'
import { GENDER_OPTIONS, LANGUAGE_OPTIONS } from '../constants/profile'

const AVATAR_BUCKET = 'avatars'

async function geocodeAddress(postal, city, country) {
  const p = (v) => (v || '').trim()
  const postalStr = p(postal)
  const cityStr = p(city)
  const countryStr = p(country)
  if (!postalStr && !cityStr && !countryStr) return null

  // Build query: postal code + city + country for best match
  const parts = [postalStr, cityStr, countryStr].filter(Boolean)
  const query = parts.join(', ')

  // 1. Try Photon first – better for postal-code-level results (returns actual postal-code area)
  try {
    const photonParams = new URLSearchParams({ q: query, limit: 5 })
    const photonRes = await fetch(`https://photon.komoot.io/api/?${photonParams}`)
    const photonData = await photonRes.json()
    if (photonData?.features?.length > 0) {
      // Prefer result whose postcode matches or starts with user's postal code
      const norm = (s) => (s || '').replace(/\s/g, '').toLowerCase()
      const userPostal = norm(postalStr)
      const match = photonData.features.find(
        (f) => userPostal && norm(f.properties?.postcode || '').startsWith(userPostal)
      ) || photonData.features.find(
        (f) => userPostal && norm(f.properties?.postcode || '').includes(userPostal)
      )
      const feat = match || photonData.features[0]
      const [lng, lat] = feat.geometry.coordinates
      return { lat, lng }
    }
  } catch (_) {}

  // 2. Fallback to Nominatim with structured params
  try {
    const params = new URLSearchParams({ format: 'json', limit: 1 })
    if (postalStr) params.set('postalcode', postalStr)
    if (cityStr) params.set('city', cityStr)
    if (countryStr) params.set('country', countryStr)
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'GlimmerApp/1.0' },
    })
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    }
  } catch (_) {}

  // 3. Fallback to Nominatim free-form query
  try {
    const params = new URLSearchParams({ q: query, format: 'json', limit: 1 })
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'GlimmerApp/1.0' },
    })
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    }
  } catch (_) {}

  return null
}

export default function EditProfile() {
  const [profile, setProfile] = useState(null)
  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [status, setStatus] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('')
  const [selectedLanguages, setSelectedLanguages] = useState([])
  const [selectedInterests, setSelectedInterests] = useState([])
  const [addressPostal, setAddressPostal] = useState('')
  const [addressCity, setAddressCity] = useState('')
  const [addressCountry, setAddressCountry] = useState('')
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
      const addrParts = (data?.address || '').split('|')
      if (addrParts.length >= 4) {
        setAddressPostal(addrParts[2] || '')
        setAddressCity(addrParts[1] || '')
        setAddressCountry(addrParts[3] || '')
      } else if (addrParts.length >= 3) {
        setAddressPostal(addrParts[0] || '')
        setAddressCity(addrParts[1] || '')
        setAddressCountry(addrParts[2] || '')
      }
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
    let locationLat = null
    let locationLng = null
    if ([addressPostal, addressCity, addressCountry].some(Boolean)) {
      const coords = await geocodeAddress(addressPostal, addressCity, addressCountry)
      if (coords) {
        locationLat = coords.lat
        locationLng = coords.lng
      }
    }
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
          address: [addressPostal, addressCity, addressCountry].some(Boolean)
            ? [addressPostal, addressCity, addressCountry].join('|')
            : null,
          location_lat: locationLat,
          location_lng: locationLng,
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
      address: [addressPostal, addressCity, addressCountry].some(Boolean)
        ? [addressPostal, addressCity, addressCountry].join('|')
        : null,
      location_lat: locationLat,
      location_lng: locationLng,
    }))
    navigate('/profile', { replace: true })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-text flex items-center justify-center">
        <p className="text-text-muted">Loading profile...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-text flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-text">Edit profile</h2>
          <Link
            to="/profile"
            className="text-sm text-text-muted hover:text-text"
          >
            Back to profile
          </Link>
        </div>
        {avatarUrl && (
          <div className="mb-6 flex justify-center">
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-24 h-24 rounded-full object-cover"
            />
          </div>
        )}
        {error && (
          <p className="mb-4 text-red-500 text-sm">{error}</p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Profile picture
            </label>
            <div className="flex flex-wrap gap-3 items-center">
              <label className="cursor-pointer px-4 py-2 rounded-lg bg-slate-100 border border-slate-200 hover:border-primary text-text text-sm font-medium">
                {uploading ? 'Uploading...' : 'Upload photo'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                />
              </label>
              <span className="text-text-muted text-sm">or paste URL below</span>
            </div>
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
              className="w-full px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-text placeholder-text-light focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="https://..."
            />
          </div>
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-text mb-1">
              Full name
            </label>
            <input
              id="full_name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-text placeholder-text-light focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Your name"
            />
          </div>
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-text mb-1">
              What do you wanna do?
            </label>
            <input
              id="status"
              type="text"
              value={status}
              onChange={(e) => setStatus(e.target.value.slice(0, 100))}
              maxLength={100}
              className="w-full px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-text placeholder-text-light focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="I wanna go for a walk"
            />
            <p className="text-text-muted text-xs mt-1">{status.length}/100</p>
          </div>
          <div>
            <label htmlFor="age" className="block text-sm font-medium text-text mb-1">
              Age
            </label>
            <input
              id="age"
              type="number"
              min={1}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-text placeholder-text-light focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Your age"
            />
          </div>
          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-text mb-1">
              Gender
            </label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-text focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {GENDER_OPTIONS.map((opt) => (
                <option key={opt.id || 'none'} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Area <span className="text-text-muted">(private — used for map)</span>
            </label>
            <input
              id="address_postal"
              type="text"
              value={addressPostal}
              onChange={(e) => setAddressPostal(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-text placeholder-text-light focus:outline-none focus:ring-2 focus:ring-primary mb-2"
              placeholder="Postal code"
            />
            <input
              id="address_city"
              type="text"
              value={addressCity}
              onChange={(e) => setAddressCity(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-text placeholder-text-light focus:outline-none focus:ring-2 focus:ring-primary mb-2"
              placeholder="City"
            />
            <input
              id="address_country"
              type="text"
              value={addressCountry}
              onChange={(e) => setAddressCountry(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-text placeholder-text-light focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Country"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-2">
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
            className="w-full py-3 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium disabled:opacity-50"
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
