import type {
  BlockchainAdapter,
  Transaction,
  TokenTransfer,
  TokenFeeEvent,
  TransactionVerification,
} from './types'

/**
 * MockBlockchainAdapter — development/demo only.
 *
 * This adapter returns clearly-labeled, deterministic empty/zero data so
 * the rest of the system (fee tracker, fund accounting, notifications)
 * can be built and tested end-to-end before a real chain is wired up.
 *
 * IT MUST NEVER BE USED IN PRODUCTION. `isMock` is checked by the
 * token-fee-tracker function, the reconciliation page, and the launch
 * readiness page — do not remove it or silently reuse this class for
 * anything that reaches a public page outside of DEMO_MODE.
 */
export class MockBlockchainAdapter implements BlockchainAdapter {
  readonly id = 'mock'
  readonly isMock = true

  async getNativeBalance(_address: string): Promise<number> {
    return 0
  }

  async getTokenBalance(_address: string): Promise<number> {
    return 0
  }

  async getTransactions(_address: string): Promise<Transaction[]> {
    return []
  }

  async getTokenTransfers(_address: string): Promise<TokenTransfer[]> {
    return []
  }

  async getFeeEvents(): Promise<TokenFeeEvent[]> {
    // Intentionally empty. A mock adapter that fabricates fee events
    // would risk being mistaken for real fund activity somewhere
    // downstream. If you need sample data for a UI demo, generate it
    // explicitly in demo mode (src/lib/demoMode.ts), not here.
    return []
  }

  async getTransaction(_txHash: string): Promise<Transaction | null> {
    return null
  }

  async verifyTransaction(_txHash: string): Promise<TransactionVerification> {
    return { hash: _txHash, found: false, confirmed: false, confirmations: 0, blockNumber: null }
  }
}
