# DRACO OS — Architecture

## Overview

```
                    $DRACO TOKEN
                         │
                defined fee allocation
                         │
                         ▼
                  DRACO FUND
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
      TOKEN FEES   DIRECT DONATIONS   $DRACO DONATIONS
          │              │              │
          └──────────────┼──────────────┘
                         ▼
                 VERIFICATION ENGINE
                         │
                         ▼
                  VERIFIED CASES
                         │
                         ▼
                PUBLIC IMPACT LEDGER
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
       WEBSITE        TELEGRAM        DISCORD
```

Every arrow in this diagram is a real code path today, even though most of
them currently move zero real money — the plumbing is complete; the launch
chain, treasury wallets, and payment provider are the only pieces still
marked `PLACEHOLDER`.

## Components

### 1. Frontend (`web/`)
React + Vite. The cinematic landing page (`src/pages/HomePage.jsx` and its
section components) is unchanged in spirit — it's the front door. Behind
it:

- `/donate` — donation rail selector (crypto / $DRACO / card), all disabled
  until `DRACO_CONFIG.donations.*Enabled` flags are flipped.
- `/fund` — live fund totals, read from `public_fund_summary`.
- `/impact` — published impact records, read from `public_impact_ledger`.
- `/transparency` — the trust center; every field either a real value or
  the literal string `PLACEHOLDER`.
- `/admin` and `/admin/cases` — operator dashboard and case-management
  workflow, gated by Supabase Auth + the `admin` role.

### 2. Database (`supabase/migrations/`)
Postgres via Supabase. Three migrations:

- `0001_init.sql` — every table in the architecture doc, with enums for
  every status field so invalid states are rejected at the schema level.
- `0002_rls.sql` — Row Level Security. Default-deny; public reads are
  narrow, explicit exceptions (confirmed donations' *aggregates* — never
  raw rows; approved+ dogs; published impact reports; achieved milestones).
- `0003_public_views.sql` — the aggregate-only views the public pages and
  public API functions actually query. This is the layer that makes "the
  website reads safe data" true by construction rather than by convention.

### 3. Blockchain adapter (`web/src/lib/blockchain/`)
A `BlockchainAdapter` interface (`getTokenBalance`, `getTransactions`,
`getTokenFeeEvents`, `getTransaction`) with one implementation today:
`MockBlockchainAdapter`, which returns empty/zero for everything and is
explicitly flagged `isMock = true`. `getBlockchainAdapter()` in
`src/lib/blockchain/index.ts` is the only place that decides which
implementation is live, keyed off `DRACO_CONFIG.network`. Adding a real
chain means writing one new class and one new `case` in that switch —
nothing else in the app changes.

### 4. Treasury abstraction (`web/src/lib/treasury/`)
A `TreasuryProvider` interface deliberately shaped around *proposing* a
transaction, not *submitting* one from a key this app holds. The only
implementation today, `ManualTreasuryProvider`, records a disbursement
proposal in the database for a human admin to execute through an actual
multisig UI (e.g. Safe) and then log the resulting tx hash back in. A
future `SafeTreasuryProvider` (or similar) can automate the proposal step
without ever requiring this codebase to hold a private key.

### 5. Edge Functions (`supabase/functions/`)
Deno runtime, deployed as Supabase Edge Functions.

| Function | Trigger | Access | Purpose |
|---|---|---|---|
| `token-fee-tracker` | cron (scheduled) | service-role only | Polls the blockchain adapter for new fee events, dedupes by `tx_hash`, writes `token_fees` + `treasury_transactions`, checks milestones, emits `TOKEN_FEE_RECEIVED`. |
| `donations-webhook` | HTTP, provider webhook | signature-verified | Rate-limited, validates payload, dedupes by payment id, writes `donations` + `treasury_transactions`, checks milestones, emits `DONATION_CONFIRMED`. |
| `notify-event` | HTTP, admin browser | admin JWT required | Lets the admin dashboard report case-lifecycle events (verified/approved/funded/published) through the dispatcher without ever holding Telegram/Discord secrets. |
| `milestone-engine` | HTTP or cron | admin/service | Generic milestone check across any/all of FUND, DOGS_HELPED, DONATIONS, COMMUNITY. |
| `system-health` | HTTP, admin dashboard | admin JWT required | Reports which integrations are configured as booleans only — never a secret value. |
| `reconciliation` | HTTP, admin dashboard | admin JWT required | Compares blockchain balance vs. database accounting vs. recorded disbursements; never silently hides a mismatch. |
| `public-fund` | HTTP, public | public | Returns `public_fund_summary`. |
| `public-impact` | HTTP, public | public | Returns `public_impact_ledger`. |
| `public-treasury` | HTTP, public | public | Returns `public_treasury_feed`. |
| `public-milestones` | HTTP, public | public | Returns `public_milestones`. |

