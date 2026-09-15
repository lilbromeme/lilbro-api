import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Service-role client — used ONLY inside Edge Functions, NEVER shipped to
// the browser. Every function in this directory runs server-side under
// Supabase's Deno runtime; SUPABASE_SERVICE_ROLE_KEY is injected as a
// platform secret, not read from any client bundle.
export function getSupabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured for this function')
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  })
}
