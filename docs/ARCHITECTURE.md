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

| Function | Trigger | Purpose |
|---|---|---|
| `token-fee-tracker` | cron (scheduled) | Polls the blockchain adapter for new fee events, dedupes by `tx_hash`, writes `token_fees` + `treasury_transactions`, checks milestones, notifies. |
| `donations-webhook` | HTTP, provider webhook | Validates signature, dedupes by payment id, writes `donations` + `treasury_transactions`, checks milestones, notifies. |
| `milestone-engine` | HTTP or cron | Generic milestone check across any/all of FUND, DOGS_HELPED, DONATIONS, COMMUNITY. |
| `public-fund` | HTTP, public | Returns `public_fund_summary`. |
| `public-impact` | HTTP, public | Returns `public_impact_ledger`. |
| `public-treasury` | HTTP, public | Returns `public_treasury_feed`. |
| `public-milestones` | HTTP, public | Returns `public_milestones`. |

All of them share `_shared/supabaseAdmin.ts` (service-role client,
server-only), `_shared/notify.ts` (Telegram + Discord fan-out), and
`_shared/milestones.ts` (the idempotent milestone-check routine).

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
