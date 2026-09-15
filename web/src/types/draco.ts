// Mirrors the Supabase schema in supabase/migrations/0001_init.sql.
// Keep in sync manually until we wire up `supabase gen types typescript`.

export type DonationStatus = 'pending' | 'confirmed' | 'failed' | 'refunded'
export type DonationSource = 'crypto' | 'draco_token' | 'card' | 'other'

export interface Donation {
  id: string
  donor_id: string | null
  anonymous: boolean
  asset: string
  network: string
  amount: number
  usd_value: number | null
  tx_hash: string | null
  wallet_address: string | null
  status: DonationStatus
  source: DonationSource
  created_at: string
  confirmed_at: string | null
}

export interface TokenFee {
  id: string
  tx_hash: string
  network: string
  asset: string
  gross_fee: number
  fund_allocation: number
  operations_allocation: number
  community_allocation: number
  block_number: number | null
  timestamp: string
  status: 'pending' | 'confirmed' | 'failed'
}

export type TreasuryCategory =
  | 'TOKEN_FEES'
  | 'DIRECT_DONATION'
  | 'DOG_SUPPORT'
  | 'OPERATIONS'
  | 'OTHER'

export interface TreasuryTransaction {
  id: string
  tx_hash: string | null
  network: string
  direction: 'IN' | 'OUT'
  wallet: string
  asset: string
  amount: number
  usd_value: number | null
  category: TreasuryCategory
  description: string | null
  status: 'pending' | 'confirmed' | 'failed'
  created_at: string
}

export type DogStatus =
  | 'SUBMITTED'
  | 'VERIFICATION'
  | 'APPROVED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'ARCHIVED'

export interface Dog {
  id: string
  name: string
  photo_url: string | null
  location: string | null
  story: string | null
  status: DogStatus
  created_at: string
  updated_at: string
}

export type CaseCategory = 'FOOD' | 'MEDICAL' | 'RESCUE' | 'SHELTER' | 'OTHER'

export interface DogCase {
  id: string
  dog_id: string
  title: string
  description: string | null
  requested_amount: number | null
  approved_amount: number | null
  currency: string
  category: CaseCategory
  veterinarian_name: string | null
  organization_name: string | null
  documents: unknown[]
  verification_status: 'PENDING' | 'VERIFIED' | 'REJECTED'
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED'
  created_at: string
  updated_at: string
}

export interface Verification {
  id: string
  case_id: string
  verifier_id: string | null
  verification_type: string
  notes: string | null
  evidence_url: string | null
  result: 'PENDING' | 'VERIFIED' | 'REJECTED'
  created_at: string
}

export type DisbursementStatus = 'PENDING' | 'APPROVED' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED'

export interface Disbursement {
  id: string
  case_id: string
  amount: number
  asset: string
  recipient: string
  recipient_wallet: string | null
  tx_hash: string | null
  approved_by: string | null
  status: DisbursementStatus
  created_at: string
  completed_at: string | null
}

export interface ImpactReport {
  id: string
  case_id: string
  title: string
  summary: string | null
  amount_spent: number | null
  evidence_urls: string[]
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  published_at: string | null
  created_at: string
}

export type MilestoneType = 'FUND' | 'DOGS_HELPED' | 'DONATIONS' | 'COMMUNITY'

export interface Milestone {
  id: string
  type: MilestoneType
  threshold: number
  achieved_value: number | null
  achieved_at: string | null
  title: string
  description: string | null
}

export interface CommunityMember {
  id: string
  wallet_address: string | null
  telegram_id: string | null
  discord_id: string | null
  display_name: string | null
  country: string | null
  anonymous: boolean
  contribution_total: number
  joined_at: string
}

/** Shape returned by the public_fund_summary view / /api/public/fund */
export interface PublicFundSummary {
  token_fees_usd: number
  direct_donations_usd: number
  draco_donations_usd: number
  disbursed_usd: number
  available_usd: number
  total_generated_usd: number
}
