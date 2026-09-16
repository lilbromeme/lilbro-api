import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.ts'

/**
 * Resolves the current Supabase auth session and whether that user holds
 * the 'admin' role (per user_roles table / is_admin() RLS helper). This is
 * a UX convenience only — actual enforcement happens in Postgres RLS, so a
 * spoofed client-side isAdmin=true can never read/write anything the
 * database itself wouldn't already allow.
 */
export default function useAdminSession() {
  const [session, setSession] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      setSession(data.session)

      if (data.session) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.session.user.id)
          .eq('role', 'admin')
        if (!cancelled) setIsAdmin((roles?.length ?? 0) > 0)
      }
      if (!cancelled) setLoading(false)
    }
    load()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  return { session, isAdmin, loading }
}
