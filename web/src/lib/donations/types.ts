// Donation provider abstraction — the app must not care whether the
// eventual global provider is Stripe, Coinbase Commerce, BTCPay, a
// regional processor, or something else. Every donation rail (crypto,
// $DRACO, card) goes through this interface; DRACO_CONFIG.donations
// decides which rails are actually enabled.

export type DonationAsset = 'BTC' | 'ETH' | 'USDC' | 'USDT' | 'DRACO' | 'CARD'

export interface DonationSession {
  sessionId: string
  checkoutUrl: string | null
  asset: DonationAsset
  amount: number | null
  status: 'created' | 'pending' | 'expired'
}

export interface VerifiedDonation {
  providerPaymentId: string
  asset: DonationAsset
  amount: number
  usdValue: number | null
  txHash: string | null
  confirmed: boolean
}

export interface DonationProvider {
  readonly id: string
  readonly isMock: boolean

  /** Starts a donation flow (e.g. a hosted checkout session). Never moves funds itself. */
  createDonation(input: { asset: DonationAsset; amount?: number }): Promise<DonationSession>

  /** Polls the provider for a session's current, verified state — never trusts a client-reported amount. */
  verifyDonation(sessionId: string): Promise<VerifiedDonation | null>

  /**
   * Parses + validates an inbound provider webhook payload. Signature
   * verification happens server-side in the Edge Function
   * (supabase/functions/donations-webhook), not here — this is the
   * provider-specific payload shape translation only.
   */
  handleWebhook(payload: unknown): Promise<VerifiedDonation | null>
}
