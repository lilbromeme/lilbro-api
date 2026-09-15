// Central event dispatcher — every "something real happened" moment in
// DRACO OS flows through here instead of each caller hand-rolling its own
// system_events insert + notification logic. This is what STEP 16 in the
// architecture doc calls for: one dispatcher, not duplicated notify calls
// scattered across token-fee-tracker, donations-webhook, milestones, and
// case management.
//
// Events that represent public-worthy proof (a confirmed donation, a
// received fee, a funded case, a published impact report, an achieved
// milestone) also fan out to Telegram/Discord. Internal-only events
// (case submitted/verified/rejected/approved) are recorded to
// system_events for the admin activity stream but never sent externally —
// a case isn't public proof of anything until its impact report is
// published.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { notifyAll } from './notify.ts'

export type SystemEventType =
  | 'DONATION_CONFIRMED'
  | 'TOKEN_FEE_RECEIVED'
  | 'CASE_SUBMITTED'
  | 'CASE_VERIFIED'
  | 'CASE_REJECTED'
  | 'CASE_APPROVED'
  | 'CASE_FUNDED'
  | 'IMPACT_PUBLISHED'
  | 'MILESTONE_REACHED'

const PUBLIC_NOTIFY_TYPES: SystemEventType[] = [
  'DONATION_CONFIRMED',
  'TOKEN_FEE_RECEIVED',
  'CASE_FUNDED',
  'IMPACT_PUBLISHED',
  'MILESTONE_REACHED',
]

async function recordEvent(
  supabase: SupabaseClient,
  type: SystemEventType,
  summary: string,
  metadata: Record<string, unknown> = {}
) {
  const { error } = await supabase.from('system_events').insert({ type, summary, metadata })
  if (error) console.error('[events] failed to record system_event', type, error)
}

async function currentFundTotal(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase.from('public_fund_summary').select('total_generated_usd').maybeSingle()
  return data?.total_generated_usd ?? 0
}

function usd(n: number) {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

export async function emitDonationConfirmed(
  supabase: SupabaseClient,
  input: { amountUsd: number; source: string }
) {
  await recordEvent(supabase, 'DONATION_CONFIRMED', `Donation confirmed: ${usd(input.amountUsd)}`, input)
  const totalFundUsd = await currentFundTotal(supabase)
  await notifyAll({ kind: 'fund_update', amountUsd: input.amountUsd, source: input.source, totalFundUsd })
}

export async function emitTokenFeeReceived(
  supabase: SupabaseClient,
  input: { amountUsd: number; txHash: string }
) {
  await recordEvent(supabase, 'TOKEN_FEE_RECEIVED', `Token fee detected: ${usd(input.amountUsd)}`, input)
  const totalFundUsd = await currentFundTotal(supabase)
  await notifyAll({
    kind: 'fund_update',
    amountUsd: input.amountUsd,
    source: 'DRACO fee allocation',
    totalFundUsd,
  })
}

export async function emitCaseSubmitted(supabase: SupabaseClient, input: { caseId: string; title: string }) {
  await recordEvent(supabase, 'CASE_SUBMITTED', `Case submitted: ${input.title}`, input)
}

export async function emitCaseVerified(
  supabase: SupabaseClient,
  input: { caseId: string; title: string; result: 'VERIFIED' | 'REJECTED' }
) {
  const type: SystemEventType = input.result === 'VERIFIED' ? 'CASE_VERIFIED' : 'CASE_REJECTED'
  await recordEvent(supabase, type, `Case ${input.result.toLowerCase()}: ${input.title}`, input)
}

export async function emitCaseApproved(
  supabase: SupabaseClient,
  input: { caseId: string; title: string; amount: number }
) {
  await recordEvent(supabase, 'CASE_APPROVED', `Case approved: ${input.title} (${usd(input.amount)})`, input)
}

export async function emitCaseFunded(
  supabase: SupabaseClient,
  input: { caseId: string; caseNumber: string; purpose: string; amountUsd: number; proofUrl: string | null }
) {
  await recordEvent(supabase, 'CASE_FUNDED', `Case funded: ${input.purpose} (${usd(input.amountUsd)})`, input)
  await notifyAll({
    kind: 'impact',
    caseNumber: input.caseNumber,
    purpose: input.purpose,
    amountUsd: input.amountUsd,
    proofUrl: input.proofUrl,
  })
}

export async function emitImpactPublished(
  supabase: SupabaseClient,
  input: { caseId: string; caseNumber: string; title: string; amountUsd: number; proofUrl: string | null }
) {
  await recordEvent(supabase, 'IMPACT_PUBLISHED', `Impact report published: ${input.title}`, input)
  await notifyAll({
    kind: 'impact',
    caseNumber: input.caseNumber,
    purpose: input.title,
    amountUsd: input.amountUsd,
    proofUrl: input.proofUrl,
  })
}

export async function emitMilestoneReached(
  supabase: SupabaseClient,
  input: { pawNumber: string; thresholdUsd: number; type: string; milestoneId: string; title: string }
) {
  await recordEvent(supabase, 'MILESTONE_REACHED', `Milestone reached: ${input.title}`, input)
  await notifyAll({ kind: 'milestone', pawNumber: input.pawNumber, thresholdUsd: input.thresholdUsd, type: input.type })
}

export function isPublicEvent(type: SystemEventType) {
  return PUBLIC_NOTIFY_TYPES.includes(type)
}
