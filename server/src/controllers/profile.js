import { createClient } from '@supabase/supabase-js'

function getSupabase(req) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function getProfile(req, res) {
  try {
    const supabase = getSupabase(req)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single()
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Profile not found' })
      }
      return res.status(500).json({ error: error.message })
    }
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function updateProfile(req, res) {
  try {
    const { full_name, avatar_url } = req.body
    const updates = {}
    if (typeof full_name === 'string') updates.full_name = full_name
    if (typeof avatar_url === 'string') updates.avatar_url = avatar_url
    updates.updated_at = new Date().toISOString()
    if (Object.keys(updates).length <= 1) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }
    const supabase = getSupabase(req)
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
