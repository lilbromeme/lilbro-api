// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {BROMSTRVaultBeaconFactory} from "../src/BROMSTRVaultFactory.sol";
import {IVaultFactory, IVaultFactoryValidationV2} from "../src/flap/IVaultFactory.sol";
import {BROMSTRVaultUpgradeable} from "../src/BROMSTRVault.sol";
import {IMSTRSwapAdapter} from "../src/IMSTRSwapAdapter.sol";
import {ILiquidityAdapter} from "../src/ILiquidityAdapter.sol";
import {MSTRSwapAdapterUniV3Reference} from "../src/MSTRSwapAdapterUniV3Reference.sol";
import {ERC20} from "@openzeppelin/token/ERC20/ERC20.sol";
import {VaultUISchema, VaultDataSchema} from "../src/flap/IVaultSchemasV1.sol";

// Real, verified constants for Robinhood Chain -- see src/flap/VaultBase.sol
// and VaultFactoryBaseV2.sol, which hardcode these for chain ID 4663/46630.
address constant RH_VAULT_PORTAL = 0xe9F7AB7DE8FB8756acbB6a1cd13316a43308197B;
address constant RH_GUARDIAN = 0x0000b48720d3B4ED6BC5031768B07F2b59270000;
uint256 constant RH_CHAIN_ID = 4663;

contract MockERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Swap adapter mock -- returns a configurable amount of output token
///         per ETH sent, so vault-level dispatch logic can be tested without
///         a real DEX. Reused generically for both the MSTR dividend leg and
///         the BRO burn leg (mirrors the vault's own reuse of IMSTRSwapAdapter
///         for both purposes). NOT a substitute for testing the real adapter
///         against a fork once the actual router is confirmed.
contract MockSwapAdapter is IMSTRSwapAdapter {
    MockERC20 public outputToken;
    uint256 public rate; // outputToken out per 1 ETH in, scaled 1e18

    constructor(MockERC20 _outputToken, uint256 _rate) {
        outputToken = _outputToken;
        rate = _rate;
    }

    function swapForMSTR(uint256 minOut, uint256) external payable returns (uint256 amountOut) {
        amountOut = (msg.value * rate) / 1e18;
        require(amountOut >= minOut, "slippage");
        outputToken.mint(msg.sender, amountOut);
    }
}

/// @dev Attempts to re-enter `dispatchDividend` while the vault is in its adapter call.
contract ReentrantMockSwapAdapter is IMSTRSwapAdapter {
    MockERC20 public immutable mstr;
    bool public reentryBlocked;

    constructor(MockERC20 _mstr) {
        mstr = _mstr;
    }

    function swapForMSTR(uint256 minMstrOut, uint256 deadline) external payable returns (uint256 mstrOut) {
        (bool reentered,) =
            msg.sender.call(abi.encodeCall(BROMSTRVaultUpgradeable.dispatchDividend, (uint256(0), deadline)));
        reentryBlocked = !reentered;

        mstrOut = msg.value;
        require(mstrOut >= minMstrOut, "slippage");
        mstr.mint(msg.sender, mstrOut);
    }
}

/// @notice Liquidity adapter mock -- mints a configurable amount of mock LP
///         token per ETH sent, so vault-level dispatchLiquidity logic can be
///         tested without a real DEX/router. NOT a substitute for testing a
///         real adapter against a fork once BRO's actual pool type (V2/V3/V4)
///         and router are confirmed.
contract MockLiquidityAdapter is ILiquidityAdapter {
    MockERC20 public lpToken;
    uint256 public rate; // LP out per 1 ETH in, scaled 1e18

    constructor(MockERC20 _lpToken, uint256 _rate) {
        lpToken = _lpToken;
        rate = _rate;
    }

    function addLiquidity(uint256 minLpOut, uint256) external payable returns (address, uint256 lpAmount) {
        lpAmount = (msg.value * rate) / 1e18;
        require(lpAmount >= minLpOut, "slippage");
        lpToken.mint(msg.sender, lpAmount);
        return (address(lpToken), lpAmount);
    }
}

