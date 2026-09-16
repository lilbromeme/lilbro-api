// GET /api/public/impact — published impact records only.
// Reads public_impact_ledger, which only ever contains cases whose
// impact_report.status = 'PUBLISHED'. Nothing here is visible before an
// admin explicitly publishes it (see supabase/migrations/0002_rls.sql).

import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { handleOptions, corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('public_impact_ledger')
    .select('*')
    .order('published_at', { ascending: false })

  if (error) {
    console.error('[public-impact] query failed', error)
    return new Response(JSON.stringify({ error: 'internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ records: data ?? [] }), {
    headers: { ...corsHeaders, 'content-type': 'application/json', 'cache-control': 'public, max-age=30' },
  })
})
