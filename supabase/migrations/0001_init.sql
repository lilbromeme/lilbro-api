-- DRACO OS — core schema
-- Every table here is empty until real, verified events occur.
-- Nothing in this migration seeds fake donations, dogs, or fund values.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────

create type donation_status as enum ('pending', 'confirmed', 'failed', 'refunded');
create type donation_source as enum ('crypto', 'draco_token', 'card', 'other');

create type treasury_direction as enum ('IN', 'OUT');
create type treasury_category as enum (
  'TOKEN_FEES', 'DIRECT_DONATION', 'DOG_SUPPORT', 'OPERATIONS', 'OTHER'
);
create type treasury_status as enum ('pending', 'confirmed', 'failed');

create type dog_status as enum (
  'SUBMITTED', 'VERIFICATION', 'APPROVED', 'ACTIVE', 'COMPLETED', 'ARCHIVED'
);

create type case_category as enum ('FOOD', 'MEDICAL', 'RESCUE', 'SHELTER', 'OTHER');
create type verification_status as enum ('PENDING', 'VERIFIED', 'REJECTED');
create type approval_status as enum ('PENDING', 'APPROVED', 'REJECTED');

create type verification_result as enum ('PENDING', 'VERIFIED', 'REJECTED');

create type disbursement_status as enum (
  'PENDING', 'APPROVED', 'SUBMITTED', 'CONFIRMED', 'FAILED'
);

create type impact_report_status as enum ('DRAFT', 'PUBLISHED', 'ARCHIVED');

create type milestone_type as enum ('FUND', 'DOGS_HELPED', 'DONATIONS', 'COMMUNITY');

create type app_role as enum ('admin', 'verifier', 'moderator');

-- ─────────────────────────────────────────────────────────────
-- ADMIN / ROLES
-- ─────────────────────────────────────────────────────────────

-- Maps Supabase auth users to DRACO OS roles. Empty until an operator is granted access.
create table user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  target_table text not null,
  target_id uuid,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- FUND SOURCES
-- ─────────────────────────────────────────────────────────────

create table donations (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid references auth.users(id),
  anonymous boolean not null default true,
  asset text not null,
  network text not null,
  amount numeric(38, 18) not null check (amount > 0),
  usd_value numeric(18, 2),
  tx_hash text,
  wallet_address text,
  status donation_status not null default 'pending',
  source donation_source not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  -- a given on-chain tx can only ever back one donation record
  unique (tx_hash)
);

create table token_fees (
  id uuid primary key default gen_random_uuid(),
  tx_hash text not null unique,
  network text not null,
  asset text not null,
  gross_fee numeric(38, 18) not null check (gross_fee >= 0),
  fund_allocation numeric(38, 18) not null default 0,
  operations_allocation numeric(38, 18) not null default 0,
  community_allocation numeric(38, 18) not null default 0,
  block_number bigint,
  timestamp timestamptz not null,
  status treasury_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table treasury_transactions (
  id uuid primary key default gen_random_uuid(),
  tx_hash text unique,
  network text not null,
  direction treasury_direction not null,
  wallet text not null,
  asset text not null,
  amount numeric(38, 18) not null,
  usd_value numeric(18, 2),
  category treasury_category not null,
  description text,
  status treasury_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- DOGS / CASES / VERIFICATION / DISBURSEMENT
-- ─────────────────────────────────────────────────────────────

create table dogs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  photo_url text,
  location text,
  story text,
  status dog_status not null default 'SUBMITTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table cases (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs(id) on delete cascade,
  title text not null,
  description text,
  requested_amount numeric(18, 2),
  approved_amount numeric(18, 2),
  currency text not null default 'USD',
  category case_category not null,
  veterinarian_name text,
  organization_name text,
  documents jsonb not null default '[]'::jsonb,
  verification_status verification_status not null default 'PENDING',
  approval_status approval_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table verifications (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  verifier_id uuid references auth.users(id),
  verification_type text not null,
  notes text,
  evidence_url text,
  result verification_result not null default 'PENDING',
  created_at timestamptz not null default now()
);

create table disbursements (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  amount numeric(18, 2) not null check (amount > 0),
  asset text not null,
  recipient text not null,
  recipient_wallet text,
  tx_hash text unique,
  approved_by uuid references auth.users(id),
  status disbursement_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table impact_reports (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  title text not null,
  summary text,
  amount_spent numeric(18, 2),
  evidence_urls jsonb not null default '[]'::jsonb,
  status impact_report_status not null default 'DRAFT',
  published_at timestamptz,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- MILESTONES / COMMUNITY
-- ─────────────────────────────────────────────────────────────

create table milestones (
  id uuid primary key default gen_random_uuid(),
  type milestone_type not null,
  threshold numeric(18, 2) not null,
  achieved_value numeric(18, 2),
  achieved_at timestamptz,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  -- a given threshold for a given type can only be achieved once
  unique (type, threshold)
);

create table community_members (
  id uuid primary key default gen_random_uuid(),
  wallet_address text,
  telegram_id text,
  discord_id text,
  display_name text,
  country text,
  anonymous boolean not null default true,
  contribution_total numeric(18, 2) not null default 0,
  joined_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────

create index idx_donations_status on donations(status);
create index idx_donations_created_at on donations(created_at desc);
create index idx_token_fees_status on token_fees(status);
create index idx_treasury_tx_category on treasury_transactions(category);
create index idx_treasury_tx_created_at on treasury_transactions(created_at desc);
create index idx_cases_dog_id on cases(dog_id);
create index idx_cases_approval_status on cases(approval_status);
create index idx_verifications_case_id on verifications(case_id);
create index idx_disbursements_case_id on disbursements(case_id);
create index idx_impact_reports_status on impact_reports(status);
create index idx_impact_reports_published_at on impact_reports(published_at desc);

-- ─────────────────────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_dogs_updated_at before update on dogs
  for each row execute function set_updated_at();

create trigger trg_cases_updated_at before update on cases
  for each row execute function set_updated_at();
