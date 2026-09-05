# BRO Vault

A custom Flap.sh Vault + VaultFactory for `$BRO`: receives 100% of trading-tax
revenue in ETH and splits it three ways — **80% swaps to MSTR** for holder
dividends, **15% becomes permanent BRO/ETH liquidity**, **5% buys and burns
BRO** — via pluggable, independently-verifiable adapters.

**Status: factory deployed to Robinhood Chain mainnet, but only for the
old 100%-MSTR design. The current 80/15/5 source has NOT been deployed
yet** — see `DEPLOYMENTS.md` for exact addresses and what each one actually
does. No vault has ever been created (that happens automatically the moment
someone launches a token on Flap using a deployed factory address). No
liquidity or burn-swap adapter exists yet — see "Genuinely unverified" below.

## What's real vs. what's configuration you still need to supply

This project follows one rule throughout: nothing that isn't independently
verifiable gets hardcoded.

### Confirmed, real, verified against source and against live chain state
- `src/flap/*.sol` — pulled from
  [flap-sh/FlapVaultExample](https://github.com/flap-sh/FlapVaultExample),
  required to stay untouched. Diffed against the reference repo's own
  prelude copies: `IVaultSchemasV1.sol` matches byte-for-byte; our
  `VaultBase.sol`/`VaultFactoryBaseV2.sol`/`IVaultFactory.sol` carry
  *additional* Robinhood Chain (4663/46630) entries and a newer v2.2
  validation surface (`onBeforeLaunch`) that the example repo's own bundled
  copy (v2.1) doesn't have — independently confirmed correct by calling the
  live addresses on Robinhood Chain mainnet (see below), not assumed.
- MSTR (`0xec262a75e413fAfD0dF80480274532C79D42da09`): confirmed live via
  `name()`/`symbol()`/`decimals()` — returns `"Strategy Inc. • Robinhood
  Token"` / `"MSTR"` / `18`, on chain ID 4663.
- Flap's Guardian, Portal, and VaultPortal addresses, and Uniswap V4's
  PoolManager, Universal Router, Quoter, StateView, and PositionManager
  addresses on Robinhood Chain: all confirmed to have live deployed
  bytecode via direct RPC calls.
- The `newVault(address taxToken, address quoteToken, address creator, bytes vaultData)`
  signature, the beacon-proxy deployment pattern, and the
  `vaultDataSchema()` / `vaultUISchema()` UI-generation mechanism.

### Genuinely unverified — you must confirm these before wiring in adapters
- **The ETH → MSTR swap route (80% dividend leg).** Robinhood Chain's
  Universal Router is a **modified fork** of Uniswap's: its V4 swap struct
  carries an extra `minHopPriceX36` field before `hookData`, so standard
  Uniswap V4 SDK-generated calldata reverts against it. `MSTRSwapAdapterUniV3Reference.sol`
  is the wrong shape entirely (V3 `exactInputSingle`) and self-guards
  against deployment on Robinhood. A real adapter needs Robinhood's actual
  router ABI and a verified MSTR/WETH pool (fee tier, tick spacing, hook).
- **BRO's own liquidity pool (15% auto-liquidity leg).** Flap's own
  `MigratorType` enum documents `V4_UNI_MIGRATOR` as supported only on
  Base/XLayer, not Robinhood Chain — meaning BRO's own trading pair is
  likely a V2- or V3-style pool, but this has NOT been independently
  verified. `ILiquidityAdapter.sol` isolates this behind a pluggable
  interface for exactly this reason. No implementation exists yet.
- **The ETH → BRO swap route (5% buy-and-burn leg).** Same swap-adapter
  interface as the dividend leg (`IMSTRSwapAdapter`, reused generically),
  reused for BRO's own pool instead of MSTR's — same caveats as the
  liquidity leg above regarding pool type. No implementation exists yet.

None of the three adapter slots (`mstrSwapAdapter`, `liquidityAdapter`,
`burnSwapAdapter`) has a real implementation. Every vault created right now
can *receive* and *bucket* tax ETH correctly, but cannot execute any of the
three legs until real, verified adapters are deployed and wired in by
Guardian.

### A real design tradeoff, not a gap
The vault distributes MSTR dividends via keeper-computed batch push
(`pushDividends`) or a claim fallback (`creditDividends` + `claim`). This is
**not a trustless proportional-distribution mechanism**: the contract limits
total payouts to the MSTR held but does not verify the keeper's holder
snapshot, balances, or allocations. Do not represent it as on-chain
proportional distribution without a specified attestation/snapshot design.

## Structure

```
src/
├── flap/                          ← REQUIRED & IMMUTABLE, do not modify
├── BROMSTRVault.sol                ← the vault: receive() splits 80/15/5 into
│                                     three named buckets; three dispatch*()
│                                     functions each spend only their own bucket
├── BROMSTRVaultFactory.sol         ← beacon-proxy factory + asset registry
├── IMSTRSwapAdapter.sol            ← ETH->ERC20Token swap interface (dividend + burn legs)
├── ILiquidityAdapter.sol           ← ETH->BRO/ETH-liquidity interface (liquidity leg)
└── MSTRSwapAdapterUniV3Reference.sol  ← incompatible with Robinhood; guarded against deployment there
script/
└── DeployBROMSTRFactory.s.sol      ← deployment script, env-var driven
test/
├── BROMSTRVault.t.sol              ← 37 tests, all passing
└── BROMSTRVault.robinhood.fork.t.sol ← 1 live-mainnet-fork test
```

## Setup

```bash
forge install foundry-rs/forge-std@v1.14.0
forge install openzeppelin/openzeppelin-contracts@v4.9.6
forge install openzeppelin/openzeppelin-contracts-upgradeable@v4.9.6
forge build
forge test -vv
```

These exact versions matter — Flap's own reference project pins them via
`foundry.lock`; the current `main` branches of these libraries (especially
openzeppelin-contracts-upgradeable) have moved on to v5.x with breaking
renames, and the project will not compile against them.

## Security features implemented

- `ReentrancyGuardUpgradeable` on every state-changing external function
- `SafeERC20` for all token transfers
- All reverts use `require(cond, "message")` with literal strings, not
  custom errors — required by Flap's own UI-friendliness spec (its UI
  renderer cannot decode custom error selectors)
