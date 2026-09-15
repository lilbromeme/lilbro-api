import { supabase } from './supabaseClient.ts'

/**
 * Calls an admin-only Edge Function (system-health, reconciliation) with
 * the current user's access token. These functions re-verify admin status
 * server-side via requireAdmin() — this is a convenience wrapper, not the
 * security boundary itself.
 */
export async function callAdminFunction(name, { method = 'GET', body } = {}) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('not signed in')

  const baseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!baseUrl) throw new Error('VITE_SUPABASE_URL not configured')

  const res = await fetch(`${baseUrl}/functions/v1/${name}`, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${name} failed (${res.status}): ${text}`)
  }

  return res.json()
}
