import type { DonationProvider } from './types'
import { MockDonationProvider } from './mockProvider'

export type { DonationProvider, DonationSession, VerifiedDonation, DonationAsset } from './types'
export { MockDonationProvider } from './mockProvider'

/**
 * Factory — swap in a real provider once one is chosen. Nothing else in
 * the app should construct a provider directly. Until
 * DRACO_CONFIG.donations.cryptoEnabled / cardEnabled / dracoTokenEnabled
 * are flipped true, /donate shows "COMING SOON" instead of calling this
 * at all.
 */
export function getDonationProvider(): DonationProvider {
  // case 'stripe': return new StripeDonationProvider(...)
  // case 'coinbase_commerce': return new CoinbaseCommerceProvider(...)
  return new MockDonationProvider()
}