- `receive()` only performs bounded arithmetic and three storage writes —
  no external calls, no loops — well under Flap's 1,000,000 gas cap
  (explicitly tested: `test_receiveGasUnder1M`)
- Three named pending-ETH buckets (`pendingDividendETH` / `pendingLiquidityETH`
  / `pendingBurnETH`), each spent only by its own `dispatch*()` function —
  a bug or malicious call against one leg cannot drain another
- Liquidity-leg LP tokens and burn-leg BRO are forwarded to
  `0x000...dEaD` in the same transaction they're acquired — the vault never
  custodies them, so there's nothing to get "stuck" on that path
- Guardian-gated config (`set*Adapter`, `setKeeper`, `lockConfig`) per
  Flap's mandate that Guardian always retains backup access
- `lockConfig()` — irreversible, disables further adapter changes on all
  three legs at once
- The selected reward asset is checked against the factory's immutable MSTR
  deployment value, cannot be deregistered, and has no vault-level setter
- `claim()` has no recipient parameter — `msg.sender` is the only possible
  recipient, so no caller can claim or redirect another holder's rewards
- `pushDividends`/`creditDividends` revert if the requested total exceeds
  the vault's actual unreserved MSTR balance. This protects solvency only;
  a compromised keeper can still send real MSTR to arbitrary recipients —
  see "fairness" below.
- Slippage (`minOut`) and deadline protection on every dispatch function
- The three bucket percentages (`DIVIDEND_BPS`/`LIQUIDITY_BPS`/`BURN_BPS`)
  and `BURN_ADDRESS` are compile-time constants — nobody, including
  Guardian, can ever change them post-deployment

## Known fairness risks (flagged, not yet mitigated)

Run against Flap's actual `flap-vault-spec-checker` audit rules (Rule 003):

1. **Keeper/Guardian-directed dividend distribution.** `pushDividends`/
   `creditDividends` let keeper or Guardian send MSTR to any address they
   specify, with no on-chain check against actual BRO holdings. A
   compromised keeper can't steal more than the vault holds, but it can
   misdirect all of it away from real holders.
2. **Unconstrained slippage on every `dispatch*()` call.** `minOut` is
   supplied by whoever calls dispatch, with no on-chain price floor — a
   colluding keeper could set it low and be sandwiched by a partner bot.

Neither is fixed by contract logic alone; both need an off-chain-attested
snapshot/oracle design before this can honestly claim to be sandwich- or
keeper-collusion-resistant.

## What's NOT done yet

- **No liquidity or burn-swap adapter implementation.** See "Genuinely
  unverified" above — this is the main blocker to actually dispatching the
  15% and 5% legs.
- **No third-party audit.** Reach out to the Flap team directly to arrange
  one (there is no self-serve process) — see their own
  `flap-vault-spec-checker` skill for the pre-audit checklist this project
  has already been run against.
- **No Robinhood-mainnet-fork integration test of the full tax → vault →
  dispatch → distribute path** with Flap's real TaxProcessor forwarding
  ETH end-to-end (the existing fork test only proves the named addresses
  are live and that `newVault()` succeeds when called as VaultPortal).
- **No trustless proportional allocation rule** — see "Known fairness
  risks" above.

## Deployment

```bash
export RPC_URL="https://rpc.mainnet.chain.robinhood.com"  # verify current URL first
export MSTR_ADDRESS="0xec262a75e413fAfD0dF80480274532C79D42da09"
# MSTR_SWAP_ADAPTER / LIQUIDITY_ADAPTER / BURN_SWAP_ADAPTER: leave unset until
# each has been independently verified against Robinhood's real router/pools.
forge script script/DeployBROMSTRFactory.s.sol:DeployBROMSTRFactory \
    --rpc-url $RPC_URL --account deployer --broadcast -vvvv
```

See `DEPLOYMENTS.md` for every address actually deployed so far, what each
one does, and which one (if any) is safe to paste into Flap's launch flow.
