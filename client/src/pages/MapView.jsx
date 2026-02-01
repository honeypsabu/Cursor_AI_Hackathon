import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Circle, Marker, Tooltip, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import { INTEREST_OPTIONS } from '../constants/interests'
import { useAutoMatch } from '../hooks/useAutoMatch'
import { GENDER_OPTIONS, LANGUAGE_OPTIONS } from '../constants/profile'
import 'leaflet/dist/leaflet.css'

// Priority 1: "What do they want to do?" (status) — e.g. "I wanna go for a walk", "hiking", "learning german"
const STATUS_EMOJI_KEYWORDS = [
  { keywords: ['walk', 'stroll', 'wander'], emoji: '🚶' },
  { keywords: ['run', 'jog'], emoji: '🏃' },
  { keywords: ['coffee', 'cafe', 'tea'], emoji: '☕' },
  { keywords: ['drink', 'bar', 'beer', 'wine'], emoji: '🍻' },
  { keywords: ['eat', 'food', 'lunch', 'dinner', 'brunch'], emoji: '🍽️' },
  { keywords: ['cook', 'baking', 'bake'], emoji: '🍳' },
  { keywords: ['read', 'book', 'library'], emoji: '📚' },
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
  { keywords: ['study', 'focus', 'learning', 'learn', 'language', 'german', 'spanish', 'french', 'english'], emoji: '📖' },
  { keywords: ['work'], emoji: '💼' },
  { keywords: ['dog', 'pet', 'puppy'], emoji: '🐕' },
  { keywords: ['dance', 'dancing', 'party'], emoji: '💃' },
  { keywords: ['anime', 'manga'], emoji: '📺' },
]

// Fallback emoji from interests (visible, not sparkle)
const INTEREST_EMOJI = {
  crafts: '🧵',
  art: '🎨',
  sports: '⚽',
  music: '🎵',
  outdoor: '🏕️',
  hiking: '🥾',
  painting: '🖌️',
  clubbing: '🪩',
  gaming: '🎮',
  reading: '📚',
  cooking: '🍳',
  travel: '✈️',
  photography: '📷',
  movies: '🎬',
  tech: '💻',
}

