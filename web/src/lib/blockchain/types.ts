// Shared blockchain types. Chain-agnostic on purpose — DRACO_CONFIG.network
// decides which adapter implementation is actually instantiated.

export interface Transaction {
  hash: string
  network: string
  from: string
  to: string
  asset: string
  amount: number
  blockNumber: number
  timestamp: string // ISO 8601
  status: 'pending' | 'confirmed' | 'failed'
}

export interface TokenFeeEvent {
  txHash: string
  network: string
  asset: string
  grossFee: number
  blockNumber: number
  timestamp: string
}

export interface BlockchainAdapter {
  /** Human-readable id, e.g. "mock", "solana", "base". Never invent a real chain id here. */
  readonly id: string

  getTokenBalance(address: string): Promise<number>
  getTransactions(address: string): Promise<Transaction[]>
  getTokenFeeEvents(): Promise<TokenFeeEvent[]>
  getTransaction(txHash: string): Promise<Transaction | null>
}
