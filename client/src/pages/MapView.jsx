import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Circle, Marker, Tooltip, Popup, useMap } from 'react-leaflet'
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
  { keywords: ['badminton', 'tennis', 'squash', 'racket', 'table tennis'], emoji: '🏸' },
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

// Group users by rounded position (4 decimals ~11m) and spread overlapping markers in a circle
function spreadOverlappingMarkers(users) {
  const PRECISION = 4
  const RADIUS_DEG = 0.00025 // ~25–30m offset so markers don't overlap
  const groups = new Map()
  for (const u of users) {
    const lat = u.location_lat
    const lng = u.location_lng
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) continue
    const key = `${Math.round(lat * 10 ** PRECISION) / 10 ** PRECISION}_${Math.round(lng * 10 ** PRECISION) / 10 ** PRECISION}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(u)
  }
  const result = []
  for (const [, group] of groups) {
    const n = group.length
    const baseLat = group[0].location_lat
    const baseLng = group[0].location_lng
    const cosLat = Math.cos((baseLat * Math.PI) / 180)
    group.forEach((u, i) => {
      if (n === 1) {
        result.push({ user: u, lat: baseLat, lng: baseLng })
      } else {
        const angle = (2 * Math.PI * i) / n
        const dLat = RADIUS_DEG * Math.cos(angle)
        const dLng = (RADIUS_DEG * Math.sin(angle)) / cosLat
        result.push({ user: u, lat: baseLat + dLat, lng: baseLng + dLng })
      }
    })
  }
  return result
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
      <div className="fixed inset-0 bg-amber-950 text-white flex flex-col items-center justify-center z-50">
        <div className="w-12 h-12 rounded-full border-2 border-amber-500/30 border-t-amber-400 animate-spin mb-4" />
        <p className="text-amber-200 font-medium">Loading map...</p>
      </div>
    )
  }

  const lat = profile?.location_lat
  const lng = profile?.location_lng
  const hasCoords = typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)

  if (!hasCoords) {
    return (
      <div className="fixed inset-0 bg-amber-950 text-white flex flex-col items-center justify-center z-50 px-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-800/60 flex items-center justify-center text-3xl mb-6">📍</div>
        <p className="text-amber-100 text-center mb-6 max-w-sm text-lg">
          Add your postal code, city and country in Edit Profile to see your area on the map.
        </p>
        <Link
          to="/profile"
          className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-semibold transition-colors shadow-lg shadow-amber-500/40"
        >
          Back to profile
        </Link>
      </div>
    )
  }

  // Use raw coordinates for "You" – rounding to 2 decimals (~1 km) can shift into wrong postal code
  const center = [lat, lng]
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

  function makeEmojiIcon(emojiChar, isYou = false) {
    const size = isYou ? 40 : 36
    const anchor = size / 2
    return L.divIcon({
      html: `<div class="map-marker ${isYou ? 'map-marker-you' : ''}">${emojiChar}</div>`,
      className: 'emoji-marker',
      iconSize: [size, size],
      iconAnchor: [anchor, anchor],
    })
  }

  const myEmojiIcon = makeEmojiIcon(emoji, true)

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
          attribution='&copy; <a href="https://carto.com">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
        />
        <Circle
          center={center}
          radius={800}
          pathOptions={{
            color: '#f97316',
            fillColor: '#fb923c',
            fillOpacity: 0.22,
            weight: 2,
            dashArray: '8, 8',
          }}
        />
        <Marker position={center} icon={myEmojiIcon}>
          <Tooltip direction="top" offset={[0, -16]} opacity={1} permanent={false}>
            <div className="min-w-[140px]">
              <span className="font-semibold text-slate-800">You</span>
              {status ? (
                <p className="text-slate-600 mt-1 text-sm mb-0">{status}</p>
              ) : (
                <p className="text-slate-500 italic mt-1 text-sm mb-0">No status set</p>
              )}
            </div>
          </Tooltip>
        </Marker>
        {spreadOverlappingMarkers(others).map(({ user, lat, lng }) => {
          const uStatus = user.status?.trim() || ''
          const uEmoji = getEmojiForStatus(uStatus)
          const displayName = user.full_name?.trim() || 'Someone'
          const ageText = user.age != null && user.age !== '' ? `, ${user.age}` : ''
          return (
            <Marker
              key={user.id}
              position={[lat, lng]}
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
                  className="mt-2 text-sm font-medium text-amber-600 hover:text-amber-500"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedUser(user)
                  }}
                >
                  View Profile
                </button>
              </Tooltip>
              <Popup>
                <div className="min-w-[160px]">
                  <span className="font-semibold text-slate-800">{displayName}{ageText}</span>
                  {uStatus ? (
                    <p className="text-slate-600 mt-1 text-sm">{uStatus}</p>
                  ) : (
                    <p className="text-slate-500 italic mt-1 text-sm">No status set</p>
                  )}
                  <button
                    type="button"
                    className="mt-2 w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 text-sm font-semibold transition-colors shadow-md"
                    onClick={() => setSelectedUser(user)}
                  >
                    View Profile
                  </button>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
      <Link
        to="/profile"
        className="absolute top-4 left-4 z-[1000] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50/95 dark:bg-stone-800/95 backdrop-blur-md text-amber-950 dark:text-amber-50 hover:bg-amber-100 dark:hover:bg-stone-700/95 font-medium shadow-xl border border-amber-200/60 dark:border-amber-800/50 transition-all"
      >
        <span className="text-lg">←</span>
        Back to profile
      </Link>

      {selectedUser && (
        <div
          className="absolute inset-0 z-[1100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Profile"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="bg-stone-900 rounded-2xl shadow-2xl max-w-sm w-full max-h-[90vh] overflow-y-auto text-amber-50 p-6 border border-amber-800/30"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold">Profile</h3>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="text-amber-200 hover:text-amber-50 text-2xl leading-none"
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
                <div className="w-24 h-24 rounded-full bg-amber-800/60 flex items-center justify-center text-3xl font-medium text-amber-300 mb-3">
                  {(selectedUser.full_name?.trim() || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <h4 className="text-lg font-semibold">
                {selectedUser.full_name?.trim() || 'Someone'}
              </h4>
            </div>
            {selectedUser.status?.trim() && (
              <div className="mb-4">
                <p className="text-amber-300/90 text-sm font-medium mb-1">What do they want to do?</p>
                <p className="text-amber-50">{selectedUser.status.trim()}</p>
              </div>
            )}
            <div className="space-y-3 text-sm text-left">
              <p>
                <span className="text-amber-300/90">Age:</span>{' '}
                {(selectedUser.age != null && selectedUser.age !== '') ? String(selectedUser.age) : '—'}
              </p>
              <p>
                <span className="text-amber-300/90">Gender:</span>{' '}
                {selectedUser.gender ? genderLabel(selectedUser.gender) : '—'}
              </p>
              <p>
                <span className="text-amber-300/90">Languages:</span>{' '}
                {Array.isArray(selectedUser.languages) && selectedUser.languages.length > 0
                  ? selectedUser.languages.map(languageLabel).join(', ')
                  : '—'}
              </p>
              <div>
                <p className="text-amber-300/90 mb-1">Interests</p>
                {Array.isArray(selectedUser.interests) && selectedUser.interests.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.interests.map((id) => (
                      <span
                        key={id}
                        className="px-2 py-1 rounded-full bg-amber-700/60 text-amber-100 text-xs"
                      >
                        {interestLabel(id)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-amber-400/70">—</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedUser(null)}
              className="mt-6 w-full py-3 rounded-xl bg-amber-600/80 hover:bg-amber-500 font-medium transition-colors text-amber-950"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
