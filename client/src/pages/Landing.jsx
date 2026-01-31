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
    <div className="min-h-screen bg-background text-text flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4">Glimmer</h1>
      <p className="text-text-muted text-lg md:text-xl mb-10 text-center max-w-xl leading-relaxed">
        Connection is better in person. With Glimmer, find nearby friends who share your wavelength and start making memories through the activities you love.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 items-center flex-wrap justify-center">
        {user ? (
          <>
            <Link
              to="/profile"
              className="px-6 py-3 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium transition"
            >
              View my profile
            </Link>
            <Link
              to="/chats"
              className="px-6 py-3 rounded-lg border-2 border-primary text-primary hover:bg-primary hover:text-white font-medium transition"
            >
              Chats
            </Link>
          </>
        ) : (
          <>
            <Link
              to="/signup"
              className="px-6 py-3 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium transition"
            >
              Sign up with Email
            </Link>
            <Link
              to="/login"
              className="px-6 py-3 rounded-lg border-2 border-primary text-primary hover:bg-primary hover:text-white font-medium transition"
            >
              Log in
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
