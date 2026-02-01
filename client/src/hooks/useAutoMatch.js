import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { findBestMatches, getGroupNameForMatch, getActivityBucket } from '../lib/matching'

const THROTTLE_MS = 60 * 1000 // 1 minute (so opening Map can trigger matching soon after Profile)

export function useAutoMatch(profile, options = {}) {
  const { runOnEveryMount = false } = options // Map: run when you open it (throttled). Profile: run once per session.
  const hasRun = useRef(false)

  useEffect(() => {
    if (!profile?.id) return
    if (!runOnEveryMount && hasRun.current) return

    async function runAutoMatch() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const key = `lastAutoMatch_${user.id}`
        const last = localStorage.getItem(key)
        if (last && Date.now() - parseInt(last, 10) < THROTTLE_MS) return

        // Skip if we already have a pending invite for the same activity (one invite per connection)
        const myStatus = profile?.status?.trim() || ''
        const myBucket = getActivityBucket(myStatus)
        const { data: myInvites } = await supabase.rpc('get_my_invites')
        const pending = Array.isArray(myInvites) ? myInvites.filter((i) => i.status === 'pending') : []
        const alreadyInvitedForSameActivity = pending.some((i) => {
          const g = (i.group_activity || '').trim()
          return g === myStatus || g === myBucket
        })
        if (alreadyInvitedForSameActivity) return

        const { data: matchProfiles, error: rpcErr } = await supabase.rpc('get_profiles_for_matching')
        const candidates = Array.isArray(matchProfiles) ? matchProfiles : []

        if (rpcErr) {
          console.error('[AutoMatch] RPC error:', rpcErr)
          return
        }

        const myProfile = {
          id: user.id,
          ...profile,
          status: profile?.status?.trim() || '',
          interests: Array.isArray(profile?.interests) ? profile.interests : [],
        }

        // Groups of 2–5 people: find 1–4 matches
        const best = findBestMatches(myProfile, candidates, 4)

        if (best.length === 0) {
          if (candidates.length > 0) {
            console.warn('[AutoMatch]', candidates.length, 'candidates but 0 matches. Your status:', myProfile.status, '| interests:', myProfile.interests)
          }
          return
        }

        // All matched users (including current user) get an invite – both see notification
        const allMatchedIds = [user.id, ...best.map((u) => u.id)]
        const groupName = getGroupNameForMatch(profile, best)

        const { data: group, error: groupErr } = await supabase
          .from('match_groups')
          .insert({
            initiator_id: user.id,
            name: groupName,
            activity_summary: profile?.status?.trim() || null,
          })
          .select('id')
          .single()

        if (groupErr) {
          console.error('[AutoMatch] Group insert error:', groupErr)
          return
        }

        // Invite everyone – both you and the hiker get a notification
        const invites = allMatchedIds.map((invited_user_id) => ({ group_id: group.id, invited_user_id }))
        const { error: inviteErr } = await supabase.from('match_invites').insert(invites)
        if (inviteErr) {
          console.error('[AutoMatch] Invite insert error:', inviteErr)
          return
        }

        localStorage.setItem(key, String(Date.now()))
        window.dispatchEvent(new CustomEvent('refresh-invite-count'))
      } catch (err) {
        console.error('[AutoMatch] Error:', err)
      }
    }

    if (!runOnEveryMount) hasRun.current = true
    runAutoMatch()
  }, [profile?.id, profile?.status, profile?.interests, runOnEveryMount])
}
