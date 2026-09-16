// Treasury abstraction — deliberately does NOT support a single
// private-key-controlled wallet. Every implementation of this interface
// must route fund movement through an external approval mechanism
// (multisig, timelock, etc.) that this application never holds the keys
// to. Do not add a method here that submits a transaction directly from a
// key stored in Supabase or the frontend — that is the one thing this
// abstraction exists to prevent.

export type ProposalStatus = 'PROPOSED' | 'APPROVED' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED'

export interface TransactionProposal {
  id: string
  caseId: string
  amount: number
  asset: string
  recipient: string
  status: ProposalStatus
  createdAt: string
  txHash: string | null
}

export interface TreasuryProvider {
  readonly id: string

  /**
   * Creates a proposal for a disbursement. This does NOT move funds — it
   * only records intent for the multisig signers (or equivalent approval
   * flow) to act on outside of this application.
   */
  createProposal(input: {
    caseId: string
    amount: number
    asset: string
    recipient: string
  }): Promise<TransactionProposal>

  /** Polls the external approval mechanism for a proposal's current status. */
  getProposalStatus(proposalId: string): Promise<ProposalStatus>

  /** Once confirmed on-chain, returns the tx hash for the disbursements record. */
  getConfirmedTxHash(proposalId: string): Promise<string | null>
}
