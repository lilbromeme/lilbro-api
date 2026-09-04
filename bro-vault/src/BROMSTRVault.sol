// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {VaultBaseV2} from "./flap/VaultBaseV2.sol";
import {
    VaultUISchema,
    VaultMethodSchema,
    FieldDescriptor,
    ApproveAction
} from "./flap/IVaultSchemasV1.sol";
import {Initializable} from "@openzeppelin-contracts-upgradeable/proxy/utils/Initializable.sol";
import {ReentrancyGuardUpgradeable} from
    "@openzeppelin-contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {IERC20} from "@openzeppelin/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/token/ERC20/utils/SafeERC20.sol";
import {IMSTRSwapAdapter} from "./IMSTRSwapAdapter.sol";

/// @title BROMSTRVaultUpgradeable
/// @notice Custom Flap vault for $BRO: receives trading-tax revenue in ETH,
///         swaps it for MSTR through a pluggable adapter, and distributes
///         the MSTR to eligible $BRO holders.
///
/// @dev DISTRIBUTION DESIGN — READ BEFORE DEPLOYING
///
///      A vault cannot enumerate $BRO's holder list on-chain, and this
///      contract does not control the $BRO token contract (it's launched
///      through Flap's standard token factory), so it cannot hook into
///      $BRO transfers to maintain a live accumulator the way a custom
///      dividend-paying token would. Instead:
///
///      1. `dispatch()` swaps accumulated ETH for MSTR. Guardian/keeper only.
///      2. A keeper (off-chain, reading indexed $BRO holder balances —
///         e.g. from Blockscout or a subgraph) computes each eligible
///         holder's proportional share of the newly acquired MSTR and
///         calls `pushDividends(holders, amounts)`. This is the "instant
///         dividend" path: holders receive MSTR directly, no claim needed.
///      3. If `instantDividend` is false, or a push fails/is skipped for
///         specific addresses, `creditDividends(holders, amounts)` credits
///         a claimable balance instead, and holders call `claim()`
///         themselves — the manual fallback.
///
///      The contract enforces that pushed/credited amounts never exceed
///      the vault's actual MSTR balance, so a misbehaving or compromised
///      keeper cannot mint claims out of thin air — it can at most fail to
///      distribute correctly, not steal funds, since every transfer is a
///      real SafeERC20 transfer of MSTR the vault actually holds.
///
///      Selected asset (MSTR) and its 100% allocation are fixed at
///      `initialize()` and cannot be changed afterward — see
///      `MSTR_ALLOCATION_BPS` and the absence of any setter for `mstrToken`.
contract BROMSTRVaultUpgradeable is Initializable, VaultBaseV2, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    // ========== ERRORS ==========
    error NotGuardian();
    error NotKeeperOrGuardian();
    error ZeroAddress();
    error SwapAdapterNotSet();
    error DeadlinePassed();
    error InsufficientOutput();
    error ArrayLengthMismatch();
    error ConfigIsLocked();
    error NothingToDispatch();
    error NothingToClaim();
    error ExceedsAvailableBalance();

    // ========== IMMUTABLE-AFTER-INIT CONFIG ==========
    /// @notice The $BRO tax token this vault backs. Set once, never changed.
    address public taxToken;
    /// @notice The ONLY supported reward asset. Set once, never changed —
    ///         there is no setter for this field anywhere in the contract.
    address public mstrToken;
    /// @notice Always 10_000 (100%) — BRO's vault is single-asset by design.
    /// @dev    Kept as an explicit constant (not a variable) so it is
    ///         provably immutable, not just unset by convention.
    uint16 public constant MSTR_ALLOCATION_BPS = 10_000;
    /// @notice Whether the intended UX is instant push (true) or
    ///         claim-based (false). Informational for the UI; does not
    ///         gate which functions the Guardian/keeper may call.
    bool public instantDividend;

    // ========== GUARDIAN-GATED CONFIG (can be locked permanently) ==========
    address public swapAdapter;
    address public keeper;
    uint256 public minSwapThresholdWei;
    bool public configLocked;

    // ========== DIVIDEND STATE ==========
    /// @notice MSTR credited to a holder that hasn't been claimed yet.
    mapping(address => uint256) public claimable;
    /// @notice Running total of MSTR ever pushed or credited, for transparency.
    uint256 public totalMSTRDistributed;
    /// @notice Running total of MSTR ever acquired via dispatch(), for transparency.
    uint256 public totalMSTRAcquired;
    /// @notice MSTR currently reserved by outstanding `claimable` balances —
    ///         tracked separately so `pushDividends`/`creditDividends` can't
    ///         double-allocate MSTR that's already promised to a claimer.
    uint256 public reservedForClaims;

    // ========== EVENTS ==========
    event Initialized(address indexed taxToken, address indexed mstrToken, bool instantDividend);
    event Dispatched(uint256 ethIn, uint256 mstrOut);
    event DividendsPushed(uint256 holderCount, uint256 totalAmount);
    event DividendsCredited(uint256 holderCount, uint256 totalAmount);
    event DividendClaimed(address indexed holder, uint256 amount);
    event SwapAdapterUpdated(address indexed newAdapter);
    event KeeperUpdated(address indexed newKeeper);
    event MinSwapThresholdUpdated(uint256 newThreshold);
    event ConfigLocked();

    /// @dev Disables initializers on the implementation contract itself so
    ///      it can never be initialized directly — only BeaconProxy
    ///      instances created by the factory can be.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @param _taxToken           The $BRO token address (predicted by VaultPortal
    ///                            at the time this is called — see IVaultFactory.newVault).
    /// @param _mstrToken          MSTR Stock Token address. VERIFY THIS INDEPENDENTLY
    ///                            before deployment — see README.
    /// @param _swapAdapter        Address implementing IMSTRSwapAdapter. Can be
    ///                            address(0) at launch and set later by Guardian,
    ///                            but dispatch() will revert until it's set.
    /// @param _keeper             Off-chain automation address authorized alongside
    ///                            Guardian to call dispatch/push/credit.
    /// @param _instantDividend    UI/UX flag — see contract-level docs.
    /// @param _minSwapThresholdWei Minimum accumulated ETH before dispatch() will swap
    ///                            (avoids burning gas on dust amounts).
    function initialize(
        address _taxToken,
        address _mstrToken,
        address _swapAdapter,
        address _keeper,
        bool _instantDividend,
        uint256 _minSwapThresholdWei
    ) external initializer {
        __ReentrancyGuard_init();
        if (_taxToken == address(0) || _mstrToken == address(0)) revert ZeroAddress();

        taxToken = _taxToken;
        mstrToken = _mstrToken;
        swapAdapter = _swapAdapter;
        keeper = _keeper;
        instantDividend = _instantDividend;
        minSwapThresholdWei = _minSwapThresholdWei;

        emit Initialized(_taxToken, _mstrToken, _instantDividend);
    }

    /// @notice Accepts tax revenue forwarded from the tax token / TaxProcessor.
    receive() external payable {}

    // ========== ACCESS CONTROL ==========

    modifier onlyGuardian() {
        if (msg.sender != _getGuardian()) revert NotGuardian();
        _;
    }

    /// @dev Per Flap's mandate, Guardian always has backup access to every
    ///      permissioned function alongside the keeper — see VaultBase.sol.
    modifier onlyKeeperOrGuardian() {
        if (msg.sender != keeper && msg.sender != _getGuardian()) revert NotKeeperOrGuardian();
        _;
    }

    // ========== GUARDIAN CONFIG ==========

    function setSwapAdapter(address _adapter) external onlyGuardian {
        if (configLocked) revert ConfigIsLocked();
        swapAdapter = _adapter;
        emit SwapAdapterUpdated(_adapter);
    }

    function setKeeper(address _keeper) external onlyGuardian {
        keeper = _keeper;
        emit KeeperUpdated(_keeper);
    }

    function setMinSwapThreshold(uint256 _thresholdWei) external onlyGuardian {
        minSwapThresholdWei = _thresholdWei;
        emit MinSwapThresholdUpdated(_thresholdWei);
    }

    /// @notice Permanently disables `setSwapAdapter`. Irreversible.
    /// @dev    Does NOT lock keeper/threshold — those are operational, not
    ///         asset-selection parameters. MSTR itself was never settable
    ///         after initialize() to begin with, so this only locks the
    ///         swap execution path, not what asset is being acquired.
    function lockConfig() external onlyGuardian {
        configLocked = true;
        emit ConfigLocked();
    }

    // ========== CORE: ACQUIRE MSTR ==========

    /// @notice Swap all accumulated ETH for MSTR via the configured adapter.
    /// @param minMstrOut Slippage floor, computed off-chain by the caller.
    /// @param deadline   Swap must execute before this unix timestamp.
    function dispatch(uint256 minMstrOut, uint256 deadline) external nonReentrant onlyKeeperOrGuardian {
        if (swapAdapter == address(0)) revert SwapAdapterNotSet();
        if (block.timestamp > deadline) revert DeadlinePassed();

        uint256 ethBalance = address(this).balance;
        if (ethBalance < minSwapThresholdWei || ethBalance == 0) revert NothingToDispatch();

        uint256 mstrBefore = IERC20(mstrToken).balanceOf(address(this));
        uint256 mstrOut = IMSTRSwapAdapter(swapAdapter).swapForMSTR{value: ethBalance}(minMstrOut, deadline);
        uint256 mstrReceived = IERC20(mstrToken).balanceOf(address(this)) - mstrBefore;

        if (mstrOut < minMstrOut || mstrReceived < minMstrOut) revert InsufficientOutput();

        totalMSTRAcquired += mstrReceived;
        emit Dispatched(ethBalance, mstrReceived);
    }

    // ========== DISTRIBUTION ==========

    /// @notice Instant-push MSTR directly to holders. Keeper computes
    ///         `amounts` off-chain, proportional to each holder's eligible
    ///         $BRO balance at the time of the snapshot they used.
    /// @dev    Reverts if the total requested exceeds what the vault
    ///         actually holds and isn't already reserved for pending
    ///         claims — a compromised keeper can misdirect at most the
    ///         vault's current unreserved MSTR balance, and every unit
    ///         moved is a real transfer to the address the keeper specified,
    ///         never a mint or an internal-accounting-only credit.
    function pushDividends(address[] calldata holders, uint256[] calldata amounts)
        external
        nonReentrant
        onlyKeeperOrGuardian
    {
        if (holders.length != amounts.length) revert ArrayLengthMismatch();

        uint256 total;
        for (uint256 i = 0; i < amounts.length; i++) {
            total += amounts[i];
        }

        uint256 available = IERC20(mstrToken).balanceOf(address(this)) - reservedForClaims;
        if (total > available) revert ExceedsAvailableBalance();

        for (uint256 i = 0; i < holders.length; i++) {
            if (amounts[i] == 0) continue;
            IERC20(mstrToken).safeTransfer(holders[i], amounts[i]);
        }

        totalMSTRDistributed += total;
        emit DividendsPushed(holders.length, total);
    }

    /// @notice Credit a claimable balance instead of pushing directly —
    ///         used when `instantDividend` is false, or as a fallback for
    ///         specific addresses a push couldn't reach.
    function creditDividends(address[] calldata holders, uint256[] calldata amounts)
        external
        nonReentrant
        onlyKeeperOrGuardian
    {
        if (holders.length != amounts.length) revert ArrayLengthMismatch();

        uint256 total;
        for (uint256 i = 0; i < amounts.length; i++) {
            total += amounts[i];
        }

        uint256 available = IERC20(mstrToken).balanceOf(address(this)) - reservedForClaims;
        if (total > available) revert ExceedsAvailableBalance();

        for (uint256 i = 0; i < holders.length; i++) {
            if (amounts[i] == 0) continue;
            claimable[holders[i]] += amounts[i];
        }

        reservedForClaims += total;
        totalMSTRDistributed += total;
        emit DividendsCredited(holders.length, total);
    }

    /// @notice Self-serve claim of any credited MSTR. Only `msg.sender`'s
    ///         own credited balance can ever be claimed by them — there is
    ///         no way to specify a different recipient, so a caller cannot
    ///         claim on behalf of (or redirect) another holder's rewards.
    function claim() external nonReentrant {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert NothingToClaim();

        claimable[msg.sender] = 0;
        reservedForClaims -= amount;
        emit DividendClaimed(msg.sender, amount);
        IERC20(mstrToken).safeTransfer(msg.sender, amount);
    }

    // ========== VIEWS ==========

    function description() public view override returns (string memory) {
        return string.concat(
            "BRO MSTR Vault -- MSTR acquired: ",
            _u2s(totalMSTRAcquired),
            ", distributed: ",
            _u2s(totalMSTRDistributed),
            ", reserved for claims: ",
            _u2s(reservedForClaims)
        );
    }

    function vaultUISchema() public pure override returns (VaultUISchema memory schema) {
        schema.vaultType = "BROMSTRVault";
        schema.description =
            "Receives $BRO trading tax in ETH, swaps it for MSTR, and distributes MSTR to eligible $BRO holders. Instant push by default, with a manual claim fallback.";

        schema.methods = new VaultMethodSchema[](2);

        schema.methods[0].name = "claimable";
        schema.methods[0].description = "MSTR currently credited to an address and available to claim.";
        schema.methods[0].inputs = new FieldDescriptor[](1);
        schema.methods[0].inputs[0] = FieldDescriptor("holder", "address", "Address to check", 0);
        schema.methods[0].outputs = new FieldDescriptor[](1);
        schema.methods[0].outputs[0] = FieldDescriptor("amount", "uint256", "Claimable MSTR amount", 18);
        schema.methods[0].approvals = new ApproveAction[](0);

        schema.methods[1].name = "claim";
        schema.methods[1].description = "Claim your credited MSTR balance.";
        schema.methods[1].inputs = new FieldDescriptor[](0);
        schema.methods[1].outputs = new FieldDescriptor[](0);
        schema.methods[1].approvals = new ApproveAction[](0);
        schema.methods[1].isWriteMethod = true;
    }

    function _u2s(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 j = v;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory buf = new bytes(len);
        while (v != 0) {
            len -= 1;
            buf[len] = bytes1(uint8(48 + (v % 10)));
            v /= 10;
        }
        return string(buf);
    }
}
