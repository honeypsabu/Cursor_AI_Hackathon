import { createClient } from '@supabase/supabase-js'

function getSupabase(req) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// Note: getProfile returns own profile. When adding public profile endpoints, omit 'address' from select.
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
    const { full_name, avatar_url, status, age, gender, languages, interests, address, location_lat, location_lng } = req.body
    const updates = {}
    if (typeof full_name === 'string') updates.full_name = full_name
    if (typeof avatar_url === 'string') updates.avatar_url = avatar_url
    if (typeof status === 'string') updates.status = status.slice(0, 100)
    const ageNum = typeof age === 'number' ? age : parseInt(age, 10)
    if (!isNaN(ageNum) && ageNum >= 1 && ageNum <= 120) updates.age = ageNum
    if (typeof gender === 'string') updates.gender = gender
    if (Array.isArray(languages)) updates.languages = languages
    if (Array.isArray(interests)) updates.interests = interests
    if (typeof address === 'string' || address === null) updates.address = address
    if (typeof location_lat === 'number' || location_lat === null) updates.location_lat = location_lat
    if (typeof location_lng === 'number' || location_lng === null) updates.location_lng = location_lng
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
