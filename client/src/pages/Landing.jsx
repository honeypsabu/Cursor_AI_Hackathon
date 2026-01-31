import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Landing() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl md:text-5xl font-bold mb-4 text-center">
        Hackathon App
      </h1>
      <p className="text-slate-300 text-lg mb-10 text-center max-w-md">
        Create your profile. Sign up with Google or email to get started.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        {user ? (
          <Link
            to="/profile"
            className="px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 font-medium transition"
          >
            View my profile
          </Link>
        ) : (
          <>
            <Link
              to="/signup"
              className="px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 font-medium transition"
            >
              Sign up with Email
            </Link>
            <Link
              to="/login"
              className="px-6 py-3 rounded-lg border border-slate-500 hover:border-slate-400 font-medium transition"
            >
              Log in
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
