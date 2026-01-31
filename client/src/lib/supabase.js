import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let supabase

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
} else {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to .env to enable auth.')
  // Stub so the app still renders; auth calls will fail gracefully
  supabase = {
    auth: {
      getUser: () => Promise.resolve({ data: { user: null } }),
      signInWithPassword: () => Promise.reject(new Error('Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env')),
      signInWithOAuth: () => Promise.reject(new Error('Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env')),
      signUp: () => Promise.reject(new Error('Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env')),
      signOut: () => Promise.resolve(),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
      upsert: () => Promise.resolve({ error: new Error('Configure Supabase in .env') }),
    }),
  }
}

export { supabase }
