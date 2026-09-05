# BRO Vault Keeper

Off-chain automation for the BRO vault. Nothing on-chain triggers
`dispatchDividend`/`dispatchLiquidity`/`dispatchBurn` or computes dividend
shares by itself — that's this bot's whole job. Two independent scripts,
meant to be run on a schedule (cron, systemd timer, etc.), not as a
long-running daemon:

- `npm run dispatch` — checks the vault's three pending ETH buckets and, for
  any that are above `MIN_DISPATCH_WEI`, calls the matching `dispatch*()`
  with a live-quoted slippage floor.
- `npm run dividends` — snapshots BRO holder balances from Robinhood Chain's
  block explorer, computes each eligible holder's proportional share of the
  vault's currently unreserved MSTR, and pushes (or credits) it in batches.

## Setup

```bash
cd keeper
npm install
cp .env.example .env
# edit .env: set VAULT_ADDRESS to the real deployed vault (not the factory),
# and KEEPER_PRIVATE_KEY to a wallet the vault's Guardian has authorized via
# setKeeper() -- fund it with enough native ETH for gas.
```

Then run either script directly (`npm run dispatch`, `npm run dividends`),
or both back-to-back with `npm run run-once`, on whatever schedule you want
(a `cron` entry running `npm run run-once` every 10-15 minutes is enough to
start).

## What each script actually protects against, and what it doesn't

- **Slippage on dispatch***: `quote.ts` estimates output from the real
  pool's own on-chain state (V3 spot price for the MSTR leg, V2 reserves for
  the liquidity/burn legs) and applies `SLIPPAGE_BPS` as a floor. This
  protects against front-running the specific swap in a *single*
  transaction. It does **not** protect against a colluding keeper
  deliberately setting a low `SLIPPAGE_BPS` — that's a contract-level
  fairness gap already documented in the main project README ("Known
  fairness risks"), not something a keeper script can fix on its own.
- **Dividend snapshot accuracy**: `dividends.ts` fetches a *live* holder
  snapshot at call time (Blockscout doesn't expose historical snapshots by
  block), so a holder who buys or sells between the snapshot and the
  transaction landing gets a slightly stale share. The vault's own contract
  never trusts this snapshot as authoritative — it only enforces that total
  payouts can't exceed real MSTR held (see `BROMSTRVault.sol`'s NatSpec on
  distribution design) — so the worst case here is a slightly-off
  distribution, not a solvency issue.
- **The liquidity/burn legs will do nothing (log and skip) until BRO's own
  WETH/BRO pool exists** — `quote.ts` returns 0 when the pair isn't found,
  and both scripts treat that as "not ready yet," not "swap for free."

## Before BRO's pool exists

`dispatch.ts`'s dividend leg works today against MSTR's real, existing pool.
Its liquidity and burn legs will simply log "pair doesn't exist yet" and
skip until:

1. BRO launches and graduates off Flap's bonding curve (creating its own
   WETH/BRO pool), and
2. `BROLiquidityAdapterRobinhoodV2` / `BROBurnSwapAdapterRobinhoodV2` are
   redeployed with BRO's real address and wired into the vault by Guardian
   (see the main project README for why that step needs Guardian
   specifically).

No changes to this keeper are needed for that — it already reads `taxToken`
from the vault itself and re-checks pair existence on every run.
