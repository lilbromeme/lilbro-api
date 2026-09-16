# DRACO OS

A memorial project turning one dog's memory into support for other dogs —
and the real, automated system behind that promise: token-fee tracking,
donations, treasury accounting, verified dog-support cases, an impact
ledger, and community notifications.

> **Status:** pre-launch. No chain, contract address, treasury wallet, or
> payment provider is configured yet — everything below is real,
> functioning code wired up against `PLACEHOLDER` values. See
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for what's real vs.
> placeholder today, and [`docs/SECURITY.md`](docs/SECURITY.md) for the
> security model and pre-launch checklist.

## Repository layout

```
web/                  React + Vite frontend (cinematic site + donate/fund/
                       impact/transparency pages + admin dashboard)
supabase/
  migrations/          SQL schema, RLS policies, public views
  functions/           Edge Functions (Deno) — tracking, webhooks, public API
docs/
  ARCHITECTURE.md      System design, data flow, what's real vs. placeholder
  SECURITY.md          Security model + pre-launch checklist
.env.example           Every environment variable this system uses
```

## Architecture at a glance

```
$DRACO TOKEN → fee allocation → DRACO FUND
                                    │
        ┌───────────────┬──────────┴──────────┬───────────────┐
   TOKEN FEES     DIRECT DONATIONS      $DRACO DONATIONS       │
        └───────────────┴──────────┬──────────┴───────────────┘
                                    ▼
                         VERIFICATION ENGINE → VERIFIED CASES
                                    │
                                    ▼
                          PUBLIC IMPACT LEDGER
                                    │
                    ┌───────────────┼───────────────┐
                 WEBSITE         TELEGRAM         DISCORD
```

## Local setup

### 1. Prerequisites

- Node.js 18+
- A Supabase project (free tier is fine for development)
- The [Supabase CLI](https://supabase.com/docs/guides/cli) for running
  migrations and Edge Functions locally

### 2. Environment variables

```
cp .env.example .env
cp .env.example web/.env.local   # Vite only reads VITE_-prefixed vars from here
```

Fill in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from your Supabase
project settings. Leave every blockchain/payment/notification value blank
or `PLACEHOLDER` until you actually have it — the app is designed to run
correctly (showing zeros/placeholders, not errors) in that state.

### 3. Database setup

```
supabase link --project-ref <your-project-ref>
supabase db push   # runs supabase/migrations/*.sql in order
```

This creates every table, enum, RLS policy, and public view described in
`docs/ARCHITECTURE.md`. No seed data is included — the database starts
completely empty, on purpose.

To grant yourself admin access (needed for `/admin` and `/admin/cases`):

```sql
insert into user_roles (user_id, role)
values ('<your-auth-user-uuid>', 'admin');
```

### 4. Edge Functions

```
supabase functions deploy token-fee-tracker
supabase functions deploy donations-webhook
supabase functions deploy milestone-engine
supabase functions deploy notify-event
supabase functions deploy system-health
supabase functions deploy reconciliation
supabase functions deploy public-fund
supabase functions deploy public-impact
supabase functions deploy public-treasury
supabase functions deploy public-milestones
```

Set their secrets (these are server-side only — never `VITE_`-prefixed):

```
supabase secrets set SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
  TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... DISCORD_WEBHOOK_URL=... \
  DONATION_PROVIDER_WEBHOOK_SECRET=... DRACO_NETWORK=... DRACO_FUND_WALLET=...
```

Schedule `token-fee-tracker` to run periodically (Supabase cron, or any
external scheduler hitting its URL) once a real blockchain adapter exists.

### 5. Webhook setup

Point your donation provider's webhook at the deployed `donations-webhook`
function URL, and configure it to sign requests with
`DONATION_PROVIDER_WEBHOOK_SECRET` via an `X-Donation-Signature` header
(HMAC-SHA256 over the raw request body). If your chosen provider uses a
different scheme, update `verifySignature()` in
`supabase/functions/donations-webhook/index.ts` to match — do not disable
verification to unblock testing.

### 6. Blockchain adapter

`web/src/lib/blockchain/` defines the `BlockchainAdapter` interface and
ships one implementation: `MockBlockchainAdapter`, which returns
empty/zero for everything. When the launch chain is decided:

1. Implement a new adapter class satisfying `BlockchainAdapter`.
2. Add a `case` for it in `getBlockchainAdapter()`
   (`web/src/lib/blockchain/index.ts`).
3. Mirror the same logic into `supabase/functions/token-fee-tracker/index.ts`'s
   `getTokenFeeEventsFromChain()` (Edge Functions run on Deno and can't
   import the Vite-built web source directly).

### 7. Telegram setup

1. Create a bot via [@BotFather](https://t.me/BotFather), get its token.
2. Add the bot to your announcement channel/group, get the chat id.
3. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` as Edge Function
   secrets.

### 8. Discord setup

1. Create a webhook in your target channel (Channel Settings → Integrations
   → Webhooks).
2. Set `DISCORD_WEBHOOK_URL` as an Edge Function secret.

### 9. Run the frontend

```
cd web
npm install
npm run dev
```

### 10. Demo/test mode

Set `VITE_DEMO_MODE=true` in `web/.env.local` to render `/fund` and
`/impact` with clearly-labeled demo data instead of querying Supabase —
useful for local UI work with no backend configured. A yellow
`DEMO DATA — NOT REAL FUND ACTIVITY` banner appears whenever this is on.
**Never set this in a production deployment.**

## Deployment

- **Frontend:** any static host that supports SPA routing (Vercel,
  Netlify, Cloudflare Pages). Set the `VITE_*` environment variables in
  the host's dashboard — never commit them.
- **Database + Edge Functions:** Supabase (hosted or self-hosted).
- **Secrets:** Supabase project secrets for Edge Functions; your hosting
  provider's environment variable manager for the frontend's `VITE_*`
  values. No secret should ever exist in git history.

## Security considerations

See [`docs/SECURITY.md`](docs/SECURITY.md) — read it before deploying
anything to production, especially before wiring up a real payment
provider or treasury wallet.

## Production checklist

See the checklist at the bottom of `docs/SECURITY.md`.

## Core rule

> REAL EVENT → VERIFIED DATA → AUTOMATIC UPDATE → PUBLIC PROOF

Nothing in this system is allowed to show a number, a donor count, a dog
helped, or a fund balance that didn't come from a confirmed database
record traceable to a real event. Where information isn't known yet
(chain, contract, wallets, tokenomics, provider), it is `PLACEHOLDER` —
never invented.
