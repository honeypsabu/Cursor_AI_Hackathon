import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function GroupChat() {
  const { groupId } = useParams()
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!groupId) return
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login', { replace: true })
        return
      }
      const { data: g } = await supabase.from('match_groups').select('*').eq('id', groupId).single()
      if (!g) {
        navigate('/profile', { replace: true })
        return
      }
      setGroup(g)
      const { data: m } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)
      setMembers(m || [])
      setLoading(false)
    }
    load()
  }, [groupId, navigate])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!groupId) return
    async function fetchMessages() {
      const { data } = await supabase.rpc('get_group_messages', { p_group_id: groupId })
      setMessages(data || [])
    }
    const interval = setInterval(fetchMessages, 3000)
    fetchMessages()
    return () => clearInterval(interval)
  }, [groupId])

  async function sendMessage(e) {
    e.preventDefault()
    if (!newMessage.trim() || !groupId) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setSending(true)
    try {
      await supabase.from('group_chat_messages').insert({
        group_id: groupId,
        sender_id: user.id,
        content: newMessage.trim(),
      })
      setNewMessage('')
    } finally {
      setSending(false)
    }
  }

  if (loading || !group) {
    return (
      <div className="min-h-screen bg-white text-text flex items-center justify-center">
        <p className="text-text-muted">Loading group chat...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-white text-text">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <Link to="/groups" className="text-text-muted hover:text-text transition">← Back</Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-text truncate">{group.name}</h1>
          <p className="text-text-muted text-sm truncate">{group.activity_summary || `${members.length} members`}</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
        {messages.length === 0 ? (
          <p className="text-text-muted text-center py-8">No messages yet. Say hello!</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex gap-2">
              <div className="shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-text-muted text-sm font-medium">
                {(msg.sender_name || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-text-muted text-xs">{msg.sender_name || 'Someone'}</p>
                <p className="text-text text-sm">{msg.content}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage} className="p-4 border-t border-slate-200 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-text placeholder-text-light focus:outline-none focus:ring-2 focus:ring-primary"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