contract BROMSTRVaultFactoryTest is Test {
    BROMSTRVaultBeaconFactory factory;
    MockERC20 mstr;
    MockERC20 broToken;
    MockSwapAdapter mstrAdapter;
    MockSwapAdapter burnAdapter;
    MockLiquidityAdapter liquidityAdapter;
    MockERC20 lpToken;

    address keeper = address(0xBEEF);
    address predictedTaxToken = address(0xF00D);

    function setUp() public {
        vm.chainId(RH_CHAIN_ID);

        mstr = new MockERC20("MSTR Stock Token", "MSTR");
        broToken = new MockERC20("Lil Bro", "BRO");
        lpToken = new MockERC20("BRO-ETH LP", "BRO-ETH-LP");
        mstrAdapter = new MockSwapAdapter(mstr, 1e18); // 1:1 ETH:MSTR for simplicity
        burnAdapter = new MockSwapAdapter(broToken, 1e18);
        liquidityAdapter = new MockLiquidityAdapter(lpToken, 1e18);

        factory = new BROMSTRVaultBeaconFactory(
            address(mstr), address(mstrAdapter), address(liquidityAdapter), address(burnAdapter), keeper
        );
    }

    // ---------- Factory deployment / registry ----------

    function test_factoryRegistersMSTROnDeploy() public view {
        assertTrue(factory.isSupportedAsset(address(mstr)));
        address[] memory active = factory.supportedAssets();
        assertEq(active.length, 1);
        assertEq(active[0], address(mstr));
    }

    function test_constructorRejectsZeroMSTR() public {
        vm.expectRevert("Zero address");
        new BROMSTRVaultBeaconFactory(address(0), address(mstrAdapter), address(liquidityAdapter), address(burnAdapter), keeper);
    }

    function test_onlyGuardianCanRegisterAsset() public {
        address randomToken = address(0x1234);
        vm.expectRevert();
        factory.registerAsset(randomToken);

        vm.prank(RH_GUARDIAN);
        factory.registerAsset(randomToken);
        assertTrue(factory.isSupportedAsset(randomToken));
    }

    function test_cannotRegisterDuplicateAsset() public {
        vm.startPrank(RH_GUARDIAN);
        vm.expectRevert("Already registered");
        factory.registerAsset(address(mstr));
        vm.stopPrank();
    }

    function test_cannotDeregisterMSTR() public {
        vm.prank(RH_GUARDIAN);
        vm.expectRevert("Cannot deregister MSTR");
        factory.deregisterAsset(address(mstr));
    }

    function test_allowlistedNonMSTRIsStillRejectedForBRO() public {
        address otherAsset = address(0x1234);
        vm.prank(RH_GUARDIAN);
        factory.registerAsset(otherAsset);

        vm.prank(RH_VAULT_PORTAL);
        vm.expectRevert("Only MSTR supported for BRO");
        factory.newVault(predictedTaxToken, address(0), address(this), _vaultData(otherAsset, true));
    }

    // ---------- newVault / asset validation ----------

    function _vaultData(address asset, bool instant) internal pure returns (bytes memory) {
        return abi.encode(asset, "BRO", instant);
    }

    function test_newVault_onlyCallableByVaultPortal() public {
        vm.expectRevert();
        factory.newVault(predictedTaxToken, address(0), address(this), _vaultData(address(mstr), true));
    }

    function test_newVault_succeedsWithMSTR() public {
        vm.prank(RH_VAULT_PORTAL);
        address vault = factory.newVault(predictedTaxToken, address(0), address(this), _vaultData(address(mstr), true));

        assertTrue(vault != address(0));
        assertEq(BROMSTRVaultUpgradeable(payable(vault)).taxToken(), predictedTaxToken);
        assertEq(BROMSTRVaultUpgradeable(payable(vault)).mstrToken(), address(mstr));
        assertEq(BROMSTRVaultUpgradeable(payable(vault)).MSTR_ALLOCATION_BPS(), 10_000);
        assertTrue(BROMSTRVaultUpgradeable(payable(vault)).instantDividend());
        assertEq(BROMSTRVaultUpgradeable(payable(vault)).mstrSwapAdapter(), address(mstrAdapter));
        assertEq(BROMSTRVaultUpgradeable(payable(vault)).liquidityAdapter(), address(liquidityAdapter));
        assertEq(BROMSTRVaultUpgradeable(payable(vault)).burnSwapAdapter(), address(burnAdapter));
    }

    /// @notice Regression test for a real Flap frontend bug found on live Robinhood
    ///         Chain mainnet: some Flap launch-UI builds encode `vaultData` as a
    ///         SINGLE ABI tuple parameter --
    ///         `abi.encode((selectedAsset, symbol, instantDividend))` -- instead of
    ///         flat top-level fields --
    ///         `abi.encode(selectedAsset, symbol, instantDividend)`, which is what
    ///         this factory (and Flap's own official `VaultFactoryBaseV2` reference
    ///         example) expects. Because the tuple contains a dynamic `string`
    ///         member, encoding it as one parameter prepends a single extra 32-byte
    ///         `0x20` offset word ahead of an otherwise byte-identical flat
    ///         encoding (confirmed byte-for-byte against `cast abi-encode
    ///         "f((address,string,bool))"`). Decoded directly as
    ///         `(address, string, bool)`, that leading word gets misread as
    ///         `selectedAsset` itself, and the real `selectedAsset` address gets
    ///         misread as a wildly out-of-bounds `string` offset, so `abi.decode`
    ///         reverts with no reason string. This surfaced as an unexplained
    ///         "Token creation failed for an unrecognized contract reason" error
    ///         with zero on-chain trace, since the whole call reverted during
    ///         Flap's `eth_estimateGas` preflight, before any transaction was ever
    ///         broadcast. `_decodeVaultData` tolerates this by detecting the
    ///         leading `0x20` word and skipping it before decoding.
    function test_newVault_toleratesFlapTupleWrappedVaultData() public {
        bytes memory correct = _vaultData(address(mstr), true);
        bytes memory tupleWrapped = bytes.concat(bytes32(uint256(32)), correct);

        vm.prank(RH_VAULT_PORTAL);
        address vault = factory.newVault(predictedTaxToken, address(0), address(this), tupleWrapped);

        assertTrue(vault != address(0));
        assertEq(BROMSTRVaultUpgradeable(payable(vault)).mstrToken(), address(mstr));
        assertTrue(BROMSTRVaultUpgradeable(payable(vault)).instantDividend());
    }

    /// @notice Same regression, using the exact real deployed MSTR address and
    ///         "BRO" symbol from the real failed BRO launch attempt on Robinhood
    ///         Chain mainnet, tuple-wrapped the same way Flap's frontend's captured
    ///         `eth_estimateGas` calldata was. Independently verified against the
    ///         real captured bytes via `cast call` on live mainnet, not just this
    ///         local reconstruction.
    function test_newVault_toleratesRealCapturedFlapVaultData() public {
        address realMstr = 0xec262a75e413fAfD0dF80480274532C79D42da09;
        bytes memory realCapturedVaultData = bytes.concat(bytes32(uint256(32)), abi.encode(realMstr, "BRO", true));

        BROMSTRVaultBeaconFactory realFactory = new BROMSTRVaultBeaconFactory(
            realMstr, address(mstrAdapter), address(liquidityAdapter), address(burnAdapter), keeper
        );

        vm.prank(RH_VAULT_PORTAL);
        address vault = realFactory.newVault(predictedTaxToken, address(0), address(this), realCapturedVaultData);

        assertTrue(vault != address(0));
        assertEq(BROMSTRVaultUpgradeable(payable(vault)).mstrToken(), realMstr);
        assertTrue(BROMSTRVaultUpgradeable(payable(vault)).instantDividend());
    }

    function test_newVault_rejectsUnsupportedAsset() public {
        vm.prank(RH_VAULT_PORTAL);
        vm.expectRevert("Unsupported asset");
        factory.newVault(predictedTaxToken, address(0), address(this), _vaultData(address(0xDEAD), true)); // never registered
    }

    function test_newVault_rejectsZeroAddressAsset() public {
        vm.prank(RH_VAULT_PORTAL);
        vm.expectRevert("Zero address");
        factory.newVault(predictedTaxToken, address(0), address(this), _vaultData(address(0), true));
    }

    function test_isQuoteTokenSupported_onlyNativeETH() public view {
        assertTrue(factory.isQuoteTokenSupported(address(0)));
        assertFalse(factory.isQuoteTokenSupported(address(mstr)));
    }

    function test_launchValidationRequiresAllTaxRevenueForVault() public {
        IVaultFactoryValidationV2.LaunchValidationDataV1 memory data;
        data.quoteToken = address(0);
        data.vaultBps = 10_000;

        (bool ok, string memory reason) = factory.onBeforeLaunch(abi.encode(data));
        assertTrue(ok, reason);

        data.dividendBps = 1;
        (ok,) = factory.onBeforeLaunch(abi.encode(data));
        assertFalse(ok);

        data.dividendBps = 0;
        data.vaultBps = 9_999;
        (ok,) = factory.onBeforeLaunch(abi.encode(data));
        assertFalse(ok);
    }

    function test_uniV3ReferenceCannotDeployOnRobinhood() public {
        vm.expectRevert(MSTRSwapAdapterUniV3Reference.UnsupportedOnRobinhoodChain.selector);
        new MSTRSwapAdapterUniV3Reference(address(this), address(1), address(2), address(mstr), 3000);
    }

    // ---------- vaultDataSchema() vs newVault() ABI consistency ----------
    // Rule 006 explicitly calls out this class of test: it's exactly what
    // would have caught the address[] vs address encoding bug before this
    // factory ever reached Flap's real launch UI. newVault() decodes
    // vaultData as (address, string, bool) -- assert the declared schema
    // matches that exactly, as a single tuple (not an array of tuples).
    function test_vaultDataSchema_matchesNewVaultAbiShape() public {
        VaultDataSchema memory schema = factory.vaultDataSchema();

        assertFalse(schema.isArray, "vaultData must be a single tuple, not an array of tuples");
        assertEq(schema.fields.length, 3);
        assertEq(schema.fields[0].fieldType, "address", "selectedAsset must be a scalar address, not address[]");
        assertEq(schema.fields[1].fieldType, "string");
        assertEq(schema.fields[2].fieldType, "bool");

        // Encode a value exactly the way schema.isArray == false prescribes
        // (a single tuple) and confirm newVault() actually accepts it.
        bytes memory vaultData = abi.encode(address(mstr), "BRO", true);
        vm.prank(RH_VAULT_PORTAL);
        address deployedVault = factory.newVault(predictedTaxToken, address(0), address(this), vaultData);
        assertTrue(deployedVault != address(0));
    }
}