// Priority 1: "What do they want to do?" (status). Priority 2: interests (only when status is empty).
function getEmojiForUser(status, interests) {
  const hasStatus = status && typeof status === 'string' && status.trim() !== ''
  if (hasStatus) {
    const lower = status.trim().toLowerCase()
    for (const { keywords, emoji } of STATUS_EMOJI_KEYWORDS) {
      if (keywords.some((k) => lower.includes(k))) return emoji
    }
    return '💬' // has status but no keyword match
  }
  const ids = Array.isArray(interests) ? interests : []
  for (const id of ids) {
    if (INTEREST_EMOJI[id]) return INTEREST_EMOJI[id]
  }
  return '👤'
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
  const [matchedUserIds, setMatchedUserIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState(null) // 'connected' | 'pending_sent' | 'pending_received' | null
  const [connectionId, setConnectionId] = useState(null)
  const [sendingRequest, setSendingRequest] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!selectedUser || !currentUserId) {
      setConnectionStatus(null)
      setConnectionId(null)
      return
    }
    async function checkConnection() {
      const otherId = selectedUser.id
      const [u1, u2] = currentUserId < otherId ? [currentUserId, otherId] : [otherId, currentUserId]
      const { data: conn } = await supabase.from('connections').select('id').eq('user1_id', u1).eq('user2_id', u2).maybeSingle()
      if (conn) {
        setConnectionStatus('connected')
        setConnectionId(conn.id)
        return
      }
      const { data: sent } = await supabase.from('connection_requests').select('id').eq('from_user_id', currentUserId).eq('to_user_id', otherId).eq('status', 'pending').maybeSingle()
      if (sent) {
        setConnectionStatus('pending_sent')
        setConnectionId(null)
        return
      }
      const { data: received } = await supabase.from('connection_requests').select('id').eq('from_user_id', otherId).eq('to_user_id', currentUserId).eq('status', 'pending').maybeSingle()
      if (received) {
        setConnectionStatus('pending_received')
        setConnectionId(null)
        return
      }
      setConnectionStatus(null)
      setConnectionId(null)
    }
    checkConnection()
  }, [selectedUser?.id, currentUserId])

  async function sendConnectionRequest() {
    if (!selectedUser || !currentUserId || sendingRequest) return
    setSendingRequest(true)
    const { error } = await supabase.from('connection_requests').insert({
      from_user_id: currentUserId,
      to_user_id: selectedUser.id,
      status: 'pending',
    })
    setSendingRequest(false)
    if (!error) setConnectionStatus('pending_sent')
  }

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
        .select('id, location_lat, location_lng, status, interests')
        .eq('id', user.id)
        .single()
      if (err && err.code !== 'PGRST116') {
        setLoading(false)
        return
      }
      setProfile(myProfile || {})
      const { data: mapProfiles } = await supabase.rpc('get_profiles_for_map')
      setOtherUsers(Array.isArray(mapProfiles) ? mapProfiles : [])
      const { data: myGroups } = await supabase.from('group_members').select('group_id').eq('user_id', user.id)
      const groupIds = (myGroups || []).map((g) => g.group_id)
      let ids = new Set()
      if (groupIds.length > 0) {
        const { data: members } = await supabase.from('group_members').select('user_id').in('group_id', groupIds).neq('user_id', user.id)
        ids = new Set((members || []).map((m) => m.user_id))
      }
      setMatchedUserIds(ids)
      setLoading(false)
    }
    load()
  }, [navigate])

  useAutoMatch(profile, { runOnEveryMount: true })

  if (loading) {
    return (
      <div className="fixed inset-0 bg-white text-text flex flex-col items-center justify-center z-50">
        <div className="w-12 h-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin mb-4" />
        <p className="text-text font-medium">Loading map...</p>
      </div>
    )
  }

  const lat = profile?.location_lat
  const lng = profile?.location_lng
  const hasCoords = typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)

  if (!hasCoords) {
    return (
      <div className="fixed inset-0 bg-white text-text flex flex-col items-center justify-center z-50 px-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl mb-6">📍</div>
        <p className="text-text text-center mb-6 max-w-sm text-lg">
          Add your postal code, city and country in Edit Profile to see your area on the map.
        </p>
        <Link
          to="/profile"
          className="px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold transition-colors shadow-lg shadow-primary/30"
        >
          Back to profile
        </Link>
      </div>
    )
  }

  // Use raw coordinates for "You" – rounding to 2 decimals (~1 km) can shift into wrong postal code
  const center = [lat, lng]
  const status = profile?.status?.trim() || ''
  const emoji = getEmojiForUser(status, profile?.interests)

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

  function makeEmojiIcon(emojiChar, isYou = false, isMatched = false) {
    const size = isYou ? 40 : 36
    const ringSize = isMatched ? size + 12 : size
    const anchor = ringSize / 2
    const inner = `<div class="map-marker ${isYou ? 'map-marker-you' : ''}" style="width:${size}px;height:${size}px">${emojiChar}</div>`
    const html = isMatched
      ? `<div style="display:flex;align-items:center;justify-content:center;width:${ringSize}px;height:${ringSize}px;border-radius:50%;border:3px solid #7DD3FC;background:rgba(125,211,252,0.25);box-shadow:0 2px 6px rgba(125,211,252,0.35)">${inner}</div>`
      : inner
    return L.divIcon({
      html,
      className: 'emoji-marker',
      iconSize: [ringSize, ringSize],
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
            color: '#8B5CF6',
            fillColor: '#A78BFA',
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
          const uEmoji = getEmojiForUser(uStatus, user.interests)
          const displayName = user.full_name?.trim() || 'Someone'
          const ageText = user.age != null && user.age !== '' ? `, ${user.age}` : ''
          const isMatched = matchedUserIds.has(user.id)
          return (
            <Marker
              key={user.id}
              position={[lat, lng]}
              icon={makeEmojiIcon(uEmoji, false, isMatched)}
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
                  className="mt-2 text-sm font-medium text-primary hover:text-primary-hover"
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
                    className="mt-2 w-full py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors shadow-md"
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
      <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2">
        <Link
          to="/profile"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/95 backdrop-blur-md text-text hover:bg-slate-50 font-medium shadow-xl border border-slate-200 transition-all"
        >
          <span className="text-lg">←</span>
          Back to profile
        </Link>
        <Link
          to="/chats"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/95 backdrop-blur-md text-primary hover:bg-primary/10 font-medium shadow-xl border border-slate-200 transition-all"
        >
          Chats
        </Link>
      </div>

      {selectedUser && (
        <div
          className="absolute inset-0 z-[1100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Profile"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full max-h-[90vh] overflow-y-auto text-text p-6 border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-text">Profile</h3>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="text-text-muted hover:text-text text-2xl leading-none"
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
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-3xl font-medium text-primary mb-3">
                  {(selectedUser.full_name?.trim() || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <h4 className="text-lg font-semibold">
                {selectedUser.full_name?.trim() || 'Someone'}
              </h4>
            </div>
            {selectedUser.status?.trim() && (
              <div className="mb-4">
                <p className="text-text-muted text-sm font-medium mb-1">What do they want to do?</p>
                <p className="text-text">{selectedUser.status.trim()}</p>
              </div>
            )}
            <div className="space-y-3 text-sm text-left">
              <p>
                <span className="text-text-muted">Age:</span>{' '}
                {(selectedUser.age != null && selectedUser.age !== '') ? String(selectedUser.age) : '—'}
              </p>
              <p>
                <span className="text-text-muted">Gender:</span>{' '}
                {selectedUser.gender ? genderLabel(selectedUser.gender) : '—'}
              </p>
              <p>
                <span className="text-text-muted">Languages:</span>{' '}
                {Array.isArray(selectedUser.languages) && selectedUser.languages.length > 0
                  ? selectedUser.languages.map(languageLabel).join(', ')
                  : '—'}
              </p>
              <div>
                <p className="text-text-muted mb-1">Interests</p>
                {Array.isArray(selectedUser.interests) && selectedUser.interests.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.interests.map((id) => (
                      <span
                        key={id}
                        className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs"
                      >
                        {interestLabel(id)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-muted">—</p>
                )}
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              {connectionStatus === 'connected' && connectionId && (
                <Link
                  to={`/chats/${connectionId}`}
                  className="w-full py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium transition-colors text-center"
                  onClick={() => setSelectedUser(null)}
                >
                  Chat
                </Link>
              )}
              {connectionStatus === 'pending_sent' && (
                <p className="text-center text-text-muted text-sm py-2">Request sent — they&apos;ll see it in Chats</p>
              )}
              {connectionStatus === null && (
                <button
                  type="button"
                  onClick={sendConnectionRequest}
                  disabled={sendingRequest}
                  className="w-full py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium transition-colors disabled:opacity-50"
                >
                  {sendingRequest ? 'Sending...' : 'Connect'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-text font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
