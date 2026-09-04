# Deployments

## Robinhood Chain mainnet (chain ID 4663)

### Current -- use this one

| Item | Address / Value |
|---|---|
| `BROMSTRVaultBeaconFactory` | `0x6341d9d487bB534fD63b8B3c0aE562bca116aa9e` |
| Beacon (`UpgradeableBeacon`) | `0x900e2B0eB59A4353a48cb393F6535faeD1C98c04` |
| Vault implementation (`BROMSTRVaultUpgradeable`) | `0x58cEfcf47ED7C731c6a9479c6C5ddC67821458ea` |
| MSTR (constructor arg) | `0xec262a75e413fAfD0dF80480274532C79D42da09` |
| Initial `defaultSwapAdapter` | `0x0000000000000000000000000000000000000000` (unset) |
| Initial `defaultKeeper` | `0x0000000000000000000000000000000000000000` (unset) |
| Deployment tx | `0xfda407598a7e9f31d58badce96d6d5f43b4bfc7495845ec3422163ffeeebc872` |
| Block | 54163866 |
| Deployer | `0x7DE1877a329849badfb200aC3BC84f9C9e86c70B` |
| Actual cost | 0.001849755551024 ETH (gas 5,186,851 @ 0.3566 gwei effective) |

Verified independently against live RPC (`https://rpc.mainnet.chain.robinhood.com`) after
broadcast: receipt status 1, factory bytecode present, `factory.MSTR()`,
`factory.isSupportedAsset(MSTR)`, `factory.beacon()`, `factory.beaconImplementation()`,
and `factory.vaultDataSchema()` (confirming the `selectedAsset` field now encodes as
scalar `"address"`, not `"address[]"`) all read back correctly.

### Deprecated -- do not use for launching on Flap

| Item | Address / Value |
|---|---|
| `BROMSTRVaultBeaconFactory` (v1, broken) | `0xb57425a833CfA107b3c4EaB171B8bce10D974457` |
| Deployment tx | `0xfe25dd161804cd39ed93767e5cc7ab208070cb1bc877099d642199ca3c738c10` |

This version's `vaultDataSchema()` declared `selectedAssets` as `address[]`, a
leaf array type that Flap's schema spec (`IVaultSchemasV1.sol`) does not
support for scalar form-driven encoding. Flap's real launch UI (viem) failed
with `"Value ... is not a valid array"` when trying to encode a single address
against that array type. Fixed in the current factory by changing
`selectedAsset` to a plain `address` field (BRO's vault only ever supports
MSTR anyway, so the array was unnecessary). Left deployed on-chain as a
harmless but unusable artifact -- do not paste this address into Flap.

**No vault has been created yet.** A vault is created automatically by Flap's
VaultPortal when the **current** factory address above is pasted into Flap's
Custom Vault launch flow (Flap -> Launch Token -> Custom Vault). That will
emit `VaultCreated` and mint a new `BeaconProxy` vault instance for the
launched tax token -- record that address/tx here once it happens.

**Known blocker:** `defaultSwapAdapter` is unset. Vaults created by this factory
can receive tax ETH but cannot `dispatch()` (swap ETH -> MSTR) until Guardian
(`0x0000b48720d3B4ED6BC5031768B07F2b59270000`) calls `setDefaultSwapAdapter` /
`setSwapAdapter` with a real adapter. Robinhood Chain's Universal Router uses a
modified V4 swap struct (extra `minHopPriceX36` field before `hookData`) that
standard Uniswap V4 SDK calldata does not match -- see README for detail. No
adapter should be deployed or wired in until that integration is verified
against Robinhood's actual router ABI.
