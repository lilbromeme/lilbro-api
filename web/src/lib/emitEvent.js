import { supabase } from './supabaseClient.ts'

/**
 * Calls the notify-event Edge Function so case-lifecycle events recorded
 * by the admin dashboard flow through the central dispatcher (system
 * activity feed + Telegram/Discord) instead of the browser trying to
 * notify directly — the browser never holds those secrets.
 */
export async function emitEvent(type, payload) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) {
    console.warn('[emitEvent] no active session — skipping', type)
    return
  }

  const baseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!baseUrl) {
    console.warn('[emitEvent] VITE_SUPABASE_URL not configured — skipping', type)
    return
  }

  try {
    const res = await fetch(`${baseUrl}/functions/v1/notify-event`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ type, ...payload }),
    })
    if (!res.ok) {
      console.error('[emitEvent] notify-event failed', type, await res.text())
    }
  } catch (err) {
    console.error('[emitEvent] notify-event request failed', type, err)
  }
}
