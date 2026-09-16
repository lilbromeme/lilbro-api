-- DRACO OS — explicit case pipeline stage, per the full flow:
-- SUBMITTED -> DOCUMENT_REVIEW -> VERIFIED -> APPROVED -> TREASURY_PROPOSAL
-- -> AUTHORIZED_PAYMENT -> CONFIRMED -> IMPACT_REPORT -> PUBLISHED
--
-- This is additive to (not a replacement for) verification_status and
-- approval_status, which remain the fields RLS/business logic already
-- depend on. `stage` is the human-facing pipeline position shown in the
-- admin UI and case history.

create type case_stage as enum (
  'SUBMITTED',
  'DOCUMENT_REVIEW',
  'VERIFIED',
  'APPROVED',
  'TREASURY_PROPOSAL',
  'AUTHORIZED_PAYMENT',
  'CONFIRMED',
  'IMPACT_REPORT',
  'PUBLISHED',
  'REJECTED'
)
;

alter table cases add column if not exists stage case_stage not null default 'SUBMITTED';

create index idx_cases_stage on cases(stage);
