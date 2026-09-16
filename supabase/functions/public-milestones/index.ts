// GET /api/public/milestones — achieved milestones only.
// Unmet thresholds are never exposed publicly (see public_milestones view)
// so the site never implies a target it hasn't hit yet.

import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { handleOptions, corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('public_milestones')
    .select('*')
    .order('achieved_at', { ascending: false })

  if (error) {
    console.error('[public-milestones] query failed', error)
    return new Response(JSON.stringify({ error: 'internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ milestones: data ?? [] }), {
    headers: { ...corsHeaders, 'content-type': 'application/json', 'cache-control': 'public, max-age=30' },
  })
})
