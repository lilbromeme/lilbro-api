-- DRACO OS — public, aggregate-only views.
-- These are the single source of truth for the /fund, /impact and
-- transparency pages. They never expose donor identity, wallet
-- ownership, or internal case documents — only sums and counts of
-- rows that are already confirmed/published per the RLS policies.

-- Total confirmed donations, split by source, in USD.
create or replace view public_fund_totals as
select
  coalesce(sum(usd_value) filter (where source = 'crypto'), 0) as direct_donations_usd,
  coalesce(sum(usd_value) filter (where source = 'draco_token'), 0) as draco_donations_usd,
  coalesce(sum(usd_value) filter (where source = 'card'), 0) as card_donations_usd,
  count(*) filter (where status = 'confirmed') as confirmed_donation_count
from donations
where status = 'confirmed';

create or replace view public_token_fee_totals as
select
  coalesce(sum(fund_allocation), 0) as total_fund_allocation,
  coalesce(sum(operations_allocation), 0) as total_operations_allocation,
  coalesce(sum(community_allocation), 0) as total_community_allocation,
  count(*) as confirmed_fee_events
from token_fees
where status = 'confirmed';

create or replace view public_disbursement_totals as
select
  coalesce(sum(amount), 0) as total_disbursed,
  count(*) as completed_disbursement_count
from disbursements
where status = 'CONFIRMED';

-- Single-row summary the /fund page reads directly.
create or replace view public_fund_summary as
select
  t.total_fund_allocation as token_fees_usd,
  f.direct_donations_usd,
  f.draco_donations_usd,
  d.total_disbursed as disbursed_usd,
  (t.total_fund_allocation + f.direct_donations_usd + f.draco_donations_usd - d.total_disbursed) as available_usd,
  (t.total_fund_allocation + f.direct_donations_usd + f.draco_donations_usd) as total_generated_usd
from public_token_fee_totals t, public_fund_totals f, public_disbursement_totals d;

-- Published impact records only — this is what /impact renders.
create or replace view public_impact_ledger as
select
  ir.id as report_id,
  ir.title,
  ir.summary,
  ir.amount_spent,
  ir.evidence_urls,
  ir.published_at,
  c.category,
  d.name as dog_name,
  d.location as dog_location,
  disb.tx_hash,
  disb.asset
from impact_reports ir
join cases c on c.id = ir.case_id
join dogs d on d.id = c.dog_id
left join disbursements disb on disb.case_id = c.id and disb.status = 'CONFIRMED'
where ir.status = 'PUBLISHED'
order by ir.published_at desc;

-- Achieved milestones only.
create or replace view public_milestones as
select id, type, threshold, achieved_value, achieved_at, title, description
from milestones
where achieved_at is not null
order by achieved_at desc;

-- Community aggregate — counts only, never individual rows.
create or replace view public_community_summary as
select
  count(*) as member_count,
  count(distinct country) filter (where country is not null) as country_count,
  coalesce(sum(contribution_total), 0) as total_contributions
from community_members;

-- Treasury activity feed — confirmed rows only, no internal notes.
create or replace view public_treasury_feed as
select id, tx_hash, network, direction, asset, amount, usd_value, category, created_at
from treasury_transactions
where status = 'confirmed'
order by created_at desc;

grant select on
  public_fund_totals,
  public_token_fee_totals,
  public_disbursement_totals,
  public_fund_summary,
  public_impact_ledger,
  public_milestones,
  public_community_summary,
  public_treasury_feed
to anon, authenticated;
