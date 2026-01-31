import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Circle, Marker, Popup, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import { INTEREST_OPTIONS } from '../constants/interests'
import { GENDER_OPTIONS, LANGUAGE_OPTIONS } from '../constants/profile'
import 'leaflet/dist/leaflet.css'

// Map keywords in "What do you want to do?" status to an emoji
const STATUS_EMOJI_KEYWORDS = [
  { keywords: ['walk', 'stroll', 'wander'], emoji: '🚶' },
  { keywords: ['run', 'jog'], emoji: '🏃' },
  { keywords: ['coffee', 'cafe', 'tea'], emoji: '☕' },
  { keywords: ['drink', 'bar', 'beer', 'wine'], emoji: '🍻' },
  { keywords: ['eat', 'food', 'lunch', 'dinner', 'brunch'], emoji: '🍽️' },
  { keywords: ['cook', 'baking', 'bake'], emoji: '🍳' },
  { keywords: ['read', 'book'], emoji: '📚' },
  { keywords: ['movie', 'film', 'cinema'], emoji: '🎬' },
  { keywords: ['music', 'concert', 'gig'], emoji: '🎵' },
  { keywords: ['game', 'gaming', 'play'], emoji: '🎮' },
  { keywords: ['hike', 'hiking', 'trail'], emoji: '🥾' },
  { keywords: ['bike', 'cycling', 'cycle'], emoji: '🚴' },
  { keywords: ['swim', 'beach', 'pool'], emoji: '🏊' },
  { keywords: ['yoga', 'gym', 'workout', 'exercise'], emoji: '💪' },
  { keywords: ['travel', 'trip', 'explore'], emoji: '✈️' },
  { keywords: ['art', 'museum', 'gallery', 'painting', 'workshop', 'craft', 'pottery', 'draw'], emoji: '🎨' },
  { keywords: ['chat', 'talk', 'hang', 'catch up'], emoji: '💬' },
  { keywords: ['study', 'focus'], emoji: '📖' },
  { keywords: ['work'], emoji: '💼' },
  { keywords: ['dog', 'pet', 'puppy'], emoji: '🐕' },
  { keywords: ['dance', 'party'], emoji: '💃' },
]

function getEmojiForStatus(status) {
  if (!status || typeof status !== 'string') return '✨'
  const lower = status.toLowerCase()
  for (const { keywords, emoji } of STATUS_EMOJI_KEYWORDS) {
    if (keywords.some((k) => lower.includes(k))) return emoji
  }
  return '✨'
}

function CenterMap({ center, zoom }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom)
  }, [map, center, zoom])
  return null
}

function roundToArea(lat, lng) {
  return [
    Math.round(lat * 100) / 100,
    Math.round(lng * 100) / 100,
  ]
}

