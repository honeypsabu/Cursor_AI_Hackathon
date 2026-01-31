import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const PERIOD_OPTIONS = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
]

function formatDateWithDay(dateVal) {
  if (!dateVal) return ''
  const d = typeof dateVal === 'string' ? new Date(dateVal + 'T12:00:00') : new Date(dateVal)
  if (isNaN(d.getTime())) return ''
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const day = days[d.getDay()]
  const month = d.toLocaleString('default', { month: 'short' })
  const num = d.getDate()
  return `${day}, ${month} ${num}`
}

export default function GroupChat() {
  const { groupId } = useParams()
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [inviteStats, setInviteStats] = useState({ invited: 0, accepted: 0 })
  const [showParticipants, setShowParticipants] = useState(false)
  const [showScheduler, setShowScheduler] = useState(false)
  const [showLocationForm, setShowLocationForm] = useState(false)
  const [addingToPollId, setAddingToPollId] = useState(null)
  const [locationOpt1, setLocationOpt1] = useState('')
  const [locationOpt2, setLocationOpt2] = useState('')
  const [locationOpt3, setLocationOpt3] = useState('')
  const [pollData, setPollData] = useState({})
  const [dateTimePollData, setDateTimePollData] = useState({})
  const [showDateTimeForm, setShowDateTimeForm] = useState(false)
  const [addingToDateTimePollId, setAddingToDateTimePollId] = useState(null)
  const [dtOpt1, setDtOpt1] = useState({ date: '', period: 'morning' })
  const [dtOpt2, setDtOpt2] = useState({ date: '', period: 'afternoon' })
  const [dtOpt3, setDtOpt3] = useState({ date: '', period: 'evening' })
  const [memberProfiles, setMemberProfiles] = useState([])
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [meetupLocation, setMeetupLocation] = useState('')
  const [meetupDate, setMeetupDate] = useState('')
  const [meetupTime, setMeetupTime] = useState('')
  const messagesEndRef = useRef(null)
  const locationInputRef = useRef(null)
  const dateInputRef = useRef(null)
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
      setMeetupLocation(g.meetup_location || '')
      setMeetupDate(g.meetup_date || '')
      setMeetupTime(g.meetup_time || '')
      const { data: m } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)
      setMembers(m || [])
      const { data: stats } = await supabase.rpc('get_group_invite_stats', { p_group_id: groupId })
      const row = Array.isArray(stats) && stats[0] ? stats[0] : null
      setInviteStats({
        invited: row?.invited_count ?? 0,
        accepted: row?.accepted_count ?? 0,
      })
      setLoading(false)
    }
    load()
  }, [groupId, navigate])

  useEffect(() => {
    if (showLocationForm || showDateTimeForm) return
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, showLocationForm, showDateTimeForm])

  useEffect(() => {
    if (!showScheduler) return
    function handleClickOutside(e) {
      if (!e.target.closest('[data-scheduler-area]')) setShowScheduler(false)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showScheduler])

  useEffect(() => {
    if (!groupId) return
    async function fetchMessages() {
      const { data } = await supabase.rpc('get_group_messages', { p_group_id: groupId })
      setMessages(data || [])
      const pollIds = [...new Set((data || []).map((m) => m.poll_id).filter(Boolean))]
      const dtPollIds = [...new Set((data || []).map((m) => m.date_time_poll_id).filter(Boolean))]
      const updates = {}
      for (const pid of pollIds) {
        const { data: pollRows } = await supabase.rpc('get_location_poll', { p_poll_id: pid })
        updates[pid] = pollRows || []
      }
      setPollData((prev) => ({ ...prev, ...updates }))
      const dtUpdates = {}
      for (const pid of dtPollIds) {
        const { data: rows } = await supabase.rpc('get_date_time_poll', { p_poll_id: pid })
        dtUpdates[pid] = rows || []
      }
      setDateTimePollData((prev) => ({ ...prev, ...dtUpdates }))
    }
    async function fetchInviteStats() {
      const { data } = await supabase.rpc('get_group_invite_stats', { p_group_id: groupId })
      const row = Array.isArray(data) && data[0] ? data[0] : null
      if (row) setInviteStats({ invited: row.invited_count ?? 0, accepted: row.accepted_count ?? 0 })
    }
    fetchMessages()
    fetchInviteStats()
    const interval = setInterval(() => { fetchMessages(); fetchInviteStats() }, 3000)
    return () => clearInterval(interval)
  }, [groupId])

  async function saveMeetupDetails() {
    if (!groupId) return
    setSaving(true)
    try {
      await supabase.from('match_groups').update({
        meetup_location: meetupLocation.trim() || null,
        meetup_date: meetupDate || null,
        meetup_time: meetupTime || null,
      }).eq('id', groupId)
    } finally {
      setSaving(false)
    }
  }

  async function openParticipants() {
    setShowParticipants(true)
    const { data } = await supabase.rpc('get_group_member_profiles', { p_group_id: groupId })
    setMemberProfiles(Array.isArray(data) ? data : [])
  }

  async function sendLocationPoll() {
    const opts = [locationOpt1, locationOpt2, locationOpt3].map((s) => s.trim()).filter(Boolean)
    if (opts.length === 0) return
    setSending(true)
    try {
      if (addingToPollId) {
        await supabase.rpc('add_location_poll_options', { p_poll_id: addingToPollId, p_new_options: opts })
        const { data: pollRows } = await supabase.rpc('get_location_poll', { p_poll_id: addingToPollId })
        setPollData((prev) => ({ ...prev, [addingToPollId]: pollRows || [] }))
        setAddingToPollId(null)
      } else {
        await supabase.rpc('create_location_poll', { p_group_id: groupId, p_options: opts })
      }
      setShowLocationForm(false)
      setLocationOpt1(''); setLocationOpt2(''); setLocationOpt3('')
      const { data } = await supabase.rpc('get_group_messages', { p_group_id: groupId })
      setMessages(data || [])
      const pollIds = [...new Set((data || []).map((m) => m.poll_id).filter(Boolean))]
      const updates = {}
      for (const pid of pollIds) {
        const { data: pollRows } = await supabase.rpc('get_location_poll', { p_poll_id: pid })
        updates[pid] = pollRows || []
      }
      setPollData((prev) => ({ ...prev, ...updates }))
    } finally {
      setSending(false)
    }
  }

  async function toggleVote(pollId, optionIndex) {
    try {
      await supabase.rpc('toggle_location_poll_vote', { p_poll_id: pollId, p_option_index: optionIndex })
      const { data } = await supabase.rpc('get_location_poll', { p_poll_id: pollId })
      setPollData((prev) => ({ ...prev, [pollId]: data || [] }))
    } catch (err) {
      console.error(err)
    }
  }

  function openAddOptions(pollId) {
    setAddingToPollId(pollId)
    setShowLocationForm(true)
    setLocationOpt1(''); setLocationOpt2(''); setLocationOpt3('')
  }

  function collectDateTimeOptions() {
    return [dtOpt1, dtOpt2, dtOpt3]
      .filter((o) => o.date)
      .map((o) => ({ date: o.date, period: o.period }))
  }

  async function sendDateTimePoll() {
    const opts = collectDateTimeOptions()
    if (opts.length === 0) return
    setSending(true)
    try {
      if (addingToDateTimePollId) {
        await supabase.rpc('add_date_time_poll_options', { p_poll_id: addingToDateTimePollId, p_new_options: opts })
        const { data: rows } = await supabase.rpc('get_date_time_poll', { p_poll_id: addingToDateTimePollId })
        setDateTimePollData((prev) => ({ ...prev, [addingToDateTimePollId]: rows || [] }))
        setAddingToDateTimePollId(null)
      } else {
        await supabase.rpc('create_date_time_poll', { p_group_id: groupId, p_options: opts })
        const { data } = await supabase.rpc('get_group_messages', { p_group_id: groupId })
        setMessages(data || [])
        const dtPollIds = [...new Set((data || []).map((m) => m.date_time_poll_id).filter(Boolean))]
        const dtUpdates = {}
        for (const pid of dtPollIds) {
          const { data: rows } = await supabase.rpc('get_date_time_poll', { p_poll_id: pid })
          dtUpdates[pid] = rows || []
        }
        setDateTimePollData((prev) => ({ ...prev, ...dtUpdates }))
      }
      setShowDateTimeForm(false)
      setDtOpt1({ date: '', period: 'morning' }); setDtOpt2({ date: '', period: 'afternoon' }); setDtOpt3({ date: '', period: 'evening' })
    } finally {
      setSending(false)
    }
  }

  async function toggleDateTimeVote(pollId, optionIndex) {
    try {
      await supabase.rpc('toggle_date_time_poll_vote', { p_poll_id: pollId, p_option_index: optionIndex })
      const { data } = await supabase.rpc('get_date_time_poll', { p_poll_id: pollId })
      setDateTimePollData((prev) => ({ ...prev, [pollId]: data || [] }))
    } catch (err) {
      console.error(err)
    }
  }

  function openAddDateTimeOptions(pollId) {
    setAddingToDateTimePollId(pollId)
    setShowDateTimeForm(true)
    setDtOpt1({ date: '', period: 'morning' }); setDtOpt2({ date: '', period: 'afternoon' }); setDtOpt3({ date: '', period: 'evening' })
  }

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
      {showParticipants && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowParticipants(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 max-h-[70vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-text">Participants</h3>
              <button
                type="button"
                onClick={() => setShowParticipants(false)}
                className="p-1 rounded-lg text-text-muted hover:bg-slate-100"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <ul className="overflow-y-auto p-2 max-h-[50vh]">
              {memberProfiles.length === 0 ? (
                <li className="px-3 py-4 text-center text-text-muted text-sm">
                  No one has joined yet.
                </li>
              ) : (
                memberProfiles.map((m) => (
                  <li
                    key={m.user_id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50"
                  >
                    {m.avatar_url ? (
                      <img
                        src={m.avatar_url}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                        {(m.full_name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="flex-1 font-medium">
                      {m.full_name || 'Unknown'}
                    </span>
                    <Link
                      to={`/user/${m.user_id}`}
                      onClick={() => setShowParticipants(false)}
                      className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition shrink-0"
                    >
                      View profile
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <Link to="/groups" className="text-text-muted hover:text-text transition">← Back</Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-text truncate">{group.name}</h1>
          <p className="text-text-muted text-sm truncate flex items-center gap-2 flex-wrap">
            {group.activity_summary && <span>{group.activity_summary}</span>}
            {inviteStats.invited > 0 && (
              <>
                {group.activity_summary && <span className="text-slate-300">·</span>}
                <button
                  type="button"
                  onClick={openParticipants}
                  className="px-2 py-0.5 rounded-md bg-slate-100 text-text-muted hover:bg-slate-200 transition cursor-pointer"
                >
                  {inviteStats.accepted}/{inviteStats.invited} joined
                </button>
              </>
            )}
            {!group.activity_summary && inviteStats.invited === 0 && `${members.length} members`}
          </p>
        </div>
      </div>
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/80">
        <p className="text-xs font-medium text-text-muted mb-2">Meetup Details</p>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            ref={locationInputRef}
            type="text"
            value={meetupLocation}
            onChange={(e) => setMeetupLocation(e.target.value)}
            onBlur={saveMeetupDetails}
            placeholder="Location (e.g. Central Park, New York)"
            className="flex-1 min-w-[120px] px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-text text-sm placeholder-text-light focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {meetupLocation.trim() && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(meetupLocation.trim())}`}
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
            ref={dateInputRef}
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
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
        {showLocationForm && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-text mb-3">
              {addingToPollId ? 'Add location options' : 'Suggest locations (1–3 options)'}
            </p>
            <div className="space-y-2 mb-4">
              <input
                type="text"
                value={locationOpt1}
                onChange={(e) => setLocationOpt1(e.target.value)}
                placeholder="Location 1"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-text text-sm placeholder-text-light focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="text"
                value={locationOpt2}
                onChange={(e) => setLocationOpt2(e.target.value)}
                placeholder="Location 2 (optional)"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-text text-sm placeholder-text-light focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="text"
                value={locationOpt3}
                onChange={(e) => setLocationOpt3(e.target.value)}
                placeholder="Location 3 (optional)"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-text text-sm placeholder-text-light focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={sendLocationPoll}
                disabled={sending || ![locationOpt1, locationOpt2, locationOpt3].some((s) => s.trim())}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium disabled:opacity-50"
              >
                {sending ? 'Sending...' : addingToPollId ? 'Add options' : 'Send'}
              </button>
              <button
                type="button"
                onClick={() => { setShowLocationForm(false); setAddingToPollId(null) }}
                className="px-4 py-2 rounded-lg bg-slate-100 text-text text-sm font-medium hover:bg-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {showDateTimeForm && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-text mb-3">
              {addingToDateTimePollId ? 'Add date & time options' : 'Suggest dates & times (1–3 options)'}
            </p>
            <div className="space-y-4 mb-4">
              {[1, 2, 3].map((i) => {
                const opt = i === 1 ? dtOpt1 : i === 2 ? dtOpt2 : dtOpt3
                const setOpt = i === 1 ? setDtOpt1 : i === 2 ? setDtOpt2 : setDtOpt3
                return (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <div className="flex-1 min-w-[140px] flex flex-col gap-0.5">
                      <input
                        type="date"
                        value={opt.date}
                        onChange={(e) => setOpt((o) => ({ ...o, date: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        title="Select date"
                      />
                      {opt.date && (
                        <p className="text-xs text-text-muted">{formatDateWithDay(opt.date)}</p>
                      )}
                    </div>
                    <select
                      value={opt.period}
                      onChange={(e) => setOpt((o) => ({ ...o, period: e.target.value }))}
                      className="px-3 py-2 rounded-lg border border-slate-200 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white min-w-[120px]"
                    >
                      {PERIOD_OPTIONS.map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={sendDateTimePoll}
                disabled={sending || !collectDateTimeOptions().length}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium disabled:opacity-50"
              >
                {sending ? 'Sending...' : addingToDateTimePollId ? 'Add options' : 'Send'}
              </button>
              <button
                type="button"
                onClick={() => { setShowDateTimeForm(false); setAddingToDateTimePollId(null) }}
                className="px-4 py-2 rounded-lg bg-slate-100 text-text text-sm font-medium hover:bg-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {messages.length === 0 && !showLocationForm && !showDateTimeForm ? (
          <div className="py-6 px-4 max-w-md mx-auto">
            <p className="text-text-muted text-center text-xs mb-3">Start the conversation! Try one of these ice breakers:</p>
            <div className="space-y-2">
              {[
                "Hey! What's the best thing that happened to you this week?",
                "Nice to connect! What do you do for fun?",
                "Random question: what's your go-to comfort food?",
                "If you could have coffee with anyone, who would it be?",
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setNewMessage(q)}
                  className="w-full px-4 py-1.5 rounded-2xl bg-primary/10 text-primary font-medium text-xs hover:bg-primary/20 transition text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            msg.date_time_poll_id ? (
              <div key={msg.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-text-muted text-xs mb-3">
                  {msg.sender_name || 'Someone'} · When should we meet?
                </p>
                <div className="space-y-2">
                  {(dateTimePollData[msg.date_time_poll_id] || []).map((row) => (
                    <button
                      key={row.option_index}
                      type="button"
                      onClick={() => toggleDateTimeVote(msg.date_time_poll_id, row.option_index)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left text-sm transition ${
                        row.user_voted
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-slate-200 hover:border-primary/50'
                      }`}
                    >
                      <span>
                        {formatDateWithDay(row.option_date)} · {PERIOD_OPTIONS.find((p) => p.id === row.option_period)?.label || row.option_period}
                      </span>
                      <span className="text-text-muted text-xs">{row.vote_count} vote{row.vote_count !== 1 ? 's' : ''}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => openAddDateTimeOptions(msg.date_time_poll_id)}
                  className="mt-3 text-xs text-primary hover:text-primary-hover font-medium"
                >
                  + Add options
                </button>
              </div>
            ) : msg.poll_id ? (
              <div key={msg.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-text-muted text-xs mb-3">
                  {msg.sender_name || 'Someone'} · Where should we meet?
                </p>
                <div className="space-y-2">
                  {(pollData[msg.poll_id] || []).map((row) => (
                    <div
                      key={row.option_index}
                      className="flex items-center gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => toggleVote(msg.poll_id, row.option_index)}
                        className={`flex-1 flex items-center justify-between px-3 py-2 rounded-lg border text-left text-sm transition ${
                          row.user_voted
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-slate-200 hover:border-primary/50'
                        }`}
                      >
                        <span>{row.option_text}</span>
                        <span className="text-text-muted text-xs">{row.vote_count} vote{row.vote_count !== 1 ? 's' : ''}</span>
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => openAddOptions(msg.poll_id)}
                  className="mt-3 text-xs text-primary hover:text-primary-hover font-medium"
                >
                  + Add options
                </button>
              </div>
            ) : (
              <div key={msg.id} className="flex gap-2">
                <div className="shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-text-muted text-sm font-medium">
                  {(msg.sender_name || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-text-muted text-xs">{msg.sender_name || 'Someone'}</p>
                  <p className="text-text text-sm">{msg.content}</p>
                </div>
              </div>
            )
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage} className="relative p-4 pt-2 border-t border-slate-200 bg-white">
        <div className="flex items-center gap-2 mb-2" data-scheduler-area>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowScheduler(!showScheduler) }}
            className="px-2 py-1 rounded-lg text-text-muted hover:text-primary hover:bg-primary/5 text-xs font-medium transition"
          >
            Scheduler
          </button>
        </div>
        {showScheduler && (
          <div className="absolute bottom-full left-4 right-4 mb-1 p-2 rounded-xl bg-white border border-slate-200 shadow-lg z-10" data-scheduler-area>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => {
                  setShowScheduler(false)
                  setAddingToPollId(null)
                  setShowLocationForm(true)
                  setLocationOpt1(''); setLocationOpt2(''); setLocationOpt3('')
                }}
                className="w-full px-4 py-2 rounded-lg bg-slate-50 hover:bg-primary/10 text-text text-sm font-medium text-left transition"
              >
                Find Location
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowScheduler(false)
                  setAddingToDateTimePollId(null)
                  setShowDateTimeForm(true)
                  setDtOpt1({ date: '', period: 'morning' }); setDtOpt2({ date: '', period: 'afternoon' }); setDtOpt3({ date: '', period: 'evening' })
                }}
                className="w-full px-4 py-2 rounded-lg bg-slate-50 hover:bg-primary/10 text-text text-sm font-medium text-left transition"
              >
                Find Date & Time
              </button>
            </div>
          </div>
        )}
        <div className="flex gap-2 relative">
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
