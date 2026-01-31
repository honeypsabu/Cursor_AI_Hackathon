import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import 'leaflet/dist/leaflet.css'

const INTEREST_EMOJI = {
  crafts: '🎨',
  art: '🖼️',
  sports: '⚽',
  music: '🎵',
  outdoor: '🏕️',
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

function getEmojiForInterests(interests) {
  if (!Array.isArray(interests) || interests.length === 0) return '📍'
  const first = interests[0]
  return INTEREST_EMOJI[first] || '📍'
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
  const [loading, setLoading] = useState(true)
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
        .select('location_lat, location_lng, interests, status')
        .eq('id', user.id)
        .single()
      if (err && err.code !== 'PGRST116') {
        setLoading(false)
        return
      }
      setProfile(data || {})
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
  const interests = Array.isArray(profile?.interests) ? profile.interests : []
  const emoji = getEmojiForInterests(interests)
  const status = profile?.status?.trim() || ''

  const emojiIcon = L.divIcon({
    html: `<span style="font-size: 2rem; line-height: 1;">${emoji}</span>`,
    className: 'emoji-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })

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
        <Marker position={center} icon={emojiIcon}>
          <Popup>
            {status ? (
              <span className="text-slate-800">{status}</span>
            ) : (
              <span className="text-slate-500 italic">No status set</span>
            )}
          </Popup>
        </Marker>
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
