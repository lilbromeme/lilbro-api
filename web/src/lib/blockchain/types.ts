// Shared blockchain types. Chain-agnostic on purpose — DRACO_CONFIG.network
// decides which adapter implementation is actually instantiated. The
// application must never care whether the eventual chain is Solana, Base,
// or anything else — every caller talks only to this interface.

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

export interface TokenTransfer {
  txHash: string
  network: string
  tokenAddress: string
  from: string
  to: string
  amount: number
  blockNumber: number
  timestamp: string
}

export interface TokenFeeEvent {
  txHash: string
  network: string
  asset: string
  grossFee: number
  blockNumber: number
  timestamp: string
}

export interface TransactionVerification {
  hash: string
  found: boolean
  confirmed: boolean
  confirmations: number
  blockNumber: number | null
}

export interface BlockchainAdapter {
  /** Human-readable id, e.g. "mock", "solana", "base". Never invent a real chain id here. */
  readonly id: string
  /** True only for the development mock — used to gate demo/dev-only UI and to refuse to run in a production build. */
  readonly isMock: boolean

  getNativeBalance(address: string): Promise<number>
  getTokenBalance(address: string): Promise<number>
  getTransactions(address: string): Promise<Transaction[]>
  getTokenTransfers(address: string): Promise<TokenTransfer[]>
  getFeeEvents(): Promise<TokenFeeEvent[]>
  getTransaction(txHash: string): Promise<Transaction | null>
  /** Confirms a transaction actually exists on-chain before it is trusted anywhere in the accounting pipeline. */
  verifyTransaction(txHash: string): Promise<TransactionVerification>
}
