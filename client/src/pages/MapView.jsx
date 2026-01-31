import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Circle, Marker, Popup, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
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
          return (
            <Marker
              key={user.id}
              position={[uLat, uLng]}
              icon={makeEmojiIcon(uEmoji)}
            >
              <Tooltip direction="top" offset={[0, -16]} opacity={1} permanent={false}>
                <span className="font-medium text-slate-800">{displayName}</span>
                {uStatus ? (
                  <p className="text-slate-700 mt-1 mb-0">{uStatus}</p>
                ) : (
                  <p className="text-slate-500 italic mt-1 mb-0">No status set</p>
                )}
              </Tooltip>
              <Popup>
                <span className="font-medium text-slate-800">{displayName}</span>
                {uStatus ? (
                  <p className="text-slate-700 mt-1">{uStatus}</p>
                ) : (
                  <p className="text-slate-500 italic mt-1">No status set</p>
                )}
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
    </div>
  )
}
