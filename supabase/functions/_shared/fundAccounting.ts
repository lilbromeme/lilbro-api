// Deno-runtime copy of web/src/lib/fundAccounting.ts — keep formulas identical.
// Duplicated (rather than imported across the web/Edge Function boundary)
// because Edge Functions run on Deno and the frontend runs through Vite;
// there is no shared build step between them today. If that changes,
// collapse these into one module.

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
  const totalGeneratedUsd = tokenFeesUsd + directDonationsUsd + dracoDonationsUsd
  const availableUsd = totalGeneratedUsd - disbursedUsd
  return { ...inputs, totalGeneratedUsd, availableUsd }
}
