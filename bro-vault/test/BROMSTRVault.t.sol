// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {BROMSTRVaultBeaconFactory} from "../src/BROMSTRVaultFactory.sol";
import {IVaultFactory, IVaultFactoryValidationV2} from "../src/flap/IVaultFactory.sol";
import {BROMSTRVaultUpgradeable} from "../src/BROMSTRVault.sol";
import {IMSTRSwapAdapter} from "../src/IMSTRSwapAdapter.sol";
import {MSTRSwapAdapterUniV3Reference} from "../src/MSTRSwapAdapterUniV3Reference.sol";
import {ERC20} from "@openzeppelin/token/ERC20/ERC20.sol";

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

/// @notice Swap adapter mock -- returns a configurable amount of MSTR per
///         ETH sent, so vault-level dispatch logic can be tested without a
///         real DEX. NOT a substitute for testing the real adapter against
///         a fork once the actual router is confirmed.
contract MockSwapAdapter is IMSTRSwapAdapter {
    MockERC20 public mstr;
    uint256 public rate; // MSTR out per 1 ETH in, scaled 1e18

    constructor(MockERC20 _mstr, uint256 _rate) {
        mstr = _mstr;
        rate = _rate;
    }

    function swapForMSTR(uint256 minMstrOut, uint256) external payable returns (uint256 mstrOut) {
        mstrOut = (msg.value * rate) / 1e18;
        require(mstrOut >= minMstrOut, "slippage");
        mstr.mint(msg.sender, mstrOut);
    }
}

/// @dev Attempts to re-enter `dispatch` while the vault is in its adapter call.
contract ReentrantMockSwapAdapter is IMSTRSwapAdapter {
    MockERC20 public immutable mstr;
    bool public reentryBlocked;

    constructor(MockERC20 _mstr) {
        mstr = _mstr;
    }

    function swapForMSTR(uint256 minMstrOut, uint256 deadline) external payable returns (uint256 mstrOut) {
        (bool reentered,) = msg.sender.call(
            abi.encodeCall(BROMSTRVaultUpgradeable.dispatch, (uint256(0), deadline))
        );
        reentryBlocked = !reentered;

        mstrOut = msg.value;
        require(mstrOut >= minMstrOut, "slippage");
        mstr.mint(msg.sender, mstrOut);
    }
}

