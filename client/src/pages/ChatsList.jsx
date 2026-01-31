import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ChatsList() {
  const [connections, setConnections] = useState([])
  const [pendingReceived, setPendingReceived] = useState([])
  const [pendingSent, setPendingSent] = useState([])
  const [profiles, setProfiles] = useState({})
  const [myId, setMyId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login', { replace: true })
        return
      }
      const myId = user.id
      setMyId(myId)

      // Fetch connections (accepted)
      const { data: conns } = await supabase
        .from('connections')
        .select('id, user1_id, user2_id, created_at')
        .or(`user1_id.eq.${myId},user2_id.eq.${myId}`)
      setConnections(conns || [])

      // Fetch pending requests (received)
      const { data: received } = await supabase
        .from('connection_requests')
        .select('id, from_user_id, created_at')
        .eq('to_user_id', myId)
        .eq('status', 'pending')
      setPendingReceived(received || [])

      // Fetch pending requests (sent)
      const { data: sent } = await supabase
        .from('connection_requests')
        .select('id, to_user_id, created_at')
        .eq('from_user_id', myId)
        .eq('status', 'pending')
      setPendingSent(sent || [])

      // Fetch profiles for all relevant user IDs
      const ids = new Set()
      ;(conns || []).forEach((c) => { ids.add(c.user1_id); ids.add(c.user2_id) })
      ;(received || []).forEach((r) => ids.add(r.from_user_id))
      ;(sent || []).forEach((s) => ids.add(s.to_user_id))
      ids.delete(myId)

      if (ids.size > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', [...ids])
        const map = {}
        ;(profs || []).forEach((p) => { map[p.id] = p })
        setProfiles(map)
      }

      setLoading(false)
    }
    load()
  }, [navigate])

  async function acceptRequest(requestId) {
    setError('')
    const { data: req } = await supabase
      .from('connection_requests')
      .select('from_user_id, to_user_id')
      .eq('id', requestId)
      .single()
    if (!req) return

    const [u1, u2] = req.from_user_id < req.to_user_id
      ? [req.from_user_id, req.to_user_id]
      : [req.to_user_id, req.from_user_id]

    const { data: newConn, error: connErr } = await supabase
      .from('connections')
      .insert({ user1_id: u1, user2_id: u2 })
      .select('id, user1_id, user2_id, created_at')
      .single()
    if (connErr) {
      setError(connErr.message)
      return
    }
    await supabase.from('connection_requests').update({ status: 'accepted' }).eq('id', requestId)
    setPendingReceived((prev) => prev.filter((r) => r.id !== requestId))
    if (newConn) setConnections((prev) => [newConn, ...prev])
  }

  async function rejectRequest(requestId) {
    await supabase.from('connection_requests').update({ status: 'rejected' }).eq('id', requestId)
    setPendingReceived((prev) => prev.filter((r) => r.id !== requestId))
  }

  function getOther(conn) {
    if (!myId) return conn.user2_id
    return conn.user1_id === myId ? conn.user2_id : conn.user1_id
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-text flex items-center justify-center">
        <p className="text-text-muted">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-text">
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-text">Chats</h2>
          <Link to="/profile" className="text-sm text-primary hover:text-primary-hover font-medium">
            Back to profile
          </Link>
        </div>
        {error && <p className="mb-4 text-red-500 text-sm">{error}</p>}

        {/* Pending requests (received) */}
        {pendingReceived.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-medium text-text-muted mb-3">Connection requests</h3>
            <div className="space-y-2">
              {pendingReceived.map((r) => {
                const p = profiles[r.from_user_id]
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200"
                  >
                    <div className="flex items-center gap-3">
                      {p?.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                          {(p?.full_name || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium">{p?.full_name || 'Someone'}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => rejectRequest(r.id)}
                        className="px-3 py-1.5 rounded-lg text-sm text-text-muted hover:bg-slate-200"
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        onClick={() => acceptRequest(r.id)}
                        className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium"
                      >
                        Accept
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Pending sent */}
        {pendingSent.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-text-muted mb-3">Pending</h3>
            <div className="space-y-2">
              {pendingSent.map((r) => {
                const p = profiles[r.to_user_id]
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200"
                  >
                    {p?.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                        {(p?.full_name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="font-medium">{p?.full_name || 'Someone'}</span>
                    <span className="text-text-muted text-sm">Request sent</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Connections (chats) */}
        <div>
          <h3 className="text-sm font-medium text-text-muted mb-3">Messages</h3>
          {connections.length === 0 ? (
            <p className="text-text-muted text-sm py-4">No conversations yet. Connect with someone on the map to start chatting!</p>
          ) : (
            <div className="space-y-2">
              {connections.map((conn) => {
                const otherId = getOther(conn)
                const p = profiles[otherId]
                return (
                  <Link
                    key={conn.id}
                    to={`/chats/${conn.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 hover:border-primary/50 hover:bg-slate-50 transition"
                  >
                    {p?.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg font-medium">
                        {(p?.full_name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="font-medium flex-1">{p?.full_name || 'Someone'}</span>
                    <span className="text-slate-400">→</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
