import type { TreasuryProvider, TransactionProposal, ProposalStatus } from './types'

/**
 * ManualTreasuryProvider — the only provider implemented today.
 *
 * It does not talk to any multisig API yet. It just records a proposal in
 * the `disbursements` table (status: PENDING) for a human admin to execute
 * manually through the actual multisig wallet's own UI (e.g. Safe), then
 * come back and paste the resulting tx hash into the admin dashboard via
 * `getConfirmedTxHash`'s caller.
 *
 * This is intentionally the least automated option — it exists so DRACO OS
 * never needs a private key to function while a real multisig integration
 * (e.g. Safe Transaction Service) is pending. Replace with a real
 * SafeTreasuryProvider once the multisig is deployed on the launch chain.
 */
export class ManualTreasuryProvider implements TreasuryProvider {
  readonly id = 'manual'

  async createProposal(input: {
    caseId: string
    amount: number
    asset: string
    recipient: string
  }): Promise<TransactionProposal> {
    return {
      id: crypto.randomUUID(),
      caseId: input.caseId,
      amount: input.amount,
      asset: input.asset,
      recipient: input.recipient,
      status: 'PROPOSED',
      createdAt: new Date().toISOString(),
      txHash: null,
    }
  }

  async getProposalStatus(_proposalId: string): Promise<ProposalStatus> {
    // Manual provider has no external system to poll — status transitions
    // happen only when an admin updates the disbursement record by hand
    // after executing the transaction through the multisig's own UI.
    return 'PROPOSED'
  }

  async getConfirmedTxHash(_proposalId: string): Promise<string | null> {
    return null
  }
}
