-- DRACO OS — system events, evidence storage, immutability, rate limiting.

-- ─────────────────────────────────────────────────────────────
-- system_events — the single feed the admin activity stream and
-- the event dispatcher write to. Admin-only; this is operational
-- telemetry, not a public transparency surface (that's impact_reports
-- and the public_* views).
-- ─────────────────────────────────────────────────────────────

create type system_event_type as enum (
  'DONATION_CONFIRMED',
  'TOKEN_FEE_RECEIVED',
  'CASE_SUBMITTED',
  'CASE_VERIFIED',
  'CASE_REJECTED',
  'CASE_APPROVED',
  'CASE_FUNDED',
  'IMPACT_PUBLISHED',
  'MILESTONE_REACHED'
);

create table system_events (
  id uuid primary key default gen_random_uuid(),
  type system_event_type not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_system_events_created_at on system_events(created_at desc);

alter table system_events enable row level security;

create policy "admins read system events" on system_events
  for select using (is_admin());

create policy "admins write system events" on system_events
  for insert with check (is_admin());

-- ─────────────────────────────────────────────────────────────
-- case_evidence — files attached to a case (invoices, medical docs,
-- photos). The actual bytes live in Supabase Storage (private bucket
-- 'case-evidence'); this table is the metadata + access record.
-- ─────────────────────────────────────────────────────────────

create type evidence_kind as enum (
  'VET_INVOICE', 'MEDICAL_RECORD', 'RESCUE_DOCUMENTATION', 'RECEIPT', 'PHOTO', 'OTHER'
);

create table case_evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  kind evidence_kind not null,
  storage_path text not null,
  file_name text not null,
  file_size bigint not null,
  content_type text not null,
  is_public boolean not null default false,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_case_evidence_case_id on case_evidence(case_id);

alter table case_evidence enable row level security;

create policy "admins full access to case_evidence" on case_evidence
  for all using (is_admin()) with check (is_admin());

-- Evidence is private by default. It only becomes publicly readable when
-- an admin explicitly flags is_public = true AND the case itself has a
-- published impact report — deliberate double-gate so a flag flip alone
-- can never leak a document before the case is actually public.
create policy "public reads explicitly public evidence on published cases" on case_evidence
  for select using (
    is_public = true
    and exists (
      select 1 from impact_reports
      where impact_reports.case_id = case_evidence.case_id
        and impact_reports.status = 'PUBLISHED'
    )
  );

-- Storage bucket for evidence — private by default, RLS-gated same as above.
insert into storage.buckets (id, name, public)
values ('case-evidence', 'case-evidence', false)
on conflict (id) do nothing;

create policy "admins manage case evidence storage" on storage.objects
  for all using (bucket_id = 'case-evidence' and is_admin())
  with check (bucket_id = 'case-evidence' and is_admin());

-- ─────────────────────────────────────────────────────────────
-- rate_limit_hits — minimal fixed-window rate limiter for public-facing
-- Edge Functions (donations-webhook, public-*). Not a replacement for
-- edge/WAF rate limiting in front of the whole API, but stops a single
-- misbehaving caller from hammering a function past the database.
-- ─────────────────────────────────────────────────────────────

create table rate_limit_hits (
  id bigint generated always as identity primary key,
  bucket_key text not null,
  created_at timestamptz not null default now()
);

create index idx_rate_limit_bucket_time on rate_limit_hits(bucket_key, created_at desc);

alter table rate_limit_hits enable row level security;
-- No public policies at all: only the service-role client (which bypasses
-- RLS) reads/writes this table, from inside Edge Functions.

-- Housekeeping: old rate-limit rows are cheap to keep, but let's not grow
-- forever. A scheduled call to this function (or just periodic manual
-- cleanup) keeps it bounded.
create or replace function prune_rate_limit_hits()
returns void as $$
  delete from rate_limit_hits where created_at < now() - interval '1 day';
$$ language sql;

-- ─────────────────────────────────────────────────────────────
-- Duplicate-case flagging — heuristic, non-blocking. A case matching an
-- existing case for the same dog + category within 14 days is flagged
-- for admin review rather than silently accepted or silently rejected.
-- ─────────────────────────────────────────────────────────────

alter table cases add column if not exists possible_duplicate_of uuid references cases(id);

create or replace function flag_possible_duplicate_case()
returns trigger as $$
declare
  existing_id uuid;
begin
  select id into existing_id
  from cases
  where dog_id = new.dog_id
    and category = new.category
    and id != new.id
    and created_at > now() - interval '14 days'
  order by created_at desc
  limit 1;

  if existing_id is not null then
    new.possible_duplicate_of := existing_id;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_flag_duplicate_case
  before insert on cases
  for each row execute function flag_possible_duplicate_case();

-- ─────────────────────────────────────────────────────────────
-- Immutability — once a financial record reaches a terminal
-- "confirmed" state, it can never be altered or deleted, only
-- superseded by a new row (e.g. a refund is its own donation row with
-- status handled separately, not a mutation of the original).
-- ─────────────────────────────────────────────────────────────

create or replace function prevent_confirmed_mutation()
returns trigger as $$
begin
  if TG_OP = 'DELETE' then
    if OLD.status in ('confirmed', 'CONFIRMED') then
      raise exception 'cannot delete a confirmed % record (id=%)', TG_TABLE_NAME, OLD.id;
    end if;
    return OLD;
  end if;

  if OLD.status in ('confirmed', 'CONFIRMED') and NEW.status != OLD.status then
    raise exception 'cannot change status of a confirmed % record (id=%)', TG_TABLE_NAME, OLD.id;
  end if;

  if OLD.status in ('confirmed', 'CONFIRMED') then
    -- allow no field changes at all once confirmed, except we still need
    -- updated_at-style bookkeeping columns to be untouched too — simplest
    -- safe rule: block the update entirely once confirmed.
    if row(NEW.*) is distinct from row(OLD.*) then
      raise exception 'cannot modify a confirmed % record (id=%)', TG_TABLE_NAME, OLD.id;
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql;

create trigger trg_donations_immutable
  before update or delete on donations
  for each row execute function prevent_confirmed_mutation();

create trigger trg_token_fees_immutable
  before update or delete on token_fees
  for each row execute function prevent_confirmed_mutation();

create trigger trg_treasury_tx_immutable
  before update or delete on treasury_transactions
  for each row execute function prevent_confirmed_mutation();

create trigger trg_disbursements_immutable
  before update or delete on disbursements
  for each row execute function prevent_confirmed_mutation();
