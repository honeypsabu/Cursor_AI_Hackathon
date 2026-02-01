import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getIceBreakerQuestions } from '../utils/iceBreakers'

export default function Chat() {
  const { connectionId } = useParams()
  const [connection, setConnection] = useState(null)
  const [otherProfile, setOtherProfile] = useState(null)
  const [messages, setMessages] = useState([])
  const [myId, setMyId] = useState(null)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [meetupDate, setMeetupDate] = useState('')
  const [meetupTime, setMeetupTime] = useState('')
  const [meetupPlace, setMeetupPlace] = useState('')
  const messagesEndRef = useRef(null)
  const navigate = useNavigate()

  const seed = connection?.id ? parseInt(connection.id.replace(/-/g, '').slice(0, 8), 16) : Date.now()
  const iceBreakers = otherProfile ? getIceBreakerQuestions(otherProfile, seed) : []

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login', { replace: true })
        return
      }
      setMyId(user.id)

      const { data: conn, error: connErr } = await supabase
        .from('connections')
        .select('*')
        .eq('id', connectionId)
        .maybeSingle()

      if (connErr) {
        setError(connErr.message || 'Conversation not found')
        setLoading(false)
        return
      }
      if (!conn) {
        setError('Conversation not found')
        setLoading(false)
        return
      }

      const otherId = conn.user1_id === user.id ? conn.user2_id : conn.user1_id
      setConnection(conn)
      setMeetupDate(conn.meetup_date || '')
      setMeetupTime(conn.meetup_time || '')
      setMeetupPlace(conn.meetup_place || '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', otherId)
        .single()
      setOtherProfile(profile || {})

      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('id, sender_id, content, created_at')
        .eq('connection_id', connectionId)
        .order('created_at', { ascending: true })
      setMessages(msgs || [])

      setLoading(false)
    }
    load()
  }, [connectionId, navigate])

  useEffect(() => {
    const channel = supabase
      .channel(`chat:${connectionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `connection_id=eq.${connectionId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new])
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [connectionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(content) {
    if (!content?.trim() || !connection || !myId) return
    setSending(true)
    setError('')
    const trimmed = content.trim()
    const tempId = crypto.randomUUID()
    setMessages((prev) => [
      ...prev,
      { id: tempId, sender_id: myId, content: trimmed, created_at: new Date().toISOString() },
    ])
    setNewMessage('')
    const { data: inserted, error: err } = await supabase
      .from('chat_messages')
      .insert({
        connection_id: connectionId,
        sender_id: myId,
        content: trimmed,
      })
      .select('id, sender_id, content, created_at')
      .single()
    setSending(false)
    if (err) {
      setError(err.message)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setNewMessage(trimmed)
      return
    }
    setMessages((prev) => prev.map((m) => (m.id === tempId ? inserted : m)))
  }

  function handleSubmit(e) {
    e.preventDefault()
    sendMessage(newMessage)
  }

  async function saveMeetupDetails() {
    if (!connection) return
    setSaving(true)
    setError('')
    const { error: err } = await supabase
      .from('connections')
      .update({
        meetup_date: meetupDate.trim() || null,
        meetup_time: meetupTime.trim() || null,
        meetup_place: meetupPlace.trim() || null,
      })
      .eq('id', connectionId)
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setConnection((prev) => ({
      ...prev,
      meetup_date: meetupDate.trim() || null,
      meetup_time: meetupTime.trim() || null,
      meetup_place: meetupPlace.trim() || null,
    }))
  }

  // Check if 24 hours have passed and meetup details are empty
  const show24HourPrompt = connection && !connection.meetup_date && !connection.meetup_time && !connection.meetup_place
    && (Date.now() - new Date(connection.created_at).getTime() > 24 * 60 * 60 * 1000)

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-text flex items-center justify-center">
        <p className="text-text-muted">Loading chat...</p>
      </div>
    )
  }

  if (error && !connection) {
    return (
      <div className="min-h-screen bg-white text-text flex flex-col items-center justify-center px-4">
        <p className="text-red-500 mb-4">{error}</p>
        <Link to="/chats" className="text-primary hover:underline">Back to chats</Link>
      </div>
    )
  }

  const displayName = otherProfile?.full_name?.trim() || 'Someone'

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white sticky top-0 z-10">
        <Link to="/chats" className="text-slate-500 hover:text-text">
          ←
        </Link>
        {otherProfile?.avatar_url ? (
          <img src={otherProfile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <h2 className="font-semibold text-text flex-1">{displayName}</h2>
      </header>

      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/80">
        <p className="text-xs font-medium text-text-muted mb-2">Meetup Details</p>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            value={meetupPlace}
            onChange={(e) => setMeetupPlace(e.target.value)}
            onBlur={saveMeetupDetails}
            placeholder="Location (e.g. Central Park, New York)"
            className="flex-1 min-w-[120px] px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-text text-sm placeholder-text-light focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {meetupPlace.trim() && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(meetupPlace.trim())}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white text-sm font-medium transition shrink-0"
              title="Open in Google Maps"
            >
              <span aria-hidden>📍</span>
              <span>Open in Maps</span>
            </a>
          )}
          <input
            type="date"
            value={meetupDate}
            onChange={(e) => setMeetupDate(e.target.value)}
            onBlur={saveMeetupDetails}
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            type="time"
            value={meetupTime}
            onChange={(e) => setMeetupTime(e.target.value)}
            onBlur={saveMeetupDetails}
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {saving && <span className="text-xs text-text-muted self-center">Saving...</span>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <p className="text-text-muted text-sm mb-4">Start the conversation! Try one of these ice breakers:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {iceBreakers.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => sendMessage(q)}
                  className="px-4 py-2 rounded-full bg-primary/10 text-primary text-sm hover:bg-primary/20 transition text-left max-w-full"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {show24HourPrompt && messages.length > 0 && (
          <div className="flex justify-center my-4">
            <div className="max-w-[85%] px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-center">
              <p className="text-sm text-amber-900">
                Hey! It's been a day — are you guys ready to meet up? Set a date, time, and place above! 🎉
              </p>
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.sender_id === myId ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                m.sender_id === myId
                  ? 'bg-primary text-white rounded-br-md'
                  : 'bg-slate-100 text-text rounded-bl-md'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Ice breaker suggestions when there are some messages */}
      {messages.length > 0 && iceBreakers.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-100 overflow-x-auto">
          <p className="text-xs text-text-muted mb-2">Suggestions:</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {iceBreakers.slice(0, 4).map((q, i) => (
              <button
                key={i}
                type="button"
                onClick={() => sendMessage(q)}
                className="shrink-0 px-3 py-1.5 rounded-full bg-slate-100 text-text text-xs hover:bg-primary/10 hover:text-primary transition"
              >
                {q.length > 40 ? q.slice(0, 40) + '…' : q}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200">
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            maxLength={500}
            className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-text placeholder-text-light focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium disabled:opacity-50 transition"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