export default function MapView() {
  const [profile, setProfile] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [otherUsers, setOtherUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login', { replace: true })
        return
      }
      setCurrentUserId(user.id)
      const { data: myProfile, error: err } = await supabase
        .from('profiles')
        .select('location_lat, location_lng, status')
        .eq('id', user.id)
        .single()
      if (err && err.code !== 'PGRST116') {
        setLoading(false)
        return
      }
      setProfile(myProfile || {})
      const { data: mapProfiles } = await supabase.rpc('get_profiles_for_map')
      setOtherUsers(Array.isArray(mapProfiles) ? mapProfiles : [])
      setLoading(false)
    }
    load()
  }, [navigate])

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900 text-white flex items-center justify-center z-50">
        <p className="text-slate-400">Loading map...</p>
      </div>
    )
  }

  const lat = profile?.location_lat
  const lng = profile?.location_lng
  const hasCoords = typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)

  if (!hasCoords) {
    return (
      <div className="fixed inset-0 bg-slate-900 text-white flex flex-col items-center justify-center z-50 px-4">
        <p className="text-slate-300 text-center mb-6 max-w-sm">
          Add your address in Edit Profile to see your area on the map.
        </p>
        <Link
          to="/profile"
          className="px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 font-medium"
        >
          Back to profile
        </Link>
      </div>
    )
  }

  const [areaLat, areaLng] = roundToArea(lat, lng)
  const center = [areaLat, areaLng]
  const status = profile?.status?.trim() || ''
  const emoji = getEmojiForStatus(status)

  const others = otherUsers.filter((u) => u.id !== currentUserId)

  function interestLabel(id) {
    return INTEREST_OPTIONS.find((o) => o.id === id)?.label ?? id
  }
  function genderLabel(id) {
    return GENDER_OPTIONS.find((o) => o.id === id)?.label ?? id
  }
  function languageLabel(id) {
    return LANGUAGE_OPTIONS.find((o) => o.id === id)?.label ?? id
  }

  function makeEmojiIcon(emojiChar) {
    return L.divIcon({
      html: `<span style="font-size: 2rem; line-height: 1;">${emojiChar}</span>`,
      className: 'emoji-marker',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    })
  }

  const myEmojiIcon = makeEmojiIcon(emoji)

  return (
    <div className="fixed inset-0 z-40 w-screen h-screen">
      <MapContainer
        center={center}
        zoom={13}
        className="w-full h-full"
        style={{ height: '100%' }}
        scrollWheelZoom
      >
        <CenterMap center={center} zoom={13} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Circle
          center={center}
          radius={800}
          pathOptions={{
            color: '#10b981',
            fillColor: '#10b981',
            fillOpacity: 0.2,
            weight: 2,
          }}
        />
        <Marker position={center} icon={myEmojiIcon}>
          <Tooltip direction="top" offset={[0, -16]} opacity={1} permanent={false}>
            <span className="font-medium text-slate-800">You</span>
            {status ? (
              <p className="text-slate-700 mt-1 mb-0">{status}</p>
            ) : (
              <p className="text-slate-500 italic mt-1 mb-0">No status set</p>
            )}
          </Tooltip>
          <Popup>
            <span className="font-medium text-slate-800">You</span>
            {status ? (
              <p className="text-slate-700 mt-1">{status}</p>
            ) : (
              <p className="text-slate-500 italic mt-1">No status set</p>
            )}
          </Popup>
        </Marker>
        {others.map((user) => {
          const uLat = user.location_lat
          const uLng = user.location_lng
          if (typeof uLat !== 'number' || typeof uLng !== 'number' || isNaN(uLat) || isNaN(uLng)) return null
          const uStatus = user.status?.trim() || ''
          const uEmoji = getEmojiForStatus(uStatus)
          const displayName = user.full_name?.trim() || 'Someone'
          const ageText = user.age != null && user.age !== '' ? `, ${user.age}` : ''
          return (
            <Marker
              key={user.id}
              position={[uLat, uLng]}
              icon={makeEmojiIcon(uEmoji)}
            >
              <Tooltip direction="top" offset={[0, -16]} opacity={1} permanent={false}>
                <span className="font-medium text-slate-800">{displayName}{ageText}</span>
                {uStatus ? (
                  <p className="text-slate-700 mt-1 mb-0">{uStatus}</p>
                ) : (
                  <p className="text-slate-500 italic mt-1 mb-0">No status set</p>
                )}
                <button
                  type="button"
                  className="mt-2 text-sm font-medium text-emerald-600 hover:text-emerald-700"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedUser(user)
                  }}
                >
                  View Profile
                </button>
              </Tooltip>
              <Popup>
                <span className="font-medium text-slate-800">{displayName}{ageText}</span>
                {uStatus ? (
                  <p className="text-slate-700 mt-1">{uStatus}</p>
                ) : (
                  <p className="text-slate-500 italic mt-1">No status set</p>
                )}
                <button
                  type="button"
                  className="mt-2 w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium"
                  onClick={() => setSelectedUser(user)}
                >
                  View Profile
                </button>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
      <Link
        to="/profile"
        className="absolute top-4 left-4 z-[1000] px-4 py-2 rounded-lg bg-slate-800/90 text-white hover:bg-slate-700 font-medium shadow-lg"
      >
        Back to profile
      </Link>

      {selectedUser && (
        <div
          className="absolute inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Profile"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="bg-slate-800 rounded-xl shadow-xl max-w-sm w-full max-h-[90vh] overflow-y-auto text-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold">Profile</h3>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="text-slate-400 hover:text-white text-2xl leading-none"
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className="flex flex-col items-center text-center mb-6">
              {selectedUser.avatar_url ? (
                <img
                  src={selectedUser.avatar_url}
                  alt=""
                  className="w-24 h-24 rounded-full object-cover mb-3"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center text-3xl font-medium text-slate-400 mb-3">
                  {(selectedUser.full_name?.trim() || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <h4 className="text-lg font-semibold">
                {selectedUser.full_name?.trim() || 'Someone'}
              </h4>
            </div>
            {selectedUser.status?.trim() && (
              <div className="mb-4">
                <p className="text-slate-400 text-sm font-medium mb-1">What do they want to do?</p>
                <p className="text-slate-200">{selectedUser.status.trim()}</p>
              </div>
            )}
            <div className="space-y-3 text-sm text-left">
              <p>
                <span className="text-slate-400">Age:</span>{' '}
                {(selectedUser.age != null && selectedUser.age !== '') ? String(selectedUser.age) : '—'}
              </p>
              <p>
                <span className="text-slate-400">Gender:</span>{' '}
                {selectedUser.gender ? genderLabel(selectedUser.gender) : '—'}
              </p>
              <p>
                <span className="text-slate-400">Languages:</span>{' '}
                {Array.isArray(selectedUser.languages) && selectedUser.languages.length > 0
                  ? selectedUser.languages.map(languageLabel).join(', ')
                  : '—'}
              </p>
              <div>
                <p className="text-slate-400 mb-1">Interests</p>
                {Array.isArray(selectedUser.interests) && selectedUser.interests.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.interests.map((id) => (
                      <span
                        key={id}
                        className="px-2 py-1 rounded-full bg-slate-700 text-slate-200 text-xs"
                      >
                        {interestLabel(id)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500">—</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedUser(null)}
              className="mt-6 w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
