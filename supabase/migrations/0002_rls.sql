-- DRACO OS — Row Level Security
-- Default posture: deny everything, then open narrow, explicit windows.

alter table user_roles enable row level security;
alter table admin_audit_logs enable row level security;
alter table donations enable row level security;
alter table token_fees enable row level security;
alter table treasury_transactions enable row level security;
alter table dogs enable row level security;
alter table cases enable row level security;
alter table verifications enable row level security;
alter table disbursements enable row level security;
alter table impact_reports enable row level security;
alter table milestones enable row level security;
alter table community_members enable row level security;

-- ─────────────────────────────────────────────────────────────
-- Role helper
-- ─────────────────────────────────────────────────────────────

create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

create or replace function has_role(required_role app_role)
returns boolean as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid() and role = required_role
  ) or is_admin();
$$ language sql stable security definer;

-- ─────────────────────────────────────────────────────────────
-- user_roles / admin_audit_logs — admin only, never public
-- ─────────────────────────────────────────────────────────────

create policy "admins manage roles" on user_roles
  for all using (is_admin()) with check (is_admin());

create policy "admins read audit logs" on admin_audit_logs
  for select using (is_admin());

create policy "admins write audit logs" on admin_audit_logs
  for insert with check (is_admin());

-- ─────────────────────────────────────────────────────────────
-- donations — donor-private. Public reads only aggregate views
-- (see 0003_public_views.sql), never this table directly.
-- ─────────────────────────────────────────────────────────────

create policy "admins full access to donations" on donations
  for all using (is_admin()) with check (is_admin());

create policy "donors read own donations" on donations
  for select using (auth.uid() is not null and donor_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- token_fees / treasury_transactions — public can read confirmed
-- rows only (this is the transparency ledger), never pending/failed
-- internal noise.
-- ─────────────────────────────────────────────────────────────

create policy "admins full access to token_fees" on token_fees
  for all using (is_admin()) with check (is_admin());

create policy "public reads confirmed token fees" on token_fees
  for select using (status = 'confirmed');

create policy "admins full access to treasury" on treasury_transactions
  for all using (is_admin()) with check (is_admin());

create policy "public reads confirmed treasury tx" on treasury_transactions
  for select using (status = 'confirmed');

-- ─────────────────────────────────────────────────────────────
-- dogs — public can read dogs that have left SUBMITTED/VERIFICATION
-- (i.e. an admin has already vetted them before they're visible)
-- ─────────────────────────────────────────────────────────────

create policy "admins full access to dogs" on dogs
  for all using (is_admin()) with check (is_admin());

create policy "public reads approved+ dogs" on dogs
  for select using (status in ('APPROVED', 'ACTIVE', 'COMPLETED'));

-- ─────────────────────────────────────────────────────────────
-- cases — private until admin explicitly publishes the linked
-- impact report. Documents (vet records etc.) are never public.
-- ─────────────────────────────────────────────────────────────

create policy "admins full access to cases" on cases
  for all using (is_admin()) with check (is_admin());

create policy "public reads cases with published impact report" on cases
  for select using (
    exists (
      select 1 from impact_reports
      where impact_reports.case_id = cases.id
        and impact_reports.status = 'PUBLISHED'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- verifications — internal only. Verifier identity is never public.
-- ─────────────────────────────────────────────────────────────

create policy "admins full access to verifications" on verifications
  for all using (is_admin()) with check (is_admin());

-- Verifiers can read all verification records (they need context on a
-- case's history) and create new ones under their own identity, but they
-- can never edit or delete an existing verification record — including
-- their own. That would let a verifier quietly rewrite history; only an
-- admin (already covered by the "admins full access" policy above) can
-- correct a bad verification, and doing so is auditable.
create policy "verifiers read verifications" on verifications
  for select using (has_role('verifier'));

create policy "verifiers create their own verifications" on verifications
  for insert with check (has_role('verifier') and verifier_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- disbursements — internal only, no public read at all
-- (public proof comes via the published impact_report + tx link).
-- ─────────────────────────────────────────────────────────────

create policy "admins full access to disbursements" on disbursements
  for all using (is_admin()) with check (is_admin());

-- ─────────────────────────────────────────────────────────────
-- impact_reports — public reads only PUBLISHED
-- ─────────────────────────────────────────────────────────────

create policy "admins full access to impact_reports" on impact_reports
  for all using (is_admin()) with check (is_admin());

create policy "public reads published impact reports" on impact_reports
  for select using (status = 'PUBLISHED');

-- ─────────────────────────────────────────────────────────────
-- milestones — achieved milestones are public; unachieved
-- thresholds stay internal so we never telegraph targets as claims.
-- ─────────────────────────────────────────────────────────────

create policy "admins full access to milestones" on milestones
  for all using (is_admin()) with check (is_admin());

create policy "public reads achieved milestones" on milestones
  for select using (achieved_at is not null);

-- ─────────────────────────────────────────────────────────────
-- community_members — never publicly readable as raw rows.
-- Aggregates (member count, country count) are exposed only via
-- the public views / edge functions, never this table directly.
-- ─────────────────────────────────────────────────────────────

create policy "admins full access to community_members" on community_members
  for all using (is_admin()) with check (is_admin());

create policy "members read own row" on community_members
  for select using (
    auth.uid() is not null and (
      telegram_id = (auth.jwt() ->> 'telegram_id')
      or discord_id = (auth.jwt() ->> 'discord_id')
    )
  );
