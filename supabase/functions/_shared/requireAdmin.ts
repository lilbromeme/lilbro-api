// Verifies the caller's Supabase access token belongs to an admin, using
// a client scoped to THAT user's JWT (so is_admin() evaluates auth.uid()
// correctly under RLS) — never trust a client-supplied "isAdmin" flag.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function requireAdmin(req: Request): Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'missing bearer token' }
  }

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anonKey) {
    return { ok: false, status: 500, error: 'server misconfigured' }
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })

  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData?.user) {
    return { ok: false, status: 401, error: 'invalid session' }
  }

  const { data: isAdminResult, error: rpcError } = await userClient.rpc('is_admin')
  if (rpcError || !isAdminResult) {
    return { ok: false, status: 403, error: 'admin access required' }
  }

  return { ok: true, userId: userData.user.id }
}
