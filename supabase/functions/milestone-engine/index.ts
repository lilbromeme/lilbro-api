// POST /milestone-engine — generic milestone check, callable on a schedule
// or triggered manually from the admin dashboard after any event that
// might move a metric. Body: { type: 'FUND' | 'DOGS_HELPED' | 'DONATIONS' | 'COMMUNITY' }
// Omit `type` to check all four.

import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { checkMilestones } from '../_shared/milestones.ts'
import { handleOptions, corsHeaders } from '../_shared/cors.ts'

const ALL_TYPES = ['FUND', 'DOGS_HELPED', 'DONATIONS', 'COMMUNITY'] as const

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  const supabase = getSupabaseAdmin()
  let requestedType: string | undefined

  if (req.method === 'POST') {
    try {
      const body = await req.json()
      requestedType = body?.type
    } catch {
      // no body is fine — checks all types
    }
  }

  const types = requestedType ? [requestedType as (typeof ALL_TYPES)[number]] : ALL_TYPES
  const results: Record<string, unknown[]> = {}

  for (const type of types) {
    results[type] = await checkMilestones(supabase, type)
  }

  return new Response(JSON.stringify({ achieved: results }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
})
