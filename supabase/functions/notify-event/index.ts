// POST /notify-event — admin-only. Lets the admin dashboard (browser)
// report a case-lifecycle event (verified, approved, funded, published)
// through the central event dispatcher, WITHOUT the browser ever holding
// a Telegram bot token, Discord webhook URL, or the service-role key.
//
// The browser already performed the actual database write (cases,
// verifications, disbursements, impact_reports — all covered by RLS
// policies that already require is_admin()). This function's only job is
// to record the system_event and fire any public notification tied to
// it, using the service-role client, after re-verifying the caller is an
// admin via their own JWT.

import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { requireAdmin } from '../_shared/requireAdmin.ts'
import {
  emitCaseSubmitted,
  emitCaseVerified,
  emitCaseApproved,
  emitCaseFunded,
  emitImpactPublished,
} from '../_shared/events.ts'
import { handleOptions, corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  const auth = await requireAdmin(req)
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const supabase = getSupabaseAdmin()
  const { type } = body

  try {
    switch (type) {
      case 'CASE_SUBMITTED':
        await emitCaseSubmitted(supabase, body as never)
        break
      case 'CASE_VERIFIED':
      case 'CASE_REJECTED':
        await emitCaseVerified(supabase, body as never)
        break
      case 'CASE_APPROVED':
        await emitCaseApproved(supabase, body as never)
        break
      case 'CASE_FUNDED':
        await emitCaseFunded(supabase, body as never)
        break
      case 'IMPACT_PUBLISHED':
        await emitImpactPublished(supabase, body as never)
        break
      default:
        return new Response(JSON.stringify({ error: 'unknown event type' }), {
          status: 400,
          headers: { ...corsHeaders, 'content-type': 'application/json' },
        })
    }
  } catch (err) {
    console.error('[notify-event] failed', err)
    return new Response(JSON.stringify({ error: 'failed to emit event' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ status: 'ok' }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
})
