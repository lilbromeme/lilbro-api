// Demo/test mode — completely separate from production data.
//
// When VITE_DEMO_MODE=true, pages that read live fund/impact data should
// render clearly-labeled mock figures instead of querying Supabase, so a
// local dev environment without any real backend configured still has
// something to look at. Production builds MUST have this unset/false.

export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true'

export const DEMO_FUND_SUMMARY = {
  token_fees_usd: 1240.5,
  direct_donations_usd: 380,
  draco_donations_usd: 95.25,
  disbursed_usd: 600,
  available_usd: 1115.75,
  total_generated_usd: 1715.75,
}

export const DEMO_IMPACT_RECORDS = [
  {
    report_id: 'demo-1',
    title: 'Emergency veterinary care',
    summary: 'Demo record — not a real case.',
    amount_spent: 220,
    evidence_urls: [],
    published_at: new Date().toISOString(),
    category: 'MEDICAL',
    dog_name: 'Demo Dog',
    dog_location: 'Demo City',
    tx_hash: '0xDEMO000000000000000000000000000000000000',
    asset: 'USDC',
  },
]

export const DEMO_MILESTONES = [
  {
    id: 'demo-m1',
    type: 'FUND',
    threshold: 1000,
    achieved_value: 1240.5,
    achieved_at: new Date().toISOString(),
    title: 'PAW #001',
    description: 'Demo milestone — not real.',
  },
]
