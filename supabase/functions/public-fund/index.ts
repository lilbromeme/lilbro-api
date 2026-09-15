// GET /api/public/fund — safe, aggregate-only fund figures.
// Reads the public_fund_summary view (see 0003_public_views.sql), which is
// itself derived exclusively from confirmed rows. No raw donor data ever
// passes through this function.

import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { handleOptions, corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('public_fund_summary').select('*').maybeSingle()

  if (error) {
    console.error('[public-fund] query failed', error)
    return new Response(JSON.stringify({ error: 'internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const summary = data ?? {
    token_fees_usd: 0,
    direct_donations_usd: 0,
    draco_donations_usd: 0,
    disbursed_usd: 0,
    available_usd: 0,
    total_generated_usd: 0,
  }

  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, 'content-type': 'application/json', 'cache-control': 'public, max-age=30' },
  })
})