Shared modules in `_shared/`:
- `supabaseAdmin.ts` — service-role client, server-only.
- `requireAdmin.ts` — verifies a caller's own JWT belongs to an admin
  (used by `system-health`, `reconciliation`, `notify-event`).
- `events.ts` — the **central event dispatcher**. Every "something real
  happened" moment (`DONATION_CONFIRMED`, `TOKEN_FEE_RECEIVED`,
  `CASE_SUBMITTED`, `CASE_VERIFIED`, `CASE_REJECTED`, `CASE_APPROVED`,
  `CASE_FUNDED`, `IMPACT_PUBLISHED`, `MILESTONE_REACHED`) is recorded to
  `system_events` here, and public-worthy events also fan out to
  Telegram/Discord via `notify.ts`. No other module calls
  Telegram/Discord directly — this is what STEP 16 in the original spec
  calls "a central event dispatcher instead of duplicating notification
  logic".
- `notify.ts` — Telegram + Discord message formatting/sending (called
  only from `events.ts`).
- `milestones.ts` — the idempotent milestone-check routine.
- `rateLimit.ts` — minimal fixed-window rate limiter for public POST
  endpoints (backstop only; real rate limiting belongs at the edge/WAF
  before launch).

### 5b. Admin Control Center (`web/src/pages/admin/`)
Deliberately un-cinematic (`AdminShell.jsx`) — precise, technical,
monospace, status pills, no film grain. Pages:

- `/admin` — DRACO CONTROL: fund totals, case counts, dogs helped,
  `SystemHealthPanel` (calls `system-health`), `ActivityStream` (live
  `system_events`, via Supabase Realtime).
- `/admin/cases` — the full case pipeline: SUBMITTED → DOCUMENT_REVIEW →
  VERIFIED → APPROVED → TREASURY_PROPOSAL → AUTHORIZED_PAYMENT →
  CONFIRMED → IMPACT_REPORT → PUBLISHED (`cases.stage`), with evidence
  upload to the private `case-evidence` Storage bucket, full audit
  history per case, and a duplicate-case warning
  (`possible_duplicate_of`, set by a trigger).
- `/admin/reconciliation` — calls the `reconciliation` function; shows
  `✓ RECONCILED` / `⚠ RECONCILIATION REQUIRED` / an honest "blockchain
  not configured" state — never a silently-passing false positive.
- `/admin/settings` — read-only configuration center. Never displays or
  accepts a secret.
- `/admin/launch` — DRACO LAUNCH READINESS. Computes its checklist from
  `DRACO_CONFIG` and cannot be made to say "READY" without those values
  actually changing.

### 6. Fund accounting
One formula, defined twice on purpose (once for the frontend at
`web/src/lib/fundAccounting.ts`, once for Edge Functions at
`supabase/functions/_shared/fundAccounting.ts`, since they run on different
runtimes with no shared build step):

```
available = (token_fees + direct_donations + draco_donations) - disbursed
```

The database view `public_fund_summary` computes the same formula in SQL —
that view, not either TypeScript copy, is the actual source of truth the
public pages read. The TypeScript copies exist for type-safe use inside
Edge Function logic and any client-side derived display.

### 7. Milestone engine
Milestones are rows in the `milestones` table with a
`unique (type, threshold)` constraint. `checkMilestones()` computes the
current value for a type, finds unmet thresholds at or below it, and
attempts a guarded `UPDATE ... WHERE achieved_at IS NULL` for each — the
guard is what makes concurrent invocations (e.g. two webhook deliveries
racing) safe. A milestone can only ever transition from unachieved to
achieved once.

### 8. Notifications
`_shared/notify.ts` formats and sends to Telegram (Bot API) and Discord
(webhook). It is called *only* after a database write has already
committed — never speculatively, never for a `pending` status.

## What is real vs. placeholder today

| Real | Placeholder |
|---|---|
| Schema, RLS, views | Launch chain / network |
| Blockchain adapter interface | Real chain adapter implementation |
| Treasury abstraction | Multisig provider implementation |
| Edge Function logic, idempotency | Actual RPC/indexer connection |
| Notification formatting/sending | `TELEGRAM_BOT_TOKEN` / `DISCORD_WEBHOOK_URL` values |
| Admin case-management workflow | — |
| Public transparency pages | Wallet addresses, contract address, fee %s |

No table has been seeded with fabricated rows. Every `0`/`—`/`PLACEHOLDER`
you see rendered is the honest current state of the system.
