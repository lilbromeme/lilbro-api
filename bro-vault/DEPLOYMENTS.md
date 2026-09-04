# Deployments

## Robinhood Chain mainnet (chain ID 4663)

| Item | Address / Value |
|---|---|
| `BROMSTRVaultBeaconFactory` | `0xb57425a833CfA107b3c4EaB171B8bce10D974457` |
| Beacon (`UpgradeableBeacon`) | `0x5254C0600E0212218Fea5244328e95477A29fC69` |
| Vault implementation (`BROMSTRVaultUpgradeable`) | `0x4Ca4AB943358b32f9b726EdC8fE6B9516639e3Ae` |
| MSTR (constructor arg) | `0xec262a75e413fAfD0dF80480274532C79D42da09` |
| Initial `defaultSwapAdapter` | `0x0000000000000000000000000000000000000000` (unset) |
| Initial `defaultKeeper` | `0x0000000000000000000000000000000000000000` (unset) |
| Deployment tx | `0xfe25dd161804cd39ed93767e5cc7ab208070cb1bc877099d642199ca3c738c10` |
| Block | 54159482 |
| Deployer | `0x7DE1877a329849badfb200aC3BC84f9C9e86c70B` |
| Actual cost | 0.001872699715032 ETH (gas 5,355,804 @ 0.3497 gwei effective) |

Verified independently against live RPC (`https://rpc.mainnet.chain.robinhood.com`) after
broadcast: receipt status 1, factory bytecode present, `factory.MSTR()`,
`factory.isSupportedAsset(MSTR)`, `factory.beacon()`, `factory.beaconImplementation()`
all read back correctly.

**No vault has been created yet.** A vault is created automatically by Flap's
VaultPortal when this factory address is pasted into Flap's Custom Vault launch
flow (Flap -> Launch Token -> Custom Vault). That will emit `VaultCreated` and
mint a new `BeaconProxy` vault instance for the launched tax token -- record
that address/tx here once it happens.

**Known blocker:** `defaultSwapAdapter` is unset. Vaults created by this factory
can receive tax ETH but cannot `dispatch()` (swap ETH -> MSTR) until Guardian
(`0x0000b48720d3B4ED6BC5031768B07F2b59270000`) calls `setDefaultSwapAdapter` /
`setSwapAdapter` with a real adapter. Robinhood Chain's Universal Router uses a
modified V4 swap struct (extra `minHopPriceX36` field before `hookData`) that
standard Uniswap V4 SDK calldata does not match -- see README for detail. No
adapter should be deployed or wired in until that integration is verified
against Robinhood's actual router ABI.
