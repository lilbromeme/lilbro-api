// Single source of truth for "what is the fund worth right now".
//
// This module contains ONLY arithmetic over numbers that are handed to it —
// it never invents, estimates, or rounds up. Every number it touches must
// already have come from a confirmed database row or a verified on-chain
// read. If a caller doesn't have real numbers yet, it should pass zeros,
// not omit the call.
//
// The public /fund page should prefer reading the pre-computed
// `public_fund_summary` Postgres view (see supabase/migrations/0003) so the
// database is the actual source of truth; this module exists so the same
// formula is available (a) client-side for optimistic/derived display and
// (b) inside Edge Functions (a Deno-compatible copy lives at
// supabase/functions/_shared/fundAccounting.ts — keep the two in sync).

export interface FundInputs {
  tokenFeesUsd: number
  directDonationsUsd: number
  dracoDonationsUsd: number
  disbursedUsd: number
}

export interface FundSummary extends FundInputs {
  totalGeneratedUsd: number
  availableUsd: number
}

export function computeFundSummary(inputs: FundInputs): FundSummary {
  const { tokenFeesUsd, directDonationsUsd, dracoDonationsUsd, disbursedUsd } = inputs

  for (const [key, value] of Object.entries(inputs)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`fundAccounting: invalid input "${key}" = ${value}`)
    }
  }

  const totalGeneratedUsd = tokenFeesUsd + directDonationsUsd + dracoDonationsUsd
  const availableUsd = totalGeneratedUsd - disbursedUsd

  return {
    tokenFeesUsd,
    directDonationsUsd,
    dracoDonationsUsd,
    disbursedUsd,
    totalGeneratedUsd,
    availableUsd,
  }
}

export const EMPTY_FUND_SUMMARY: FundSummary = {
  tokenFeesUsd: 0,
  directDonationsUsd: 0,
  dracoDonationsUsd: 0,
  disbursedUsd: 0,
  totalGeneratedUsd: 0,
  availableUsd: 0,
}
