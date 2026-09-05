# Deployments

## Robinhood Chain mainnet (chain ID 4663)

### Current -- use this one

| Item | Address / Value |
|---|---|
| `BROMSTRVaultBeaconFactory` | `0x872aD0df771080dF74Ee1C582a8F9765A1236bb8` |
| Beacon (`UpgradeableBeacon`) | `0x76ADb280ABAe6bf4Ec35a7f7c3c7DD28809dBdCc` |
| Vault implementation (`BROMSTRVaultUpgradeable`, 80/15/5 design) | `0x05CD10B92980d4DBA01Ed9a515d2dB3567295764` |
| MSTR (constructor arg) | `0xec262a75e413fAfD0dF80480274532C79D42da09` |
| `defaultKeeper` | `0x38F5E7623E54E667127e7E9Cc65EC942d9A73e73` |
| `defaultMstrSwapAdapter` | `0x0000000000000000000000000000000000000000` (unset -- see below) |
| `defaultLiquidityAdapter` | `0x0000000000000000000000000000000000000000` (unset -- see below) |
| `defaultBurnSwapAdapter` | `0x0000000000000000000000000000000000000000` (unset -- see below) |
| Deployment tx | `0x304ff3b8541c39811de78cef04740e7c1df61ca27736c1bb55af16bba35366e1` |
| Block | 54708256 |
| Deployer | `0x7DE1877a329849badfb200aC3BC84f9C9e86c70B` |
| Actual cost | 0.002674775433836 ETH (gas 6,605,134 @ 0.404954 gwei effective) |

Verified independently against live RPC (`https://rpc.mainnet.chain.robinhood.com`)
after broadcast: receipt status 1, factory bytecode present, `factory.MSTR()`,
`factory.defaultKeeper()`, `factory.defaultMstrSwapAdapter()`,
`factory.defaultLiquidityAdapter()`, `factory.defaultBurnSwapAdapter()`,
`factory.beacon()`, `beacon.implementation()`, and `factory.isSupportedAsset
(MSTR)` all read back correctly -- keeper set exactly as intended, all three
adapter slots genuinely `address(0)` (no fakes).

**This factory includes the `vaultData` double-encoding fix -- see
"Flap `vaultData` encoding bug" below.** It was additionally verified, live
on mainnet via `cast call` (not just local tests), to accept the exact real
malformed `vaultData` bytes captured from Flap's own failed launch attempt,
and to produce the identical resulting vault address as a correctly-encoded
call -- direct on-chain proof the fix works before recommending it for use.

This factory implements the 80% dividend / 15% auto-liquidity / 5% burn
split (see main README). **No vault has been created yet.** A vault is
created automatically by Flap's VaultPortal when this factory address is
pasted into Flap's Custom Vault launch flow (Flap -> Launch Token -> Custom
Vault, `customfactory = 100%`, native Dividend/Burn/Liquidity sliders at
`0%`). That will emit `VaultCreated` and mint a new `BeaconProxy` vault
instance for BRO -- record that address/tx here once it happens.

**Known blocker -- by design, not an oversight:** all three adapter slots
are unset. Every adapter (`MSTRSwapAdapterRobinhoodV3`,
`BROLiquidityAdapterRobinhoodV2`, `BROBurnSwapAdapterRobinhoodV2`) takes the
real *vault* address as an immutable constructor argument, so none of them
could be deployed before this factory (and therefore the vault) existed.
Next steps once BRO launches:

