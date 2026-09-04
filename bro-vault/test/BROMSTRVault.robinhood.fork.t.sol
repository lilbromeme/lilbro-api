// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {BROMSTRVaultBeaconFactory} from "../src/BROMSTRVaultFactory.sol";
import {BROMSTRVaultUpgradeable} from "../src/BROMSTRVault.sol";

/// @notice Read-only Robinhood Chain mainnet-fork smoke coverage.
/// @dev This deliberately does not call a swap router or claim that a live
///      MSTR pool exists. It verifies the real Flap/V4/MSTR deployments and
///      the factory's VaultPortal-gated `newVault` path on a local fork only.
contract BROMSTRVaultRobinhoodForkTest is Test {
    address internal constant MSTR = 0xec262a75e413fAfD0dF80480274532C79D42da09;
    address internal constant VAULT_PORTAL = 0xe9F7AB7DE8FB8756acbB6a1cd13316a43308197B;
    address internal constant UNISWAP_V4_POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;
    address internal constant UNISWAP_UNIVERSAL_ROUTER = 0x8876789976dEcBfCbBbe364623C63652db8C0904;

    BROMSTRVaultBeaconFactory internal factory;

    function setUp() public {
        string memory rpcUrl = vm.envOr("ROBINHOOD_RPC_URL", string("https://rpc.mainnet.chain.robinhood.com"));
        vm.createSelectFork(rpcUrl);
        factory = new BROMSTRVaultBeaconFactory(MSTR, address(0), address(0), address(0), address(0));
    }

    function test_liveDeploymentsAndVaultPortalFactoryFlow() public {
        assertEq(block.chainid, 4663);
        assertGt(MSTR.code.length, 0, "MSTR must be deployed");
        assertGt(VAULT_PORTAL.code.length, 0, "Flap VaultPortal must be deployed");
        assertGt(UNISWAP_V4_POOL_MANAGER.code.length, 0, "Uniswap V4 PoolManager must be deployed");
        assertGt(UNISWAP_UNIVERSAL_ROUTER.code.length, 0, "Uniswap Universal Router must be deployed");

        vm.prank(VAULT_PORTAL);
        address vault = factory.newVault(address(0xB0), address(0), address(this), abi.encode(MSTR, "BRO", true));

        assertEq(BROMSTRVaultUpgradeable(payable(vault)).taxToken(), address(0xB0));
        assertEq(BROMSTRVaultUpgradeable(payable(vault)).mstrToken(), MSTR);
    }
}