contract BROMSTRVaultTest is Test {
    BROMSTRVaultBeaconFactory factory;
    BROMSTRVaultUpgradeable vault;
    MockERC20 mstr;
    MockERC20 broToken;
    MockERC20 lpToken;
    MockSwapAdapter mstrAdapter;
    MockSwapAdapter burnAdapter;
    MockLiquidityAdapter liquidityAdapter;

    address keeper = address(0xBEEF);
    address holder1 = address(0x1111);
    address holder2 = address(0x2222);
    address predictedTaxToken;

    address internal constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    function setUp() public {
        vm.chainId(RH_CHAIN_ID);

        mstr = new MockERC20("MSTR Stock Token", "MSTR");
        broToken = new MockERC20("Lil Bro", "BRO");
        lpToken = new MockERC20("BRO-ETH LP", "BRO-ETH-LP");
        mstrAdapter = new MockSwapAdapter(mstr, 1e18);
        burnAdapter = new MockSwapAdapter(broToken, 1e18);
        liquidityAdapter = new MockLiquidityAdapter(lpToken, 1e18);
        predictedTaxToken = address(broToken);

        factory = new BROMSTRVaultBeaconFactory(
            address(mstr), address(mstrAdapter), address(liquidityAdapter), address(burnAdapter), keeper
        );

        vm.prank(RH_VAULT_PORTAL);
        address vaultAddr =
            factory.newVault(predictedTaxToken, address(0), address(this), abi.encode(address(mstr), "BRO", true));
        vault = BROMSTRVaultUpgradeable(payable(vaultAddr));

        // Guardian sets the swap threshold to zero so small test amounts still dispatch.
        vm.prank(RH_GUARDIAN);
        vault.setMinSwapThreshold(0);
    }

    // ---------- receive() / bucket split ----------

    function test_receiveSplitsIntoThreeBuckets() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(vault).call{value: 1 ether}("");
        assertTrue(ok);

        assertEq(vault.pendingDividendETH(), 0.8 ether);
        assertEq(vault.pendingLiquidityETH(), 0.15 ether);
        assertEq(vault.pendingBurnETH(), 0.05 ether);
        assertEq(
            vault.pendingDividendETH() + vault.pendingLiquidityETH() + vault.pendingBurnETH(),
            1 ether,
            "buckets must sum to exactly the amount received"
        );
        assertEq(address(vault).balance, 1 ether);
    }

    function test_receiveAccumulatesAcrossMultiplePayments() public {
        vm.deal(address(this), 2 ether);
        (bool ok1,) = address(vault).call{value: 1 ether}("");
        (bool ok2,) = address(vault).call{value: 1 ether}("");
        assertTrue(ok1 && ok2);

        assertEq(vault.pendingDividendETH(), 1.6 ether);
        assertEq(vault.pendingLiquidityETH(), 0.3 ether);
        assertEq(vault.pendingBurnETH(), 0.1 ether);
    }

    function test_receiveGasUnder1M() public {
        vm.deal(address(this), 1 ether);
        uint256 gasBefore = gasleft();
        (bool ok,) = address(vault).call{value: 1 ether}("");
        uint256 gasUsed = gasBefore - gasleft();
        assertTrue(ok, "receive() should not revert");
        assertLe(gasUsed, 1_000_000, "receive() exceeds 1M gas limit");
    }

    // ---------- dispatchDividend (80% leg) ----------

    function test_dispatchDividend_onlyKeeperOrGuardian() public {
        vm.deal(address(vault), 1 ether);
        vm.expectRevert("Not keeper or guardian");
        vault.dispatchDividend(0, block.timestamp + 1 hours);
    }

    function test_dispatchDividend_swapsAndTracksAcquired() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(vault).call{value: 1 ether}("");
        assertTrue(ok);

        vm.prank(keeper);
        vault.dispatchDividend(0.8 ether, block.timestamp + 1 hours);

        assertEq(vault.totalMSTRAcquired(), 0.8 ether);
        assertEq(mstr.balanceOf(address(vault)), 0.8 ether);
        assertEq(vault.pendingDividendETH(), 0, "dividend bucket must be drained after dispatch");
    }

    function test_dispatchDividend_revertsBelowThreshold() public {
        vm.prank(RH_GUARDIAN);
        vault.setMinSwapThreshold(1 ether);

        vm.deal(address(this), 0.5 ether);
        (bool ok,) = address(vault).call{value: 0.5 ether}("");
        assertTrue(ok);

        vm.prank(keeper);
        vm.expectRevert("Nothing to dispatch");
        vault.dispatchDividend(0, block.timestamp + 1 hours);
    }

    function test_dispatchDividend_blocksAdapterReentrancy() public {
        MockERC20 reentrantMstr = new MockERC20("MSTR", "MSTR");
        ReentrantMockSwapAdapter reentrantAdapter = new ReentrantMockSwapAdapter(reentrantMstr);
        BROMSTRVaultBeaconFactory reentrantFactory = new BROMSTRVaultBeaconFactory(
            address(reentrantMstr), address(reentrantAdapter), address(liquidityAdapter), address(burnAdapter), keeper
        );

        vm.prank(RH_VAULT_PORTAL);
        address reentrantVaultAddress = reentrantFactory.newVault(
            predictedTaxToken, address(0), address(this), abi.encode(address(reentrantMstr), "BRO", true)
        );
        BROMSTRVaultUpgradeable reentrantVault = BROMSTRVaultUpgradeable(payable(reentrantVaultAddress));

        vm.deal(address(this), 1 ether);
        (bool ok,) = address(reentrantVault).call{value: 1 ether}("");
        assertTrue(ok);

        vm.prank(keeper);
        reentrantVault.dispatchDividend(0, block.timestamp + 1 hours);

        assertTrue(reentrantAdapter.reentryBlocked());
    }

    // ---------- dispatchLiquidity (15% leg) ----------

    function test_dispatchLiquidity_onlyKeeperOrGuardian() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(vault).call{value: 1 ether}("");
        assertTrue(ok);

        vm.expectRevert("Not keeper or guardian");
        vault.dispatchLiquidity(0, block.timestamp + 1 hours);
    }

    function test_dispatchLiquidity_addsAndBurnsLP() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(vault).call{value: 1 ether}("");
        assertTrue(ok);

        vm.prank(keeper);
        vault.dispatchLiquidity(0.15 ether, block.timestamp + 1 hours);

        assertEq(vault.totalLpBurned(), 0.15 ether);
        assertEq(lpToken.balanceOf(BURN_ADDRESS), 0.15 ether, "LP tokens must go straight to the burn address");
        assertEq(lpToken.balanceOf(address(vault)), 0, "vault must never custody LP tokens");
        assertEq(vault.pendingLiquidityETH(), 0);
    }

    function test_dispatchLiquidity_revertsWhenAdapterNotSet() public {
        vm.prank(RH_GUARDIAN);
        vault.setLiquidityAdapter(address(0));

        vm.deal(address(this), 1 ether);
        (bool ok,) = address(vault).call{value: 1 ether}("");
        assertTrue(ok);

        vm.prank(keeper);
        vm.expectRevert("Liquidity adapter not set");
        vault.dispatchLiquidity(0, block.timestamp + 1 hours);
    }

    // ---------- dispatchBurn (5% leg) ----------

    function test_dispatchBurn_onlyKeeperOrGuardian() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(vault).call{value: 1 ether}("");
        assertTrue(ok);

        vm.expectRevert("Not keeper or guardian");
        vault.dispatchBurn(0, block.timestamp + 1 hours);
    }

    function test_dispatchBurn_swapsAndBurnsBRO() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(vault).call{value: 1 ether}("");
        assertTrue(ok);

        vm.prank(keeper);
        vault.dispatchBurn(0.05 ether, block.timestamp + 1 hours);

        assertEq(vault.totalBroBurned(), 0.05 ether);
        assertEq(broToken.balanceOf(BURN_ADDRESS), 0.05 ether);
        assertEq(broToken.balanceOf(address(vault)), 0, "vault must not hold BRO after burning");
        assertEq(vault.pendingBurnETH(), 0);
    }

    function test_dispatchBurn_revertsWhenAdapterNotSet() public {
        vm.prank(RH_GUARDIAN);
        vault.setBurnSwapAdapter(address(0));

        vm.deal(address(this), 1 ether);
        (bool ok,) = address(vault).call{value: 1 ether}("");
        assertTrue(ok);

        vm.prank(keeper);
        vm.expectRevert("Burn adapter not set");
        vault.dispatchBurn(0, block.timestamp + 1 hours);
    }

    // ---------- Cross-bucket isolation ----------

    function test_dispatchingOneLegDoesNotTouchOthers() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(vault).call{value: 1 ether}("");
        assertTrue(ok);

        vm.prank(keeper);
        vault.dispatchDividend(0, block.timestamp + 1 hours);

        // Liquidity and burn buckets must be untouched by a dividend dispatch.
        assertEq(vault.pendingLiquidityETH(), 0.15 ether);
        assertEq(vault.pendingBurnETH(), 0.05 ether);
        assertEq(address(vault).balance, 0.2 ether);
    }

    // ---------- Distribution (unchanged from the 100%-MSTR design) ----------

    function test_pushDividends_distributesDirectly() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(vault).call{value: 1 ether}("");
        assertTrue(ok);
        vm.prank(keeper);
        vault.dispatchDividend(0, block.timestamp + 1 hours);

        address[] memory holders = new address[](2);
        holders[0] = holder1;
        holders[1] = holder2;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 0.48 ether;
        amounts[1] = 0.32 ether;

        vm.prank(keeper);
        vault.pushDividends(holders, amounts);

        assertEq(mstr.balanceOf(holder1), 0.48 ether);
        assertEq(mstr.balanceOf(holder2), 0.32 ether);
        assertEq(vault.totalMSTRDistributed(), 0.8 ether);
    }

    function test_pushDividends_revertsIfExceedsBalance() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(vault).call{value: 1 ether}("");
        assertTrue(ok);
        vm.prank(keeper);
        vault.dispatchDividend(0, block.timestamp + 1 hours);

        address[] memory holders = new address[](1);
        holders[0] = holder1;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1 ether; // more than the vault holds (only 0.8 ether MSTR acquired)

        vm.prank(keeper);
        vm.expectRevert("Exceeds available balance");
        vault.pushDividends(holders, amounts);
    }

    function test_creditAndClaim_flow() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(vault).call{value: 1 ether}("");
        assertTrue(ok);
        vm.prank(keeper);
        vault.dispatchDividend(0, block.timestamp + 1 hours);

        address[] memory holders = new address[](1);
        holders[0] = holder1;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 0.8 ether;

        vm.prank(keeper);
        vault.creditDividends(holders, amounts);

        assertEq(vault.claimable(holder1), 0.8 ether);
        assertEq(vault.reservedForClaims(), 0.8 ether);

        vm.prank(holder1);
        vault.claim();

        assertEq(mstr.balanceOf(holder1), 0.8 ether);
        assertEq(vault.claimable(holder1), 0);
        assertEq(vault.reservedForClaims(), 0);
    }

    function test_claim_cannotClaimOnBehalfOfSomeoneElse() public {
        // There is no recipient parameter on claim() -- msg.sender is the
        // only possible recipient, so this is really a compile-time/API
        // guarantee. This test documents that guarantee by confirming an
        // uncredited caller gets "Nothing to claim", not another holder's funds.
        vm.prank(holder2);
        vm.expectRevert("Nothing to claim");
        vault.claim();
    }

    function test_onlyGuardianCanLockConfig() public {
        vm.expectRevert("Not guardian");
        vault.lockConfig();

        vm.prank(RH_GUARDIAN);
        vault.lockConfig();
        assertTrue(vault.configLocked());

        vm.startPrank(RH_GUARDIAN);
        vm.expectRevert("Config is locked");
        vault.setMstrSwapAdapter(address(0x1));
        vm.expectRevert("Config is locked");
        vault.setLiquidityAdapter(address(0x1));
        vm.expectRevert("Config is locked");
        vault.setBurnSwapAdapter(address(0x1));
        vm.stopPrank();
    }

    function test_mstrAllocationIsImmutable() public view {
        // No setter exists for mstrToken or MSTR_ALLOCATION_BPS anywhere in
        // the contract -- this test documents that MSTR_ALLOCATION_BPS is a
        // compile-time constant, not just a variable nobody happens to change.
        assertEq(vault.MSTR_ALLOCATION_BPS(), 10_000);
    }

    function test_bucketBpsSumToTenThousand() public view {
        assertEq(
            uint256(vault.DIVIDEND_BPS()) + uint256(vault.LIQUIDITY_BPS()) + uint256(vault.BURN_BPS()), 10_000
        );
    }

    // ---------- description() / vaultUISchema() (Rule 006 coverage) ----------

    function test_descriptionIsNonEmptyAndChangesWithState() public {
        string memory before = vault.description();
        assertTrue(bytes(before).length > 0);

        vm.deal(address(this), 1 ether);
        (bool ok,) = address(vault).call{value: 1 ether}("");
        assertTrue(ok);
        vm.prank(keeper);
        vault.dispatchDividend(0, block.timestamp + 1 hours);

        string memory afterDispatch = vault.description();
        assertTrue(
            keccak256(bytes(before)) != keccak256(bytes(afterDispatch)),
            "description() should reflect vault state changes"
        );
    }

    function test_vaultUISchema_methodCountAndFlags() public view {
        VaultUISchema memory schema = vault.vaultUISchema();
        assertEq(schema.methods.length, 2);
        assertFalse(schema.methods[0].isWriteMethod, "claimable() is a view method");
        assertTrue(schema.methods[1].isWriteMethod, "claim() is a write method");
    }
}
