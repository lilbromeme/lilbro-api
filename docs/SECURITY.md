# DRACO OS — Security

## Principles

1. **No private keys in this application, ever.** Not in Supabase, not in
   environment variables, not in the frontend, not pasted into an admin
   UI field. Fund movement goes through `TreasuryProvider`
   (`web/src/lib/treasury/`), whose only implementation today
   (`ManualTreasuryProvider`) requires a human to execute the actual
   transaction through an external multisig UI. A future automated
   provider must still never hold a raw private key inside this codebase —
   it should call out to a multisig API (e.g. Safe Transaction Service)
   that holds signing authority itself.

2. **The database is the source of truth, not the client.** Every dollar
   figure the public sees is computed by a Postgres view
   (`public_fund_summary`, `public_impact_ledger`, etc.) from rows that
   were written server-side (Edge Functions, using the service-role key).
   The browser never has a code path that increments a donation total.

3. **Default-deny RLS.** Every table has Row Level Security enabled. Public
   (`anon`) access is a small, explicit allowlist of narrow policies —
   confirmed/published rows only, and in most cases aggregate views rather
   than direct table reads. See `supabase/migrations/0002_rls.sql` and
   `0003_public_views.sql`'s header comment for exactly why the views are
   safe despite bypassing row-level filters at the SQL level (they only
   ever expose sums/counts/whitelisted columns of already-confirmed rows).

4. **Idempotency everywhere money is recorded.** `donations.tx_hash`,
   `token_fees.tx_hash`, and `disbursements.tx_hash` all carry a `unique`
   constraint. The `donations-webhook` and `token-fee-tracker` functions
   check-then-insert, but the actual guarantee against double-counting is
   the database constraint, not the application-level check (which is
   only there to short-circuit and respond cleanly to a duplicate
   delivery).

5. **Webhook signature verification.** `donations-webhook` rejects any
   request that doesn't carry a valid HMAC signature computed with
   `DONATION_PROVIDER_WEBHOOK_SECRET`, using a timing-safe comparison. The
   exact scheme (header name, HMAC over raw body) will need to be adjusted
   to match whichever payment provider is finally chosen — the current
   implementation follows the common Stripe/Coinbase Commerce pattern as a
   reasonable default. **Do not weaken or remove this check** to get a
   webhook working faster; fix the header/algorithm mismatch instead.

6. **Role-based access, enforced in Postgres.** `user_roles` +
   `is_admin()` / `has_role()` SQL functions are what RLS policies check —
   not a client-side `isAdmin` flag. `useAdminSession.js` on the frontend
   is a UX convenience (hide/show admin UI); a user without the `admin`
   row in `user_roles` cannot write to any admin-only table regardless of
   what the client believes.

7. **Audit logging.** Every admin mutation in `AdminCasesPage.jsx` calls
   `logAdminAction()`, which writes to `admin_audit_logs` (actor, action,
   target table/id, previous value, new value). This table is
   admin-readable only and is never exposed publicly. Audit-log write
   failures are logged loudly but never block the underlying mutation —
   don't let a broken audit log become a way to block legitimate case
   verification.

8. **Rate limiting.** Not implemented at the application layer yet — this
   should be handled at the edge (Supabase's own rate limiting on Edge
   Functions, or a CDN/WAF in front of the public API endpoints) before
   `donations-webhook` and the `public-*` functions are exposed to the
   open internet. Track this as a pre-launch checklist item.

9. **Input validation.** `donations-webhook` validates payload shape
   (`isValidPayload`) before touching the database — reject unknown
   shapes rather than trying to coerce them. Extend this validation
   alongside any new field the eventual payment provider requires.

10. **No client-side fund manipulation.** Donation amounts are never
    accepted from the browser. The frontend only initiates a checkout
    session with a payment provider; the provider's own signed webhook is
    what actually creates a `donations` row. There is intentionally no
    Supabase RLS policy that lets `anon` insert into `donations`,
    `token_fees`, `treasury_transactions`, or `disbursements`.

## Pre-launch checklist

- [ ] Real blockchain adapter implemented and tested against testnet
      before mainnet
- [ ] `DRACO_FEE_*_PCT` env vars match the deployed contract's actual fee
      split exactly
- [ ] Multisig deployed; `ManualTreasuryProvider` replaced or kept
      deliberately (documented decision either way)
- [ ] Donation provider's actual webhook signature scheme implemented
      (replace the placeholder HMAC scheme with the provider's real one)
- [ ] Rate limiting in front of all public Edge Functions
- [ ] `SUPABASE_SERVICE_ROLE_KEY` confirmed absent from any `VITE_`-
      prefixed variable or any file committed to git
- [ ] RLS policies re-reviewed against the final schema if any table
      changes before launch
- [ ] `admin_audit_logs` retention/export plan decided
- [ ] Telegram/Discord bot tokens rotated if they were ever pasted into
      a shared channel or ticket during setup
- [ ] `VITE_DEMO_MODE` confirmed `false`/unset in the production build
