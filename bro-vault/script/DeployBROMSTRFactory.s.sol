// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {BROMSTRVaultBeaconFactory} from "../src/BROMSTRVaultFactory.sol";

/// @notice Broadcast-capable deployment helper for the BRO MSTR Vault factory.
/// @dev Do not broadcast until a Robinhood-compatible V4 swap adapter and the
///      proportional-distribution design have both been independently verified.
///
/// Required environment variables:
///   RPC_URL       Robinhood Chain RPC endpoint.
///   MSTR_ADDRESS  Verified MSTR Stock Token address. The script retains this
///                 environment input for dry-run flexibility; the caller must
///                 use Robinhood's canonical deployment.
///
/// Optional environment variables:
///   SWAP_ADAPTER  Pre-deployed IMSTRSwapAdapter address. If unset, the
///                 factory is deployed with address(0) and every vault it
///                 creates will simply be unable to dispatch() until the
///                 Guardian calls setDefaultSwapAdapter / setSwapAdapter.
///   KEEPER        Off-chain automation address. If unset, only the
///                 Guardian can call dispatch/push/credit until one is set.
///
/// Usage:
///   forge script script/DeployBROMSTRFactory.s.sol:DeployBROMSTRFactory \
///       --rpc-url $RPC_URL --account deployer --broadcast -vvvv
contract DeployBROMSTRFactory is Script {
    address internal constant CANONICAL_ROBINHOOD_MSTR = 0xec262a75e413fAfD0dF80480274532C79D42da09;

    function run() external returns (BROMSTRVaultBeaconFactory factory) {
        address mstr = vm.envAddress("MSTR_ADDRESS");
        require(mstr == CANONICAL_ROBINHOOD_MSTR, "MSTR_ADDRESS is not canonical Robinhood MSTR");
        address swapAdapter = vm.envOr("SWAP_ADAPTER", address(0));
        address keeper = vm.envOr("KEEPER", address(0));

        console.log("Deploying BROMSTRVaultBeaconFactory");
        console.log("  MSTR:", mstr);
        console.log("  Initial swap adapter:", swapAdapter);
        console.log("  Initial keeper:", keeper);
        if (swapAdapter == address(0)) {
            console.log("  WARNING: no swap adapter set -- vaults created by this");
            console.log("  factory cannot dispatch() until the Guardian configures one.");
        }

        vm.startBroadcast();
        factory = new BROMSTRVaultBeaconFactory(mstr, swapAdapter, keeper);
        vm.stopBroadcast();

        console.log("Factory deployed at:", address(factory));
        console.log("Beacon at:", factory.beacon());
        console.log("");
        console.log("Next steps:");
        console.log("1. Verify the factory + beacon on Robinhood Chain's explorer.");
        console.log("2. Do not deploy the V3 reference adapter on Robinhood Chain.");
        console.log("   Verify a real Uniswap V4 route and adapter first, then call");
        console.log("   factory.setDefaultSwapAdapter(...) as Guardian.");
        console.log("3. Go to Flap -> Launch Token -> Custom Vault, paste this factory");
        console.log("   address, and confirm the auto-generated form shows");
        console.log("   selectedAsset / symbol / instantDividend as expected.");
    }
}
