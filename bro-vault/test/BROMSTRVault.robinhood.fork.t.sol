// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {BROMSTRVaultBeaconFactory} from "../src/BROMSTRVaultFactory.sol";
import {BROMSTRVaultUpgradeable} from "../src/BROMSTRVault.sol";
import {MSTRSwapAdapterRobinhoodV3} from "../src/MSTRSwapAdapterRobinhoodV3.sol";
import {BROBurnSwapAdapterRobinhoodV2} from "../src/BROBurnSwapAdapterRobinhoodV2.sol";
import {BROLiquidityAdapterRobinhoodV2} from "../src/BROLiquidityAdapterRobinhoodV2.sol";
import {IERC20} from "@openzeppelin/token/ERC20/IERC20.sol";

address constant RH_VAULT_PORTAL = 0xe9F7AB7DE8FB8756acbB6a1cd13316a43308197B;
address constant RH_GUARDIAN = 0x0000b48720d3B4ED6BC5031768B07F2b59270000;

/// @notice Live Robinhood Chain mainnet-fork coverage: proves all three
///         dispatch legs actually execute against real, verified, deployed
///         contracts and real liquidity -- not mocks.
///
/// @dev THE DIVIDEND LEG (MSTR) is tested for real: MSTR exists today with a
///      real, live, liquid WETH/MSTR V3 pool (verified directly on-chain --
///      see MSTRSwapAdapterRobinhoodV3.sol), so `test_dispatchDividend_realSwapOnMainnetFork`
///      swaps real ETH for real MSTR through the real Universal Router.
///
///      THE LIQUIDITY AND BURN LEGS use USDG (Robinhood Chain's own core
///      token, 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168) as a stand-in for
///      BRO, because BRO does not exist yet -- it is only created when
///      someone actually launches it on Flap, and BRO's own WETH/BRO V2 pair
///      does not exist until Flap's migrator creates it at that point. USDG
///      already has a real, live, liquid WETH/USDG V2 pair on the same real
///      V2 Factory + Universal Router that BRO's own pair will use, so these
///      tests prove the exact liquidity-add and buy-and-burn MECHANISM works
///      correctly against Robinhood's real infrastructure. They do NOT prove
///      BRO's specific future pool behaves identically -- that can only be
///      confirmed after BRO launches and its real pair is independently
///      checked to exist and hold liquidity, at which point
///      BROLiquidityAdapterRobinhoodV2 / BROBurnSwapAdapterRobinhoodV2 must
///      be redeployed with BRO's real address before Guardian wires them in.
contract BROMSTRVaultRobinhoodForkTest is Test {
    address internal constant MSTR = 0xec262a75e413fAfD0dF80480274532C79D42da09;
    address internal constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address internal constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168; // stand-in for BRO -- see contract NatSpec
    address internal constant UNISWAP_V2_FACTORY = 0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f;
    address internal constant MSTR_WETH_V3_POOL = 0x70504a6FafdbfB75fE971FAA4dD716e79aC5624c;
    uint24 internal constant MSTR_V3_FEE = 10_000;
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
        assertGt(RH_VAULT_PORTAL.code.length, 0, "Flap VaultPortal must be deployed");
        assertGt(UNISWAP_V4_POOL_MANAGER.code.length, 0, "Uniswap V4 PoolManager must be deployed");
        assertGt(UNISWAP_UNIVERSAL_ROUTER.code.length, 0, "Uniswap Universal Router must be deployed");
        assertGt(UNISWAP_V2_FACTORY.code.length, 0, "Uniswap V2 Factory must be deployed");
        assertGt(MSTR_WETH_V3_POOL.code.length, 0, "WETH/MSTR V3 pool must be deployed");

        vm.prank(RH_VAULT_PORTAL);
        address vault = factory.newVault(address(0xB0), address(0), address(this), abi.encode(MSTR, "BRO", true));

        assertEq(BROMSTRVaultUpgradeable(payable(vault)).taxToken(), address(0xB0));
        assertEq(BROMSTRVaultUpgradeable(payable(vault)).mstrToken(), MSTR);
    }

    /// @notice Real swap: real ETH -> real MSTR through the real, live
    ///         WETH/MSTR V3 pool, via the real (modified) Universal Router.
    function test_dispatchDividend_realSwapOnMainnetFork() public {
        vm.prank(RH_VAULT_PORTAL);
        address vaultAddr = factory.newVault(address(0xB0), address(0), address(this), abi.encode(MSTR, "BRO", true));
        BROMSTRVaultUpgradeable vault = BROMSTRVaultUpgradeable(payable(vaultAddr));

        MSTRSwapAdapterRobinhoodV3 adapter =
            new MSTRSwapAdapterRobinhoodV3(vaultAddr, UNISWAP_UNIVERSAL_ROUTER, WETH, MSTR, MSTR_V3_FEE);

        vm.startPrank(RH_GUARDIAN);
        vault.setMstrSwapAdapter(address(adapter));
        vault.setMinSwapThreshold(0);
        vm.stopPrank();

        vm.deal(address(this), 1 ether);
        (bool ok,) = vaultAddr.call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(vault.pendingDividendETH(), 0.8 ether);

        vm.prank(RH_GUARDIAN);
        vault.dispatchDividend(1, block.timestamp + 1 hours); // minMstrOut=1: any nonzero real output proves the route works

        uint256 mstrReceived = IERC20(MSTR).balanceOf(vaultAddr);
        assertGt(mstrReceived, 0, "real MSTR must have been received from the real pool");
        assertEq(vault.totalMSTRAcquired(), mstrReceived);
        assertEq(vault.pendingDividendETH(), 0, "dividend bucket must be drained");
    }

    /// @notice Real V2 swap-and-burn mechanism, proven against USDG's real
    ///         pair as a stand-in for BRO -- see contract NatSpec.
    function test_dispatchBurn_realV2SwapOnMainnetFork_usingStandInToken() public {
        vm.prank(RH_VAULT_PORTAL);
        address vaultAddr = factory.newVault(USDG, address(0), address(this), abi.encode(MSTR, "BRO", true));
        BROMSTRVaultUpgradeable vault = BROMSTRVaultUpgradeable(payable(vaultAddr));

        BROBurnSwapAdapterRobinhoodV2 adapter =
            new BROBurnSwapAdapterRobinhoodV2(vaultAddr, UNISWAP_UNIVERSAL_ROUTER, WETH, USDG);

        vm.startPrank(RH_GUARDIAN);
        vault.setBurnSwapAdapter(address(adapter));
        vault.setMinSwapThreshold(0);
        vm.stopPrank();

        address deadAddress = vault.BURN_ADDRESS();
        // The dead address already holds real USDG from unrelated real-world
        // burns predating this fork snapshot -- measure the delta this test
        // itself caused, not the absolute post-state balance.
        uint256 deadBalanceBefore = IERC20(USDG).balanceOf(deadAddress);

        vm.deal(address(this), 1 ether);
        (bool ok,) = vaultAddr.call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(vault.pendingBurnETH(), 0.05 ether);

        vm.prank(RH_GUARDIAN);
        vault.dispatchBurn(1, block.timestamp + 1 hours);

        uint256 usdgBurned = IERC20(USDG).balanceOf(deadAddress) - deadBalanceBefore;
        assertGt(usdgBurned, 0, "real stand-in token must have been bought and burned");
        assertEq(vault.totalBroBurned(), usdgBurned);
        assertEq(IERC20(USDG).balanceOf(vaultAddr), 0, "vault must not hold the token after burning");
        assertEq(vault.pendingBurnETH(), 0);
    }

    /// @notice Real V2 add-liquidity mechanism (swap half, mint LP against
    ///         the real pair), proven against USDG's real pair as a
    ///         stand-in for BRO -- see contract NatSpec.
    function test_dispatchLiquidity_realV2AddLiquidityOnMainnetFork_usingStandInToken() public {
        vm.prank(RH_VAULT_PORTAL);
        address vaultAddr = factory.newVault(USDG, address(0), address(this), abi.encode(MSTR, "BRO", true));
        BROMSTRVaultUpgradeable vault = BROMSTRVaultUpgradeable(payable(vaultAddr));

        BROLiquidityAdapterRobinhoodV2 adapter =
            new BROLiquidityAdapterRobinhoodV2(vaultAddr, UNISWAP_UNIVERSAL_ROUTER, UNISWAP_V2_FACTORY, WETH, USDG);

        vm.startPrank(RH_GUARDIAN);
        vault.setLiquidityAdapter(address(adapter));
        vault.setMinSwapThreshold(0);
        vm.stopPrank();

        address deadAddress = vault.BURN_ADDRESS();
        address pair = _v2Pair(WETH, USDG);
        // Same rationale as the burn test above: measure the delta this
        // test itself caused, not an absolute post-state balance.
        uint256 deadLpBefore = IERC20(pair).balanceOf(deadAddress);

        vm.deal(address(this), 1 ether);
        (bool ok,) = vaultAddr.call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(vault.pendingLiquidityETH(), 0.15 ether);

        vm.prank(RH_GUARDIAN);
        vault.dispatchLiquidity(1, block.timestamp + 1 hours);

        uint256 lpBurned = IERC20(pair).balanceOf(deadAddress) - deadLpBefore;
        assertGt(lpBurned, 0, "real LP tokens must have been minted and sent to the burn address");
        assertEq(vault.totalLpBurned(), lpBurned);
        assertEq(vault.pendingLiquidityETH(), 0);
    }

    function _v2Pair(address a, address b) internal view returns (address pair) {
        (bool ok, bytes memory data) =
            UNISWAP_V2_FACTORY.staticcall(abi.encodeWithSignature("getPair(address,address)", a, b));
        require(ok, "getPair call failed");
        pair = abi.decode(data, (address));
    }
}
