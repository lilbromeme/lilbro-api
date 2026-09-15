import type { BlockchainAdapter, Transaction, TokenFeeEvent } from './types'

/**
 * MockBlockchainAdapter — development/demo only.
 *
 * This adapter returns clearly-labeled, deterministic fake data so the
 * rest of the system (fee tracker, fund accounting, notifications) can
 * be built and tested end-to-end before a real chain is wired up.
 *
 * IT MUST NEVER BE USED IN PRODUCTION. Every value it returns is fake.
 * `isMock` is checked by the token-fee-tracker function and by the UI's
 * demo-mode banner — do not remove it or silently reuse this class for
 * anything that reaches a public page outside of DEMO_MODE.
 */
export class MockBlockchainAdapter implements BlockchainAdapter {
  readonly id = 'mock'
  readonly isMock = true as const

  async getTokenBalance(_address: string): Promise<number> {
    return 0
  }

  async getTransactions(_address: string): Promise<Transaction[]> {
    return []
  }

  async getTokenFeeEvents(): Promise<TokenFeeEvent[]> {
    // Intentionally empty. A mock adapter that fabricates fee events
    // would risk being mistaken for real fund activity somewhere
    // downstream. If you need sample data for a UI demo, generate it
    // explicitly in the demo-mode seed script, not here.
    return []
  }

  async getTransaction(_txHash: string): Promise<Transaction | null> {
    return null
  }
}
