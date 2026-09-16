import type { TreasuryProvider } from './types'
import { ManualTreasuryProvider } from './manualProvider'

export type { TreasuryProvider, TransactionProposal, ProposalStatus } from './types'

/**
 * Factory — swap in a real multisig provider (e.g. SafeTreasuryProvider)
 * once one is deployed. Nothing else in the app should construct a
 * provider directly.
 */
export function getTreasuryProvider(): TreasuryProvider {
  return new ManualTreasuryProvider()
}