contract BROMSTRVaultFactoryTest is Test {
    BROMSTRVaultBeaconFactory factory;
    MockERC20 mstr;
    MockERC20 broToken;
    MockSwapAdapter adapter;

    address keeper = address(0xBEEF);
    address predictedTaxToken = address(0xF00D);

    function setUp() public {
        vm.chainId(RH_CHAIN_ID);

        mstr = new MockERC20("MSTR Stock Token", "MSTR");
        broToken = new MockERC20("Lil Bro", "BRO");
        adapter = new MockSwapAdapter(mstr, 1e18); // 1:1 ETH:MSTR for simplicity

        factory = new BROMSTRVaultBeaconFactory(address(mstr), address(adapter), keeper);
    }

    // ---------- Factory deployment / registry ----------

    function test_factoryRegistersMSTROnDeploy() public view {
        assertTrue(factory.isSupportedAsset(address(mstr)));
        address[] memory active = factory.supportedAssets();
        assertEq(active.length, 1);
        assertEq(active[0], address(mstr));
    }

    function test_constructorRejectsZeroMSTR() public {
        vm.expectRevert(IVaultFactory.ZeroAddress.selector);
        new BROMSTRVaultBeaconFactory(address(0), address(adapter), keeper);
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
        vm.expectRevert(BROMSTRVaultBeaconFactory.AlreadyRegistered.selector);
        factory.registerAsset(address(mstr));
        vm.stopPrank();
    }

    function test_cannotDeregisterMSTR() public {
        vm.prank(RH_GUARDIAN);
        vm.expectRevert(BROMSTRVaultBeaconFactory.CannotDeregisterMSTR.selector);
        factory.deregisterAsset(address(mstr));
    }

    function test_allowlistedNonMSTRIsStillRejectedForBRO() public {
        address otherAsset = address(0x1234);
        vm.prank(RH_GUARDIAN);
        factory.registerAsset(otherAsset);

        vm.prank(RH_VAULT_PORTAL);
        vm.expectRevert(BROMSTRVaultBeaconFactory.OnlyMSTRSupportedForBRO.selector);
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
    }

    function test_newVault_rejectsUnsupportedAsset() public {
        vm.prank(RH_VAULT_PORTAL);
        vm.expectRevert(abi.encodeWithSelector(BROMSTRVaultBeaconFactory.UnsupportedAsset.selector, address(0xDEAD)));
        factory.newVault(predictedTaxToken, address(0), address(this), _vaultData(address(0xDEAD), true)); // never registered
    }

    function test_newVault_rejectsZeroAddressAsset() public {
        vm.prank(RH_VAULT_PORTAL);
        vm.expectRevert(IVaultFactory.ZeroAddress.selector);
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

    // ---------- Vault upgrade management ----------

    function test_onlyGuardianCanUpgrade() public {
        vm.expectRevert("Only Guardian");
        factory.upgradeVaultImplementation(address(0x1));
    }

    function test_lockVaultUpgrades_isIrreversible() public {
        vm.startPrank(RH_GUARDIAN);
        assertFalse(factory.isVaultUpgradesLocked());
        factory.lockVaultUpgrades();
        assertTrue(factory.isVaultUpgradesLocked());

        // After renouncing beacon ownership, the Guardian check on this
        // wrapper still passes (msg.sender IS the Guardian) -- the revert
        // now correctly comes from the beacon's own Ownable check instead,
        // since UpgradeableBeacon.owner() is now address(0).
        vm.expectRevert("Ownable: caller is not the owner");
        factory.upgradeVaultImplementation(address(0x1));
        vm.stopPrank();
    }
}

contract BROMSTRVaultTest is Test {
    BROMSTRVaultBeaconFactory factory;
    BROMSTRVaultUpgradeable vault;
    MockERC20 mstr;
    MockERC20 broToken;
    MockSwapAdapter adapter;

    address keeper = address(0xBEEF);
    address holder1 = address(0x1111);
    address holder2 = address(0x2222);
    address predictedTaxToken;

    function setUp() public {
        vm.chainId(RH_CHAIN_ID);

        mstr = new MockERC20("MSTR Stock Token", "MSTR");
        broToken = new MockERC20("Lil Bro", "BRO");
        adapter = new MockSwapAdapter(mstr, 1e18);
        predictedTaxToken = address(broToken);

        factory = new BROMSTRVaultBeaconFactory(address(mstr), address(adapter), keeper);

        vm.prank(RH_VAULT_PORTAL);
        address vaultAddr =
            factory.newVault(predictedTaxToken, address(0), address(this), abi.encode(address(mstr), "BRO", true));
        vault = BROMSTRVaultUpgradeable(payable(vaultAddr));

        // Guardian raises the swap threshold to something realistic for these tests.
        vm.prank(RH_GUARDIAN);
        vault.setMinSwapThreshold(0);
    }

    function test_receiveAccumulatesETH() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(vault).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(address(vault).balance, 1 ether);
    }

    function test_dispatch_onlyKeeperOrGuardian() public {
        vm.deal(address(vault), 1 ether);
        vm.expectRevert(BROMSTRVaultUpgradeable.NotKeeperOrGuardian.selector);
        vault.dispatch(0, block.timestamp + 1 hours);
    }

    function test_dispatch_swapsAndTracksAcquired() public {
        vm.deal(address(vault), 1 ether);

        vm.prank(keeper);
        vault.dispatch(1 ether, block.timestamp + 1 hours);

        assertEq(vault.totalMSTRAcquired(), 1 ether);
        assertEq(mstr.balanceOf(address(vault)), 1 ether);
    }

    function test_dispatch_revertsBelowThreshold() public {
        vm.prank(RH_GUARDIAN);
        vault.setMinSwapThreshold(1 ether);

        vm.deal(address(vault), 0.5 ether);
        vm.prank(keeper);
        vm.expectRevert(BROMSTRVaultUpgradeable.NothingToDispatch.selector);
        vault.dispatch(0, block.timestamp + 1 hours);
    }

    function test_dispatch_blocksAdapterReentrancy() public {
        MockERC20 reentrantMstr = new MockERC20("MSTR", "MSTR");
        ReentrantMockSwapAdapter reentrantAdapter = new ReentrantMockSwapAdapter(reentrantMstr);
        BROMSTRVaultBeaconFactory reentrantFactory =
            new BROMSTRVaultBeaconFactory(address(reentrantMstr), address(reentrantAdapter), keeper);

        vm.prank(RH_VAULT_PORTAL);
        address reentrantVaultAddress = reentrantFactory.newVault(
            predictedTaxToken, address(0), address(this), abi.encode(address(reentrantMstr), "BRO", true)
        );
        BROMSTRVaultUpgradeable reentrantVault = BROMSTRVaultUpgradeable(payable(reentrantVaultAddress));

        vm.deal(reentrantVaultAddress, 1 ether);
        vm.prank(keeper);
        reentrantVault.dispatch(0, block.timestamp + 1 hours);

        assertTrue(reentrantAdapter.reentryBlocked());
        assertEq(reentrantMstr.balanceOf(reentrantVaultAddress), 1 ether);
    }

    function test_pushDividends_distributesDirectly() public {
        vm.deal(address(vault), 1 ether);
        vm.prank(keeper);
        vault.dispatch(0, block.timestamp + 1 hours);

        address[] memory holders = new address[](2);
        holders[0] = holder1;
        holders[1] = holder2;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 0.6 ether;
        amounts[1] = 0.4 ether;

        vm.prank(keeper);
        vault.pushDividends(holders, amounts);

        assertEq(mstr.balanceOf(holder1), 0.6 ether);
        assertEq(mstr.balanceOf(holder2), 0.4 ether);
        assertEq(vault.totalMSTRDistributed(), 1 ether);
    }

    function test_pushDividends_revertsIfExceedsBalance() public {
        vm.deal(address(vault), 1 ether);
        vm.prank(keeper);
        vault.dispatch(0, block.timestamp + 1 hours);

        address[] memory holders = new address[](1);
        holders[0] = holder1;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 2 ether; // more than the vault holds

        vm.prank(keeper);
        vm.expectRevert(BROMSTRVaultUpgradeable.ExceedsAvailableBalance.selector);
        vault.pushDividends(holders, amounts);
    }

    function test_creditAndClaim_flow() public {
        vm.deal(address(vault), 1 ether);
        vm.prank(keeper);
        vault.dispatch(0, block.timestamp + 1 hours);

        address[] memory holders = new address[](1);
        holders[0] = holder1;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1 ether;

        vm.prank(keeper);
        vault.creditDividends(holders, amounts);

        assertEq(vault.claimable(holder1), 1 ether);
        assertEq(vault.reservedForClaims(), 1 ether);

        vm.prank(holder1);
        vault.claim();

        assertEq(mstr.balanceOf(holder1), 1 ether);
        assertEq(vault.claimable(holder1), 0);
        assertEq(vault.reservedForClaims(), 0);
    }

    function test_claim_cannotClaimOnBehalfOfSomeoneElse() public {
        // There is no recipient parameter on claim() -- msg.sender is the
        // only possible recipient, so this is really a compile-time/API
        // guarantee. This test documents that guarantee by confirming an
        // uncredited caller gets NothingToClaim, not another holder's funds.
        vm.prank(holder2);
        vm.expectRevert(BROMSTRVaultUpgradeable.NothingToClaim.selector);
        vault.claim();
    }

    function test_onlyGuardianCanLockConfig() public {
        vm.expectRevert(BROMSTRVaultUpgradeable.NotGuardian.selector);
        vault.lockConfig();

        vm.prank(RH_GUARDIAN);
        vault.lockConfig();
        assertTrue(vault.configLocked());

        vm.prank(RH_GUARDIAN);
        vm.expectRevert(BROMSTRVaultUpgradeable.ConfigIsLocked.selector);
        vault.setSwapAdapter(address(0x1));
    }

    function test_mstrAllocationIsImmutable() public view {
        // No setter exists for mstrToken or MSTR_ALLOCATION_BPS anywhere in
        // the contract -- this test documents that MSTR_ALLOCATION_BPS is a
        // compile-time constant, not just a variable nobody happens to change.
        assertEq(vault.MSTR_ALLOCATION_BPS(), 10_000);
    }
}
