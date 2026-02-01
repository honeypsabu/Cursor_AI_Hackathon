import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { findBestMatches, getGroupNameForMatch, getActivityBucket } from '../lib/matching'

export default function Notifications() {
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [runMatchStatus, setRunMatchStatus] = useState(null)
  const navigate = useNavigate()

  async function loadInvites() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      navigate('/login', { replace: true })
      return
    }
    setCurrentUserId(user.id)
    const { data } = await supabase.rpc('get_my_invites')
    const list = Array.isArray(data) ? data : []
    // One invite per activity (dedupe in case of legacy duplicates)
    const seenActivity = new Set()
    const deduped = list.filter((inv) => {
      const key = (inv.group_activity || '').trim() || inv.group_id
      if (seenActivity.has(key)) return false
      seenActivity.add(key)
      return true
    })
    setInvites(deduped)
  }

  useEffect(() => {
    loadInvites().finally(() => setLoading(false))
  }, [navigate])

  useEffect(() => {
    const onRefresh = () => loadInvites()
    window.addEventListener('refresh-invite-count', onRefresh)
    return () => window.removeEventListener('refresh-invite-count', onRefresh)
  }, [])

  function refreshInviteCount() {
    window.dispatchEvent(new CustomEvent('refresh-invite-count'))
  }

  async function clearAllGroups() {
    setRunMatchStatus('Deleting all groups and invites...')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.rpc('clear_my_groups')
      if (error) {
        const rpcMissing = error.code === 'PGRST202' || (error.message && error.message.includes('clear_my_groups'))
        if (rpcMissing) {
          await supabase.from('match_groups').delete().eq('initiator_id', user.id)
          await supabase.from('match_invites').delete().eq('invited_user_id', user.id)
          await supabase.from('group_members').delete().eq('user_id', user.id)
        } else {
          setRunMatchStatus(`Error: ${error.message}`)
          return
        }
      }

      setRunMatchStatus('Cleared. Ready for fresh matching.')
      setInvites([])
      refreshInviteCount()
    } catch (err) {
      setRunMatchStatus(`Error: ${err.message}`)
    }
  }

  async function resetAndRunMatching() {
    setRunMatchStatus('Cleaning up old invites and groups...')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      // Delete your pending invites and groups you initiated
      const { data: myInvites } = await supabase.from('match_invites').select('id, group_id').eq('invited_user_id', user.id)
      if (myInvites && myInvites.length > 0) {
        const groupIds = myInvites.map((i) => i.group_id)
        await supabase.from('match_groups').delete().in('id', groupIds)
      }
      
      setRunMatchStatus('Running matching...')
      const { data: profile } = await supabase.from('profiles').select('status, interests').eq('id', user.id).single()
      const myStatus = profile?.status?.trim() || ''
      const myBucket = getActivityBucket(myStatus)
      const { data: currentInvites } = await supabase.rpc('get_my_invites')
      const pending = Array.isArray(currentInvites) ? currentInvites.filter((i) => i.status === 'pending') : []
      const alreadyInvitedForSameActivity = pending.some((i) => {
        const g = (i.group_activity || '').trim()
        return g === myStatus || g === myBucket
      })
      if (alreadyInvitedForSameActivity) {
        setRunMatchStatus('You already have a pending invite for this activity.')
        return
      }
      const { data: matchProfiles, error: rpcErr } = await supabase.rpc('get_profiles_for_matching')
      const candidates = Array.isArray(matchProfiles) ? matchProfiles : []
      if (rpcErr) {
        setRunMatchStatus(`Error: ${rpcErr.message}`)
        return
      }
      const myProfile = {
        id: user.id,
        ...profile,
        status: myStatus,
        interests: Array.isArray(profile?.interests) ? profile.interests : [],
      }
      const best = findBestMatches(myProfile, candidates, 4)
      if (best.length === 0) {
        setRunMatchStatus(candidates.length === 0
          ? 'No other users with status or interests yet. Honey Sabu needs to add "hiking" or Outdoor interest.'
          : `${candidates.length} candidates, but none matched. Your status: "${myProfile.status}" | interests: ${(myProfile.interests || []).join(', ') || 'none'}`)
        return
      }
      const groupName = getGroupNameForMatch(profile, best)
      const { data: group, error: groupErr } = await supabase
        .from('match_groups')
        .insert({ initiator_id: user.id, name: groupName, activity_summary: profile?.status?.trim() || null })
        .select('id')
        .single()
      if (groupErr) {
        setRunMatchStatus(`Error creating group: ${groupErr.message}`)
        return
      }
      const invitesToCreate = [user.id, ...best.map((u) => u.id)].map((invited_user_id) => ({ group_id: group.id, invited_user_id }))
      const { error: inviteErr } = await supabase.from('match_invites').insert(invitesToCreate)
      if (inviteErr) {
        setRunMatchStatus(`Error sending invites: ${inviteErr.message}`)
        return
      }
      await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id })
      setRunMatchStatus(`Sent invites to you and ${best.length} other(s). Check above.`)
      refreshInviteCount()
      const { data: invs } = await supabase.rpc('get_my_invites')
      setInvites(invs || [])
    } catch (err) {
      setRunMatchStatus(`Error: ${err.message}`)
    }
  }

  async function accept(invite) {
    setActioning(invite.id)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error: updateErr } = await supabase.from('match_invites').update({
        status: 'accepted',
        read_at: new Date().toISOString(),
      }).eq('id', invite.id)
      if (updateErr) {
        setRunMatchStatus(`Error: ${updateErr.message}`)
        return
      }
      const { error: memberErr } = await supabase.from('group_members').insert({
        group_id: invite.group_id,
        user_id: user.id,
      })
      // 23505 = duplicate key (already a member) — treat as success
      if (memberErr && memberErr.code !== '23505') {
        setRunMatchStatus(`Could not join group: ${memberErr.message}`)
        return
      }
      setInvites((prev) => prev.map((i) => (i.id === invite.id ? { ...i, status: 'accepted' } : i)))
      refreshInviteCount()
    } finally {
      setActioning(null)
    }
  }

  async function decline(invite) {
    setActioning(invite.id)
    try {
      await supabase.from('match_invites').update({
        status: 'declined',
        read_at: new Date().toISOString(),
      }).eq('id', invite.id)
      setInvites((prev) => prev.map((i) => (i.id === invite.id ? { ...i, status: 'declined' } : i)))
      refreshInviteCount()
    } finally {
      setActioning(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-text flex items-center justify-center">
        <p className="text-text-muted">Loading notifications...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-text flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-text">Notifications</h2>
          <Link to="/profile" className="text-sm text-primary hover:text-primary-hover font-medium">
            Back to profile
          </Link>
        </div>
        {invites.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-text-muted mb-4">No notifications yet.</p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={resetAndRunMatching}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium"
              >
                Reset & run matching
              </button>
              <button
                type="button"
                onClick={clearAllGroups}
                className="px-4 py-2 rounded-lg bg-slate-100 border border-slate-200 hover:bg-slate-200 text-text text-sm font-medium"
              >
                Clear all notifications
              </button>
            </div>
            {runMatchStatus && (
              <p className="mt-4 text-sm text-text-muted max-w-md mx-auto">{runMatchStatus}</p>
            )}
          </div>
        ) : (
          <>
            <div className="mb-4 text-right">
              <button
                type="button"
                onClick={clearAllGroups}
                className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 hover:bg-slate-200 text-text-muted text-xs font-medium"
              >
                Clear all notifications
              </button>
            </div>
          <ul className="space-y-4">
            {invites.map((inv) => {
              const isInitiator = inv.initiator_id === currentUserId
              const groupName = inv.group_name || 'Meetup'
              const activity = inv.group_activity
              return (
                <li
                  key={inv.id}
                  className={`rounded-xl p-4 border ${
                    inv.status === 'pending' ? 'bg-slate-50 border-primary/30' : 'bg-slate-50/60 border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium shrink-0" aria-hidden>
                      <span className="text-lg">✨</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-text font-medium">{groupName}</p>
                      <p className="text-text-muted text-sm mt-0.5">
                        {isInitiator ? 'You found a match' : 'You have a new match'}{activity ? ` — ${activity}` : ''}
                      </p>
                      {inv.status === 'pending' && (
                        <div className="flex gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => accept(inv)}
                            disabled={actioning === inv.id}
                            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium disabled:opacity-50"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => decline(inv)}
                            disabled={actioning === inv.id}
                            className="px-4 py-2 rounded-lg bg-slate-100 border border-slate-200 hover:bg-slate-200 text-text text-sm font-medium disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                      {inv.status === 'accepted' && (
                        <Link
                          to={`/groups/${inv.group_id}`}
                          className="inline-block mt-3 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary-hover text-white text-sm font-medium"
                        >
                          Open group chat
                        </Link>
                      )}
                      {inv.status === 'declined' && <p className="text-text-light text-sm mt-2">Declined</p>}
                    </div>
                  </div>
                </li>
            )
          })}
        </ul>
          </>
      )}
      </div>
    </div>
  )
}
