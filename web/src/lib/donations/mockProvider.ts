import type { DonationProvider, DonationSession, VerifiedDonation, DonationAsset } from './types'

/**
 * MockDonationProvider — development only. Never returns a real checkout
 * URL and never verifies a real payment. Used so /donate's UI and the
 * webhook plumbing can be exercised end-to-end before a real global
 * provider is connected. `isMock` gates this out of any production code
 * path — see DRACO_CONFIG.donations.*Enabled flags, which stay false
 * until a real provider replaces this.
 */
export class MockDonationProvider implements DonationProvider {
  readonly id = 'mock'
  readonly isMock = true

  async createDonation(input: { asset: DonationAsset; amount?: number }): Promise<DonationSession> {
    return {
      sessionId: crypto.randomUUID(),
      checkoutUrl: null,
      asset: input.asset,
      amount: input.amount ?? null,
      status: 'created',
    }
  }

  async verifyDonation(_sessionId: string): Promise<VerifiedDonation | null> {
    return null
  }

  async handleWebhook(_payload: unknown): Promise<VerifiedDonation | null> {
    return null
  }
}
