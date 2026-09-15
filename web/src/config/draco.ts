// DRACO OS — canonical runtime configuration.
// This is the single source of truth for chain/wallet/social/launch info
// used by the fund, donate, transparency and admin surfaces.
//
// The original landing-page copy config (project name, hero copy, gallery
// placeholders) still lives in ./draco.js — this file is additive, scoped
// to the "DRACO OS" system described in the architecture doc.
//
// RULE: every field below is either a real, confirmed value or the literal
// string "PLACEHOLDER" (or null/0 for numeric/boolean fields). Never fill
// these with invented addresses, supply figures, or statistics.

export const DRACO_CONFIG = {
  projectName: 'DRACO',
  ticker: '$DRACO',

  // Set by the adapter factory in src/lib/blockchain/index.ts — until this
  // is a real chain id ('solana', 'base', etc.), the mock adapter is used.
  network: 'PLACEHOLDER',
  contractAddress: 'PLACEHOLDER',

  fundWallet: 'PLACEHOLDER',
  operationsWallet: 'PLACEHOLDER',
  liquidityWallet: 'PLACEHOLDER',

  explorerBaseUrl: 'PLACEHOLDER', // e.g. https://solscan.io/tx/ — leave placeholder until network is set

  social: {
    x: 'PLACEHOLDER',
    telegram: 'PLACEHOLDER',
    discord: 'PLACEHOLDER',
  },

  launch: {
    status: 'NOT_LAUNCHED' as 'NOT_LAUNCHED' | 'LAUNCHED',
    launchpad: 'PLACEHOLDER',
  },

  // Fee allocation percentages — must reflect the actual deployed contract.
  // Left null until the tokenomics are finalized; the accounting engine
  // treats null as "unknown allocation, do not assume a split".
  feeAllocation: {
    fundPct: null as number | null,
    operationsPct: null as number | null,
    communityPct: null as number | null,
  },

  donations: {
    // Which rails are actually wired up. Flip to true only once the
    // corresponding provider is configured end-to-end.
    cryptoEnabled: false,
    dracoTokenEnabled: false,
    cardEnabled: false,
    cardProvider: 'PLACEHOLDER',
  },
} as const

export type DracoConfig = typeof DRACO_CONFIG

/** True when DRACO_CONFIG.network is still unset — gates any "live" chain reads. */
export const isChainConfigured = () => DRACO_CONFIG.network !== 'PLACEHOLDER'
