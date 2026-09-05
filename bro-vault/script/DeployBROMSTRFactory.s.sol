// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {BROMSTRVaultBeaconFactory} from "../src/BROMSTRVaultFactory.sol";

/// @notice Broadcast-capable deployment helper for the BRO MSTR Vault factory.
/// @dev Do not broadcast until the Robinhood-compatible swap/liquidity adapters
///      and the proportional-distribution design have all been independently
///      verified.
///
/// Required environment variables:
///   RPC_URL       Robinhood Chain RPC endpoint.
///   MSTR_ADDRESS  Verified MSTR Stock Token address. The script retains this
///                 environment input for dry-run flexibility; the caller must
///                 use Robinhood's canonical deployment.
///
/// Optional environment variables:
///   MSTR_SWAP_ADAPTER Pre-deployed IMSTRSwapAdapter address for the 80%
///                 dividend leg (ETH -> MSTR). If unset, the factory is
///                 deployed with address(0) and every vault it creates will
///                 be unable to dispatchDividend() until the Guardian calls
///                 setDefaultMstrSwapAdapter / setMstrSwapAdapter.
///   LIQUIDITY_ADAPTER Pre-deployed ILiquidityAdapter address for the 15%
///                 auto-liquidity leg. Same caveat as above for
///                 dispatchLiquidity().
///   BURN_SWAP_ADAPTER Pre-deployed IMSTRSwapAdapter address (reused
///                 generically) for the 5% buy-and-burn leg (ETH -> BRO).
///                 Same caveat as above for dispatchBurn().
///   KEEPER        Off-chain automation address. If unset, only the
///                 Guardian can call the dispatch*/push/credit functions
///                 until one is set.
///
/// Usage:
///   forge script script/DeployBROMSTRFactory.s.sol:DeployBROMSTRFactory \
///       --rpc-url $RPC_URL --account deployer --broadcast -vvvv
contract DeployBROMSTRFactory is Script {
    address internal constant CANONICAL_ROBINHOOD_MSTR = 0xec262a75e413fAfD0dF80480274532C79D42da09;

    function run() external returns (BROMSTRVaultBeaconFactory factory) {
        address mstr = vm.envAddress("MSTR_ADDRESS");
        require(mstr == CANONICAL_ROBINHOOD_MSTR, "MSTR_ADDRESS is not canonical Robinhood MSTR");
        address mstrSwapAdapter = vm.envOr("MSTR_SWAP_ADAPTER", address(0));
        address liquidityAdapter = vm.envOr("LIQUIDITY_ADAPTER", address(0));
        address burnSwapAdapter = vm.envOr("BURN_SWAP_ADAPTER", address(0));
        address keeper = vm.envOr("KEEPER", address(0));

        console.log("Deploying BROMSTRVaultBeaconFactory");
        console.log("  MSTR:", mstr);
        console.log("  Initial MSTR swap adapter (80% dividend leg):", mstrSwapAdapter);
        console.log("  Initial liquidity adapter (15% auto-LP leg):", liquidityAdapter);
        console.log("  Initial burn swap adapter (5% buy-and-burn leg):", burnSwapAdapter);
        console.log("  Initial keeper:", keeper);
        if (mstrSwapAdapter == address(0)) {
            console.log("  WARNING: no MSTR swap adapter set -- vaults created by this");
            console.log("  factory cannot dispatchDividend() until the Guardian configures one.");
        }
        if (liquidityAdapter == address(0)) {
            console.log("  WARNING: no liquidity adapter set -- vaults created by this");
            console.log("  factory cannot dispatchLiquidity() until the Guardian configures one.");
        }
        if (burnSwapAdapter == address(0)) {
            console.log("  WARNING: no burn swap adapter set -- vaults created by this");
            console.log("  factory cannot dispatchBurn() until the Guardian configures one.");
        }

        vm.startBroadcast();
        factory = new BROMSTRVaultBeaconFactory(mstr, mstrSwapAdapter, liquidityAdapter, burnSwapAdapter, keeper);
        vm.stopBroadcast();

        console.log("Factory deployed at:", address(factory));
        console.log("Beacon at:", factory.beacon());
        console.log("");
        console.log("Next steps:");
        console.log("1. Verify the factory + beacon on Robinhood Chain's explorer.");
        console.log("2. Verify real Uniswap V4 (dividend/burn swaps) and BRO-pair");
        console.log("   liquidity routes on Robinhood Chain before deploying any");
        console.log("   adapter, then call the relevant factory.setDefault*Adapter(...)");
        console.log("   as Guardian.");
        console.log("3. Go to Flap -> Launch Token -> Custom Vault, paste this factory");
        console.log("   address, and confirm the auto-generated form shows");
        console.log("   selectedAsset / symbol / instantDividend as expected.");
    }
}
