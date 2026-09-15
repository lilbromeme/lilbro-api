import type { BlockchainAdapter } from './types'
import { MockBlockchainAdapter } from './mockAdapter'
import { DRACO_CONFIG } from '../../config/draco'

export type {
  BlockchainAdapter,
  Transaction,
  TokenTransfer,
  TokenFeeEvent,
  TransactionVerification,
} from './types'
export { MockBlockchainAdapter } from './mockAdapter'

/**
 * Adapter factory. DRACO_CONFIG.network is the single switch that
 * decides which chain implementation is live.
 *
 * When the launch chain is confirmed, add a case here (e.g. 'solana',
 * 'base') that returns a real adapter implementing BlockchainAdapter —
 * nothing else in the app needs to change, because everything else
 * only talks to the BlockchainAdapter interface.
 *
 * SECURITY NOTE: if the RPC endpoint requires an API key (Infura,
 * Alchemy, etc.), do NOT put that key in a VITE_-prefixed env var — that
 * bundles it straight into the public JS. Route chain reads through a
 * small server-side proxy (an Edge Function) instead, the same way
 * token-fee-tracker already runs server-side, and have the browser call
 * that proxy rather than the RPC endpoint directly.
 */
export function getBlockchainAdapter(): BlockchainAdapter {
  switch (DRACO_CONFIG.network) {
    // case 'solana':
    //   return new SolanaAdapter({ rpcProxyUrl: '/functions/v1/chain-proxy' })
    // case 'base':
    //   return new BaseAdapter({ rpcProxyUrl: '/functions/v1/chain-proxy' })

    case 'PLACEHOLDER':
    default:
      return new MockBlockchainAdapter()
  }
}
