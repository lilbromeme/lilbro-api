// Central place for all editable DRACO project information.
// Replace placeholders as real information becomes available.
// Do NOT fabricate data — leave fields as PLACEHOLDER / null / 0 until confirmed.

export const project = {
  name: 'DRACO',
  ticker: '$DRACO',
  philosophy: 'ONE DOG. A MILLION SECOND CHANCES.',
  secondaryPhilosophy: 'FOR DRACO. FOR EVERY DOG.',
}

export const token = {
  name: 'DRACO',
  symbol: '$DRACO',
  network: 'PLACEHOLDER',
  contract: 'PLACEHOLDER',
  supply: 'PLACEHOLDER',
  launched: false,
  buyLink: null,
}

export const social = {
  x: 'https://x.com/PLACEHOLDER',
  telegram: 'https://t.me/PLACEHOLDER',
}

export const fund = {
  wallet: 'PLACEHOLDER',
  verified: true,
}

// These MUST remain zero / empty until real, verified data exists.
export const stats = {
  dogsHelped: 0,
  treatments: 0,
  meals: 0,
  totalImpactBDT: 0,
}

export const launchStatus = {
  live: false,
  stage: 'PRE-LAUNCH',
}

// Gallery memory placeholders — replace with real Draco memories.
export const memories = [
  { day: '001', label: 'DAY 001', text: 'MEMORY PLACEHOLDER', image: '/images/draco-hero.jpg' },
  { day: '147', label: 'DAY 147', text: 'MEMORY PLACEHOLDER', image: '/images/draco-2.jpg' },
  { day: '382', label: 'DAY 382', text: 'MEMORY PLACEHOLDER', image: '/images/draco-hero.jpg' },
  { day: 'INF', label: 'DAY ∞', text: 'MEMORY PLACEHOLDER', image: '/images/draco-2.jpg' },
]

// Impact ledger entries — populate only with real, verified donations.
export const ledgerEntries = [
  {
    id: '001',
    status: 'WAITING FOR FIRST CHAPTER',
    dog: '—',
    location: '—',
    purpose: '—',
    amount: '৳0',
    tx: '—',
  },
]

// Milestones the fund hasn't reached yet — shown as "waiting to be written".
export const milestones = [
  { id: '01', title: 'FIRST DOG' },
  { id: '02', title: 'FIRST TREATMENT' },
  { id: '03', title: 'FIRST RESCUE' },
]

// Future dog stories — do not fabricate. Populate as real cases arrive.
export const dogStories = []

// Archive sections
export const archiveItems = [
  { id: 'story', title: "DRACO'S STORY" },
  { id: 'memories', title: 'MEMORIES' },
  { id: 'dogs', title: 'DOGS WE HELP' },
  { id: 'community', title: 'COMMUNITY MOMENTS' },
  { id: 'reports', title: 'FUND REPORTS' },
]
