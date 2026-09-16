// GET /system-health — admin-only. Reports which integrations are
// actually configured, as booleans/status strings only — never leaks a
// secret value, only whether one is present. This is what backs the
// SYSTEM HEALTH panel on /admin.

import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { requireAdmin } from '../_shared/requireAdmin.ts'
import { handleOptions, corsHeaders } from '../_shared/cors.ts'

type Status = 'connected' | 'not_configured' | 'disconnected'

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  const auth = await requireAdmin(req)
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  // Database — if we got this far, the service-role client already
  // connected successfully to run the admin check above; a lightweight
  // query here confirms read access specifically.
  let database: Status = 'disconnected'
  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('milestones').select('id', { head: true, count: 'exact' }).limit(1)
    database = error ? 'disconnected' : 'connected'
  } catch {
    database = 'disconnected'
  }

  const network = Deno.env.get('DRACO_NETWORK') ?? 'PLACEHOLDER'
  const blockchain: Status = network !== 'PLACEHOLDER' && Deno.env.get('BLOCKCHAIN_RPC_URL') ? 'connected' : 'not_configured'

  const donationProvider: Status = Deno.env.get('DONATION_PROVIDER_API_KEY') ? 'connected' : 'not_configured'

  const telegram: Status =
    Deno.env.get('TELEGRAM_BOT_TOKEN') && Deno.env.get('TELEGRAM_CHAT_ID') ? 'connected' : 'not_configured'

  const discord: Status = Deno.env.get('DISCORD_WEBHOOK_URL') ? 'connected' : 'not_configured'

  const treasury: Status =
    Deno.env.get('DRACO_FUND_WALLET') && Deno.env.get('DRACO_FUND_WALLET') !== 'PLACEHOLDER'
      ? 'connected'
      : 'not_configured'

  return new Response(
    JSON.stringify({
      database,
      blockchain,
      donation_provider: donationProvider,
      telegram,
      discord,
      treasury,
      checked_at: new Date().toISOString(),
    }),
    { headers: { ...corsHeaders, 'content-type': 'application/json' } }
  )
})
