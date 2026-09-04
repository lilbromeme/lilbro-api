# Deployments

## Robinhood Chain mainnet (chain ID 4663)

### Current -- use this one

| Item | Address / Value |
|---|---|
| `BROMSTRVaultBeaconFactory` | `0x963311e32cd50BCBF99990467B8C5354Ba05017d` |
| Beacon (`UpgradeableBeacon`) | `0xdd2C5Bf7aB97dCf0213accb3Cc210C5f27B852C5` |
| Vault implementation (`BROMSTRVaultUpgradeable`, 80/15/5 design) | `0x744DfB6f46166A47d883d43A7cff49C6ed225dfF` |
| MSTR (constructor arg) | `0xec262a75e413fAfD0dF80480274532C79D42da09` |
| `defaultKeeper` | `0x38F5E7623E54E667127e7E9Cc65EC942d9A73e73` |
| `defaultMstrSwapAdapter` | `0x0000000000000000000000000000000000000000` (unset -- see below) |
| `defaultLiquidityAdapter` | `0x0000000000000000000000000000000000000000` (unset -- see below) |
| `defaultBurnSwapAdapter` | `0x0000000000000000000000000000000000000000` (unset -- see below) |
| Deployment tx | `0xdb7eb181a1ddb1a43ac3fb53e26cb6b22ef23b1b282ded977b6f8cf17a82d362` |
| Block | 54503807 |
| Deployer | `0x7DE1877a329849badfb200aC3BC84f9C9e86c70B` |
| Actual cost | 0.00256684425908 ETH (gas 6,563,644 @ 0.39107 gwei effective) |

Verified independently against live RPC (`https://rpc.mainnet.chain.robinhood.com`)
after broadcast: receipt status 1, factory bytecode present, `factory.MSTR()`,
`factory.defaultKeeper()`, `factory.defaultMstrSwapAdapter()`,
`factory.defaultLiquidityAdapter()`, `factory.defaultBurnSwapAdapter()`,
`factory.beacon()`, `factory.beaconImplementation()`, and
`factory.isSupportedAsset(MSTR)` all read back correctly -- keeper set exactly
as intended, all three adapter slots genuinely `address(0)` (no fakes).

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

### Keeper bot

`bro-vault/keeper/` is ready to run once the vault exists (see its own
README). It needs `VAULT_ADDRESS` (the real vault, not the factory) and the
keeper wallet's private key in its `.env`. The keeper wallet
(`0x38F5E7623E54E667127e7E9Cc65EC942d9A73e73`) is currently unfunded --
send it gas ETH once dispatching is actually needed.

### Deprecated -- do not use for launching on Flap

| Item | Address / Value | Why deprecated |
|---|---|---|
| `BROMSTRVaultBeaconFactory` (v2, 100%-MSTR-only design) | `0x6341d9d487bB534fD63b8B3c0aE562bca116aa9e` | Superseded by the 80/15/5 redesign above. Functionally correct for what it was, but doesn't match the current vault design and has no keeper set. |
| `BROMSTRVaultBeaconFactory` (v1, broken) | `0xb57425a833CfA107b3c4EaB171B8bce10D974457` | `vaultDataSchema()` declared `selectedAssets` as `address[]`, which Flap's real launch UI (viem) failed to encode (`"Value ... is not a valid array"`). Fixed by switching to a scalar `address` field in v2 onward. |

Both older factories are harmless, unusable artifacts left on-chain (no
funds, no privileged owner role) -- do not paste either into Flap.