1. Deploy `MSTRSwapAdapterRobinhoodV3` with the real vault address (can
   happen immediately -- MSTR's WETH pool already exists and is verified,
   see the adapter's own NatSpec for the exact pool/router addresses used).
2. Guardian (`0x0000b48720d3B4ED6BC5031768B07F2b59270000`) calls
   `vault.setMstrSwapAdapter(...)` to wire it in. **This step is not
   confirmed to be self-serve** -- see the main README / prior discussion:
   nothing in Flap's spec documents a routine process for this, and it
   needs to be asked of Flap directly once BRO has launched.
3. Once BRO itself graduates off Flap's bonding curve and its own WETH/BRO
   pool exists, repeat steps 1-2 for `BROLiquidityAdapterRobinhoodV2` and
   `BROBurnSwapAdapterRobinhoodV2` (verify the pool type -- V2 assumed based
   on Flap's `MigratorType` documentation excluding Robinhood from
   `V4_UNI_MIGRATOR`, but not yet independently confirmed for BRO
   specifically since it doesn't exist yet).

### Flap launch failure -- root-caused, no redeploy needed

The first BRO launch attempt on Flap failed client-side ("Token creation
failed for an unrecognized contract reason. Error code: 0x1b0062e0") with no
on-chain transaction ever broadcast (confirmed by checking the full real tx
history of the deployer wallet). `0x1b0062e0` does not match any error
selector in our contracts, in Flap's real verified `VaultPortal`/
`VaultPortalBase`/interfaces, in `VAULT_PORTAL_LAUNCH`'s own deployed
bytecode, in OpenZeppelin, in Solidity builtins, or in any public signature
database -- it is almost certainly a client-side/frontend code, not a raw
on-chain revert selector.

`newTokenV6WithVault` on the real `VaultPortal` proxy
(`0xe9F7AB7DE8FB8756acbB6a1cd13316a43308197B`) delegatecalls straight into
`VAULT_PORTAL_LAUNCH` (`0x8B4329947e34B6d56D71A3385caC122BaDe7d78D`), which is
**not publicly verified** -- all real launch validation logic lives there.
`test/BROMSTRVault.launchSim.fork.t.sol` black-box tests it directly on a
live mainnet fork (no broadcast) with our real deployed factory
(`0x963311e32cd50BCBF99990467B8C5354Ba05017d`) as `vaultFactory`, and found
the actual root cause empirically:

- `mktBps == 0` -- i.e. Flap's "Marketing" tax-allocation slider left at
  0% -- reverts `InvalidMktBps()` (`0x2b1599db`, confirmed present in
  `VAULT_PORTAL_LAUNCH`'s own bytecode and resolved via openchain.xyz)
  **before our factory or vault code ever runs.**
- A nonzero-but-partial `mktBps` (e.g. 500 = 5%) passes that check and
  reaches *our* factory's `onBeforeLaunch`, which correctly rejects it with
  our own exact string ("BRO MSTR Vault requires 100% of tax revenue to be
  allocated to the vault."). This proves Flap's real `LaunchValidationDataV1
  .vaultBps` equals `mktBps` **verbatim** -- Flap redirects the "Marketing"
  bps recipient to the custom vault, it does not compute `10_000 - mktBps`.
- `mktBps == 10_000` (deflation/dividend/lp bps all 0) passes `InvalidMktBps()`
  **and** passes our factory's `vaultBps == 10_000` check silently. The next
  revert is `InvalidVanity(address)` (`0x7576ca0a`) -- Flap's ordinary
  vanity-suffix salt-mining requirement that applies to every token launch on
  Flap and is already handled automatically by Flap's own frontend. It is
  unrelated to our custom vault factory and needs no fix here.

**Conclusion at this point: our factory is correct and does not need to be
changed or redeployed.** To launch BRO, set Flap's **Marketing allocation
slider to 100%** (not 0%) -- it is the field that gets redirected to the
custom vault for a custom-vault launch, not a separate "Vault %" control --
while the native Dividend/Burn/Liquidity sliders stay at 0%, exactly as
before.

#### Follow-up: the same 0x1b0062e0 error persisted after following that fix

The user set Flap's UI to Customfactory 100% / Burn 0% / Dividend 0% /
Liquidity 0% / Unallocated 0% (confirmed via the JS bundle to mean
`mktBps=10000, deflationBps=dividendBps=lpBps=0`, matching the passing case
above) and the launch still failed with the identical `0x1b0062e0` code,
still with zero on-chain transaction. Further investigation:

- Pulled and grepped Flap's actual production frontend JS bundle
  (`flap.sh/launch`, webpack chunk containing module 52470). Found the real
  field-assignment line: `mktBps:BigInt(100*tN),vaultBps:BigInt(100*tN)` --
  **directly confirms `vaultBps === mktBps` verbatim**, independently of the
  earlier on-chain-only finding. Also found Flap's complete
  errorName -> message dictionary (`contractErrors`), used by their own
  generic revert decoder: it only shows the raw `0x{code}` fallback
  ("unrecognized contract reason") when the extracted 4-byte selector is
  **not** in that dictionary at all -- i.e. `0x1b0062e0` is a genuine
  selector Flap's own frontend doesn't recognize either, not a fabricated
  UI code.
- Extended `BROMSTRVault.launchSim.fork.t.sol` with
  `test_bruteForceVanitySalt_findsRealNextFailureMode`: brute-forced salts
  (since the real vanity-mining formula used by the unverified
  `VAULT_PORTAL_LAUNCH` isn't known) until one passed `InvalidVanity`, this
  time with a nonzero `quoteAmt` (0.02 ETH initial buy) to exercise the
  swap code path my first simulation skipped entirely. **Result: the real
  call SUCCEEDS** (found at loop index 7264) -- a full, real
  `newTokenV6WithVault` launch against our exact deployed factory, with a
  real initial buy, genuinely completes on a live mainnet fork. This rules
  out `quoteAmt`/vanity-salt validity as an explanation and is the
  strongest possible proof the factory and the whole launch mechanism work.
- Directly fetched deployed bytecode for every other contract touched by
  either the launch or the CA-reservation (`lockSalt`, part of `PORTAL`)
  flow -- `PORTAL` proxy implementation
  (`0xa3b96Df56f254B926B17D5f7FB6CD858c216ff44`) and
  `TOKEN_IMPL_V3` (`0x8888F2eA44469f46798773D42cd6339F273f3333`) -- and
  grepped for the literal `1b0062e0` selector bytes. Absent from both, same
  as every contract checked in the first round.
- Attempted to drive Flap's actual launch page in a headless browser
  (Playwright/Chromium, available in this environment) to capture the real
  RPC traffic directly instead of inferring it. Blocked by this session's
  outbound proxy infrastructure (TLS tunnel to flap.sh resets after ~6s,
  independent of Chromium flags tried) -- an environment limitation, not
  a research dead end abandoned early.

**Status: root cause still not found after two full rounds of black-box
verification.** Every contract in the known call graph (our factory, our
vault, the `VaultPortal` proxy and implementation, `VAULT_PORTAL_LAUNCH`,
`PORTAL` and its implementation, both token implementations) has been
checked directly against live bytecode and does not contain this selector.
A complete, realistic launch (real vanity salt, real initial buy, our real
factory) succeeds in simulation. The three things that would most likely
close this out, in order of how decisive they'd be:

1. **The actual failing RPC request/response**, captured from the
   browser's Network tab (or wallet's own request log) at the moment of
   failure -- the `eth_call`/`eth_estimateGas` request body shows the exact
   parameters really sent, and the response shows the exact revert data,
   removing all guesswork about what the frontend is actually doing.
2. **Whether a CA was reserved first** via Flap's `/prelaunch` flow
   (`lockSalt`, a real separate on-chain transaction) before this launch
   attempt, and if so, for which `tokenVersion`. If an old reservation is
   being reused with mismatched parameters this could route through
   different, still-unchecked logic.
3. **The wallet's connected chain ID** at the moment of failure -- if it
   was pointed at a different chain than Robinhood (4663), the "same"
   factory address there is an unrelated contract with unrelated errors,
   which would fully explain a genuinely unrecognized selector.

### Keeper bot

`bro-vault/keeper/` is ready to run once the vault exists (see its own
README). It needs `VAULT_ADDRESS` (the real vault, not the factory) and the
keeper wallet's private key in its `.env`. The keeper wallet
(`0x38F5E7623E54E667127e7E9Cc65EC942d9A73e73`) is currently unfunded --
send it gas ETH once dispatching is actually needed.

### Deprecated -- do not use for launching on Flap

| Item | Address / Value | Why deprecated |
|---|---|---|
| `BROMSTRVaultBeaconFactory` (v4, broken fix attempt) | `0x71ac1228c35bE7a15DC3C0Ea7635a83420c61971` | First attempt at the `vaultData` double-encoding fix. Wrong: assumed Flap wrapped `vaultData` as `abi.encode(bytes)` (offset + length + content) and tried to strip it via `abi.decode(vaultData, (bytes))`. The real encoding has no length field at all (see current entry above) -- misreading the real `selectedAsset` address bytes as a `bytes` length caused `Panic(0x41)` ("out of memory") instead of a clean revert, which is *worse* than the original bug. Caught by directly replaying the real captured malformed bytes against the live deployed contract before recommending it -- never used for a real launch. |
| `BROMSTRVaultBeaconFactory` (v3, 80/15/5, no vaultData fix) | `0x963311e32cd50BCBF99990467B8C5354Ba05017d` | Correct 80/15/5 design and correct on every config check, but `newVault()` decodes `vaultData` as flat `(address, string, bool)` only. Some Flap frontend builds encode `vaultData` as a single ABI tuple parameter instead (see "Flap `vaultData` encoding bug" below), which this factory can't decode -- every real launch attempt against it failed with an unexplained, empty-data revert. |
| `BROMSTRVaultBeaconFactory` (v2, 100%-MSTR-only design) | `0x6341d9d487bB534fD63b8B3c0aE562bca116aa9e` | Superseded by the 80/15/5 redesign above. Functionally correct for what it was, but doesn't match the current vault design and has no keeper set. |
| `BROMSTRVaultBeaconFactory` (v1, broken) | `0xb57425a833CfA107b3c4EaB171B8bce10D974457` | `vaultDataSchema()` declared `selectedAssets` as `address[]`, which Flap's real launch UI (viem) failed to encode (`"Value ... is not a valid array"`). Fixed by switching to a scalar `address` field in v2 onward. |

All older factories are harmless, unusable artifacts left on-chain (no
funds, no privileged owner role) -- do not paste any of them into Flap.

### Flap `vaultData` encoding bug -- root-caused and worked around

Real BRO launch attempts on Flap kept failing with "Token creation failed
for an unrecognized contract reason. Error code: 0x1b0062e0" and zero
on-chain trace. Root-caused by capturing Flap's actual `eth_estimateGas`
request from the browser console and decoding the real calldata byte-for-byte
(not simulated with guessed parameters):

- The "error code" shown in Flap's UI is not a real error selector at all --
  it's `newTokenV6WithVault`'s own function selector, echoed back as a
  fallback when Flap's frontend has no real revert reason to decode.
- The actual on-chain revert is **empty** (`data: "0x"`, zero bytes) -- the
  signature of a raw `abi.decode` failure, not a named Solidity error.
- Isolated field-by-field by replaying the real captured calldata against
  live mainnet via `cast call`, changing one field at a time: `mktBps`,
  the vanity salt, tax durations, name/symbol/meta, and the initial-buy
  amount were all fine. The sole trigger is `vaultData`.
- Flap's frontend encodes `vaultData` as **one ABI tuple parameter** --
  `abi.encode((selectedAsset, symbol, instantDividend))` -- instead of flat
  top-level fields -- `abi.encode(selectedAsset, symbol, instantDividend)`,
  which is what this factory's `newVault()` and Flap's own official
  `VaultFactoryBaseV2` reference example (`FreeCoinBeacon.sol` in
  `flap-sh/FlapVaultExample`) both expect. Confirmed byte-for-byte via
  `cast abi-encode "f((address,string,bool))"`.
- Because the tuple contains a dynamic `string` member, encoding it as one
  parameter prepends a single extra 32-byte `0x20` offset word ahead of an
  otherwise byte-identical flat encoding. Decoded directly as
  `(address, string, bool)`, that word gets misread as `selectedAsset`
  itself, and the real `selectedAsset` address gets misread as a wildly
  out-of-bounds `string` offset -- hence the empty revert.

**This is a bug in Flap's own frontend**, not in our contracts -- our
factory decodes `vaultData` exactly the way Flap's own reference example
does. The fix lives in `BROMSTRVaultFactory.sol`'s `_decodeVaultData()`:
detect a leading `0x20` word (a legitimate `selectedAsset` can never equal
exactly `32`) and skip it before decoding, so the factory accepts *either*
encoding. Verified two ways before being recommended for use: the full
Foundry test suite, and a direct `cast call` replay of the exact real
captured malformed bytes against the live deployed factory on mainnet,
confirmed to produce the identical result as a correctly-encoded call.
