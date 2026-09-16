import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const isConfigured = Boolean(url && anonKey)

if (!isConfigured) {
  // Intentionally loud: a half-configured Supabase client that fails
  // silently is how you end up trusting empty data as "confirmed zero".
  // This does NOT throw, so the cinematic homepage (which needs no
  // backend) still renders — but every data-driven page will get empty
  // results until this is configured. See .env.example.
  // eslint-disable-next-line no-console
  console.warn(
    '[draco] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. ' +
      'Public data reads will return empty results until supabase/.env is configured.'
  )
}

// createClient() throws synchronously on an empty URL, so fall back to a
// harmless placeholder host in the unconfigured case rather than crashing
// every route (including ones that don't touch Supabase at all).
export const supabase: SupabaseClient = createClient(
  isConfigured ? url : 'https://placeholder.supabase.co',
  isConfigured ? anonKey : 'placeholder-anon-key',
  { auth: { persistSession: true, autoRefreshToken: true } }
)

export const isSupabaseConfigured = isConfigured
