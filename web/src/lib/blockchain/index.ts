import type { BlockchainAdapter } from './types'
import { MockBlockchainAdapter } from './mockAdapter'
import { DRACO_CONFIG } from '../../config/draco'

export type { BlockchainAdapter, Transaction, TokenFeeEvent } from './types'
export { MockBlockchainAdapter } from './mockAdapter'

/**
 * Adapter factory. DRACO_CONFIG.network is the single switch that
 * decides which chain implementation is live.
 *
 * When the launch chain is confirmed, add a case here (e.g. 'solana',
 * 'base') that returns a real adapter implementing BlockchainAdapter —
 * nothing else in the app needs to change, because everything else
 * only talks to the BlockchainAdapter interface.
 */
export function getBlockchainAdapter(): BlockchainAdapter {
  switch (DRACO_CONFIG.network) {
    // case 'solana':
    //   return new SolanaAdapter({ rpcUrl: import.meta.env.VITE_BLOCKCHAIN_RPC_URL })
    // case 'base':
    //   return new BaseAdapter({ rpcUrl: import.meta.env.VITE_BLOCKCHAIN_RPC_URL })

    case 'PLACEHOLDER':
    default:
      return new MockBlockchainAdapter()
  }
}
