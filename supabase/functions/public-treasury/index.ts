// GET /api/public/treasury — confirmed treasury movements only.
// Reads public_treasury_feed. Internal notes/wallet ownership metadata are
// never included; only tx hash, network, direction, asset, amount and
// category (already a whitelist enum) are exposed.

import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { handleOptions, corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 200)

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('public_treasury_feed')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[public-treasury] query failed', error)
    return new Response(JSON.stringify({ error: 'internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ transactions: data ?? [] }), {
    headers: { ...corsHeaders, 'content-type': 'application/json', 'cache-control': 'public, max-age=30' },
  })
})
