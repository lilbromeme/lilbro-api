// DRACO OS — token-fee-tracker
//
// Intended to run on a schedule (Supabase cron / pg_cron trigger hitting
// this function's URL every N minutes). Flow, per the architecture doc:
//
//   blockchain -> detect tx -> verify -> identify fee allocation
//     -> dedupe by tx_hash -> insert token_fees -> update treasury
//     -> check milestones -> notify
//
// This function currently runs against the MOCK blockchain adapter's
// getTokenFeeEvents(), which always returns an empty array — see
// web/src/lib/blockchain/mockAdapter.ts. It is fully wired end-to-end so
// that once a real adapter is implemented for the launch chain, this
// function needs zero changes: just swap the adapter construction below.

import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { checkMilestones } from '../_shared/milestones.ts'
import { emitTokenFeeReceived } from '../_shared/events.ts'
import { handleOptions, corsHeaders } from '../_shared/cors.ts'

// Deno can't import the Vite-built web/src tree directly, so the adapter
// selection is mirrored here. Replace this stub with the real adapter
// import once the launch chain is finalized (mirrors
// web/src/lib/blockchain/index.ts's factory logic).
interface TokenFeeEvent {
  txHash: string
  network: string
  asset: string
  grossFee: number
  blockNumber: number
  timestamp: string
}

async function getTokenFeeEventsFromChain(): Promise<TokenFeeEvent[]> {
  const network = Deno.env.get('DRACO_NETWORK') ?? 'PLACEHOLDER'
  if (network === 'PLACEHOLDER') {
    // No chain configured yet — nothing to poll. This is the expected
    // state until a launch chain + RPC/indexer is provided.
    return []
  }
  // TODO: instantiate the real adapter for `network` and call
  // adapter.getTokenFeeEvents() here once it exists.
  return []
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  const supabase = getSupabaseAdmin()
  const feeAllocation = {
    fundPct: Number(Deno.env.get('DRACO_FEE_FUND_PCT') ?? 'NaN'),
    operationsPct: Number(Deno.env.get('DRACO_FEE_OPS_PCT') ?? 'NaN'),
    communityPct: Number(Deno.env.get('DRACO_FEE_COMMUNITY_PCT') ?? 'NaN'),
  }

  const events = await getTokenFeeEventsFromChain()
  let inserted = 0
  let skippedDuplicate = 0

  for (const event of events) {
    // Idempotency: tx_hash has a unique constraint, so a duplicate insert
    // is rejected at the database level. We check first for a clean skip
    // count, but the unique constraint is the real guarantee.
    const { data: existing } = await supabase
      .from('token_fees')
      .select('id')
      .eq('tx_hash', event.txHash)
      .maybeSingle()

    if (existing) {
      skippedDuplicate++
      continue
    }

    const hasKnownAllocation =
      Number.isFinite(feeAllocation.fundPct) &&
      Number.isFinite(feeAllocation.operationsPct) &&
      Number.isFinite(feeAllocation.communityPct)

    const fundAllocation = hasKnownAllocation ? event.grossFee * (feeAllocation.fundPct / 100) : 0
    const operationsAllocation = hasKnownAllocation
      ? event.grossFee * (feeAllocation.operationsPct / 100)
      : 0
    const communityAllocation = hasKnownAllocation
      ? event.grossFee * (feeAllocation.communityPct / 100)
      : 0

    const { error: insertError } = await supabase.from('token_fees').insert({
      tx_hash: event.txHash,
      network: event.network,
      asset: event.asset,
      gross_fee: event.grossFee,
      fund_allocation: fundAllocation,
      operations_allocation: operationsAllocation,
      community_allocation: communityAllocation,
      block_number: event.blockNumber,
      timestamp: event.timestamp,
      status: 'confirmed',
    })

    if (insertError) {
      // Unique violation = another invocation beat us to it. Anything else
      // is a real error worth logging loudly.
      if (!insertError.message.includes('duplicate key')) {
        console.error('[token-fee-tracker] insert failed', insertError)
      }
      continue
    }

    await supabase.from('treasury_transactions').insert({
      tx_hash: event.txHash,
      network: event.network,
      direction: 'IN',
      wallet: 'PLACEHOLDER', // fund wallet address, once configured
      asset: event.asset,
      amount: fundAllocation,
      category: 'TOKEN_FEES',
      description: 'DRACO token fee allocation',
      status: 'confirmed',
    })

    inserted++

    await emitTokenFeeReceived(supabase, { amountUsd: fundAllocation, txHash: event.txHash })
  }

  if (inserted > 0) {
    await checkMilestones(supabase, 'FUND')
  }

  return new Response(JSON.stringify({ inserted, skippedDuplicate, checked: events.length }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
})
