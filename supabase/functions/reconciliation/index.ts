// GET /reconciliation — admin-only. Compares three independent views of
// the fund's state and reports whether they agree:
//
//   1. BLOCKCHAIN BALANCE   — what the chain itself says the fund wallet holds
//   2. DATABASE ACCOUNTING  — public_fund_summary.available_usd
//   3. RECORDED DISBURSEMENTS — sum of confirmed disbursements
//
// This never silently hides a discrepancy — if the blockchain adapter is
// still the mock (or the network isn't configured), the response says so
// explicitly rather than reporting a false "reconciled".

import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { requireAdmin } from '../_shared/requireAdmin.ts'
import { handleOptions, corsHeaders } from '../_shared/cors.ts'

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

  const supabase = getSupabaseAdmin()

  const { data: fundSummary } = await supabase.from('public_fund_summary').select('*').maybeSingle()
  const { data: disbursements } = await supabase
    .from('disbursements')
    .select('amount')
    .eq('status', 'CONFIRMED')

  const recordedDisbursementsUsd = (disbursements ?? []).reduce((sum, d) => sum + Number(d.amount), 0)
  const databaseAvailableUsd = fundSummary?.available_usd ?? 0

  const network = Deno.env.get('DRACO_NETWORK') ?? 'PLACEHOLDER'
  const blockchainConfigured = network !== 'PLACEHOLDER' && Boolean(Deno.env.get('BLOCKCHAIN_RPC_URL'))

  // Without a real chain adapter wired up, there is no blockchain balance
  // to compare against — report that plainly instead of pretending 0 is
  // a real, reconciled balance.
  const blockchainBalanceUsd: number | null = blockchainConfigured ? null : null
  // TODO once a real BlockchainAdapter exists: fetch getTokenBalance(fundWallet)
  // here, convert to USD, and compare below.

  const disbursementsMatch = Math.abs(recordedDisbursementsUsd - (fundSummary?.disbursed_usd ?? 0)) < 0.01

  const status =
    !blockchainConfigured
      ? 'BLOCKCHAIN_NOT_CONFIGURED'
      : blockchainBalanceUsd === null
        ? 'BLOCKCHAIN_READ_UNAVAILABLE'
        : disbursementsMatch && Math.abs(blockchainBalanceUsd - databaseAvailableUsd) < 0.01
          ? 'RECONCILED'
          : 'RECONCILIATION_REQUIRED'

  return new Response(
    JSON.stringify({
      status,
      blockchain_balance_usd: blockchainBalanceUsd,
      database_available_usd: databaseAvailableUsd,
      recorded_disbursements_usd: recordedDisbursementsUsd,
      disbursements_internally_consistent: disbursementsMatch,
      checked_at: new Date().toISOString(),
    }),
    { headers: { ...corsHeaders, 'content-type': 'application/json' } }
  )
})
