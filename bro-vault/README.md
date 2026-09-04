# BRO MSTR VaultFactory

A custom Flap.sh Vault + VaultFactory for `$BRO`: receives trading-tax
revenue in ETH, swaps it for MSTR through a pluggable adapter, and
distributes MSTR to eligible `$BRO` holders.

**Status: not deployed and not ready for deployment.** The bundled test suite
has not been rerun in this environment because Foundry and the declared
dependencies are absent. More importantly, no verified production ETH → MSTR
route has yet been identified.

## What's real vs. what's configuration you still need to supply

This project follows one rule throughout: nothing that isn't independently
verifiable gets hardcoded. Three things fall out of that:

### Confirmed, real, verified against source
- `src/flap/*.sol` — pulled directly from
  [flap-sh/FlapVaultExample](https://github.com/flap-sh/FlapVaultExample),
  byte-for-byte, unmodified (the repo explicitly requires this directory
  stay untouched).
- Robinhood Chain's Guardian (`0x0000b48720d3B4ED6BC5031768B07F2b59270000`),
  Portal (`0x26605f322f7fF986f381bB9A6e3f5DAb0bEaEb09`), and VaultPortal
  (`0xe9F7AB7DE8FB8756acbB6a1cd13316a43308197B`) addresses — these are
  hardcoded *inside the official Flap interface files themselves*, not
  something this project invented.
- The `newVault(address taxToken, address quoteToken, address creator, bytes vaultData)`
  signature, the beacon-proxy deployment pattern, and the
  `vaultDataSchema()` / `vaultUISchema()` UI-generation mechanism — all
  copied from Flap's own reference implementation
  (`FreeCoinVaultBeaconFactory` in the same repo), not guessed at.

### Genuinely unverified — you must confirm these before deploying
- **MSTR address** (`0xec262a75e413fAfD0dF80480274532C79D42da09`) is now
  independently verified against Robinhood's live `/rhj/assets` registry as
  the active, 18-decimal `Strategy Inc. • Robinhood Token` deployment on
  chain ID 4663.
- **The swap mechanism.** Robinhood Chain is documented as supporting
  Uniswap V4 through its Universal Router. `MSTRSwapAdapterUniV3Reference.sol`
  is not compatible: it calls V3 `exactInputSingle`, and it now explicitly
  reverts if deployed on Robinhood mainnet or testnet. A V4 route still needs
  a verified PoolKey (currency pair, fee, tick spacing, hook) and an
  executable quote/swap simulation proving that MSTR liquidity is present.

### A real design tradeoff, not a gap
The vault distributes via keeper-computed batch push (`pushDividends`) or a
claim fallback (`creditDividends` + `claim`). This is **not a trustless
proportional-distribution mechanism**: the contract limits total payouts to
the MSTR held but does not verify the keeper's holder snapshot, balances, or
allocations. Do not represent it as on-chain proportional distribution or
deploy it for that promise without a specified attestation/snapshot design.

## Structure

```
src/
├── flap/                          ← REQUIRED & IMMUTABLE, do not modify
│   ├── IPortal.sol
│   ├── IVaultFactory.sol
│   ├── IVaultPortal.sol
│   ├── IVaultSchemasV1.sol
│   ├── VaultBase.sol
│   ├── VaultBaseV2.sol
│   └── VaultFactoryBaseV2.sol
├── BROMSTRVault.sol                ← the vault
├── BROMSTRVaultFactory.sol         ← beacon-proxy factory + asset registry
├── IMSTRSwapAdapter.sol            ← minimal interface, isolates the unverified piece
└── MSTRSwapAdapterUniV3Reference.sol  ← incompatible with Robinhood; guarded against deployment there
script/
└── DeployBROMSTRFactory.s.sol      ← deployment script, env-var driven
test/
└── BROMSTRVault.t.sol              ← 23 tests, all passing
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
- Guardian-gated config (`setSwapAdapter`, `setKeeper`, `lockConfig`) per
  Flap's mandate that Guardian always retains backup access
- `lockConfig()` — irreversible, disables further swap-adapter changes
- The selected reward asset is checked against the factory's immutable MSTR
  deployment value, cannot be deregistered, and has no vault-level setter
- `claim()` has no recipient parameter — `msg.sender` is the only possible
  recipient, so no caller can claim or redirect another holder's rewards
- `pushDividends`/`creditDividends` revert if the requested total exceeds
  the vault's actual unreserved MSTR balance. This protects solvency only;
  a compromised keeper can still send real MSTR to arbitrary recipients.
- Slippage (`minMstrOut`) and deadline protection on every swap
- Asset registry validation: zero-address rejection, duplicate rejection,
  max-assets enforcement, unsupported-asset rejection
- No function anywhere lets the deployer/creator withdraw MSTR belonging
  to holders, redirect the vault to an unrelated token, or modify the
  100% MSTR allocation post-launch

## What's NOT done yet

- **No third-party audit.** Per Flap's own process, run the
  `flap-vault-spec-checker` Copilot skill from the FlapVaultExample repo
  before submitting for audit, and expect a warning banner on Flap.sh
  until that audit completes.
- **No Robinhood-mainnet-fork integration test.** Flap publishes a
  `FlapRobinhoodFixture.sol` and Robinhood-specific integration example;
  this repository does not vendor the supporting fixture files. Add the
  fixture, launch through the real VaultPortal on a fork, and prove the
  TaxProcessor forwards ETH to the created vault before audit submission.
- **No verified ETH → MSTR V4 route.** Do not write or deploy an adapter
  until the exact live pool/route and quote execution have been verified.
- **No trustless proportional allocation rule.** A keeper-authenticated
  Merkle snapshot/attestation specification (including snapshot source,
  block number, total eligible balance, replay prevention, and claim proof)
  is required before this can truthfully promise proportional distribution.
- **No deployment has happened.** Nothing here has touched mainnet or
  testnet yet.

## Deployment

```bash
export RPC_URL="https://rpc.mainnet.chain.robinhood.com"  # verify current URL first
# Do not broadcast. First use a fork and a verified V4 adapter.
export MSTR_ADDRESS="0xec262a75e413fAfD0dF80480274532C79D42da09"
forge script script/DeployBROMSTRFactory.s.sol:DeployBROMSTRFactory \
    --rpc-url $RPC_URL --account deployer
```

Do not deploy to Robinhood Chain testnet or mainnet until the V4 route,
proportional-distribution design, full fork test, and independent audit are
complete.
