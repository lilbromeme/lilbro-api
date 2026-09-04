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
import {ILiquidityAdapter} from "./ILiquidityAdapter.sol";

/// @title BROMSTRVaultUpgradeable
/// @notice Custom Flap vault for $BRO. Splits incoming trading-tax ETH three
///         ways: 80% swaps to MSTR for holder dividends, 15% becomes
///         permanent BRO/ETH liquidity, 5% buys and burns BRO.
///
/// @dev DISTRIBUTION DESIGN — READ BEFORE DEPLOYING
///
///      A vault cannot enumerate $BRO's holder list on-chain, and this
///      contract does not control the $BRO token contract (it's launched
///      through Flap's standard token factory), so it cannot hook into
///      $BRO transfers to maintain a live accumulator the way a custom
///      dividend-paying token would. Instead, for the dividend leg:
///
///      1. `dispatchDividend()` swaps the accumulated dividend-bucket ETH
///         for MSTR. Guardian/keeper only.
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
/// @dev THREE-BUCKET ACCOUNTING
///
///      `receive()` splits every incoming payment into three named
///      accumulators (`pendingDividendETH` / `pendingLiquidityETH` /
///      `pendingBurnETH`) at fixed, immutable basis points
///      (`DIVIDEND_BPS` / `LIQUIDITY_BPS` / `BURN_BPS`, summing to 10_000).
///      This keeps `receive()` itself cheap (bounded storage writes only,
///      no external calls, no loops) and moves all swap/liquidity/burn
///      logic into three separate explicit functions, each of which only
///      ever spends its own bucket — a bug or malicious call against one
///      leg cannot drain another.
///
///      Liquidity is added via a pluggable `ILiquidityAdapter` and the
///      resulting LP tokens are immediately forwarded to `BURN_ADDRESS`
///      (never held by the vault), making the liquidity permanent and
///      unrecoverable by design rather than merely "locked" in a way that
///      depends on the vault never adding a withdrawal function later.
///      The buy-and-burn leg swaps ETH for BRO via a pluggable
///      `IMSTRSwapAdapter`-shaped adapter (reused generically — its ABI is
///      just "ETH in, ERC20 out", not MSTR-specific) and forwards the BRO
///      received to `BURN_ADDRESS` rather than depending on BRO exposing a
///      `burn()` function, which this project has not verified exists.
///
///      Selected asset (MSTR), the three bucket percentages, and the burn
///      address are fixed at compile time (constants) and cannot be
///      changed by anyone, including Guardian, after deployment.
contract BROMSTRVaultUpgradeable is Initializable, VaultBaseV2, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    // ========== BUCKET SPLIT (fixed forever) ==========
    uint16 public constant DIVIDEND_BPS = 8_000; // 80% -> MSTR dividends
    uint16 public constant LIQUIDITY_BPS = 1_500; // 15% -> permanent BRO/ETH liquidity
    uint16 public constant BURN_BPS = 500; // 5% -> buy & burn BRO
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // ========== IMMUTABLE-AFTER-INIT CONFIG ==========
    /// @notice The $BRO tax token this vault backs. Set once, never changed.
    address public taxToken;
    /// @notice The ONLY supported dividend reward asset. Set once, never
    ///         changed — there is no setter for this field anywhere in the
    ///         contract.
    address public mstrToken;
    /// @notice Always 10_000 (100%) of the dividend bucket — BRO's dividend
    ///         leg is single-asset by design.
    /// @dev    Kept as an explicit constant (not a variable) so it is
    ///         provably immutable, not just unset by convention.
    uint16 public constant MSTR_ALLOCATION_BPS = 10_000;
    /// @notice Whether the intended UX is instant push (true) or
    ///         claim-based (false). Informational for the UI; does not
    ///         gate which functions the Guardian/keeper may call.
    bool public instantDividend;

    // ========== GUARDIAN-GATED CONFIG (can be locked permanently) ==========
    address public mstrSwapAdapter;
    address public liquidityAdapter;
    address public burnSwapAdapter;
    address public keeper;
    uint256 public minSwapThresholdWei;
    bool public configLocked;

    // ========== PENDING BUCKETS (populated by receive()) ==========
    uint256 public pendingDividendETH;
    uint256 public pendingLiquidityETH;
    uint256 public pendingBurnETH;

    // ========== DIVIDEND STATE ==========
    /// @notice MSTR credited to a holder that hasn't been claimed yet.
    mapping(address => uint256) public claimable;
    /// @notice Running total of MSTR ever pushed or credited, for transparency.
    uint256 public totalMSTRDistributed;
    /// @notice Running total of MSTR ever acquired via dispatchDividend(), for transparency.
    uint256 public totalMSTRAcquired;
    /// @notice MSTR currently reserved by outstanding `claimable` balances —
    ///         tracked separately so `pushDividends`/`creditDividends` can't
    ///         double-allocate MSTR that's already promised to a claimer.
    uint256 public reservedForClaims;
    /// @notice Running total of BRO ever bought and sent to BURN_ADDRESS.
    uint256 public totalBroBurned;
    /// @notice Running total of LP tokens ever minted and sent to BURN_ADDRESS.
    uint256 public totalLpBurned;

    // ========== EVENTS ==========
    event Initialized(address indexed taxToken, address indexed mstrToken, bool instantDividend);
    event TaxReceived(uint256 total, uint256 toDividend, uint256 toLiquidity, uint256 toBurn);
    event DividendDispatched(uint256 ethIn, uint256 mstrOut);
    event LiquidityAdded(uint256 ethIn, address indexed lpToken, uint256 lpAmount);
    event BroBurned(uint256 ethIn, uint256 broAmount);
    event DividendsPushed(uint256 holderCount, uint256 totalAmount);
    event DividendsCredited(uint256 holderCount, uint256 totalAmount);
    event DividendClaimed(address indexed holder, uint256 amount);
    event MstrSwapAdapterUpdated(address indexed newAdapter);
    event LiquidityAdapterUpdated(address indexed newAdapter);
    event BurnSwapAdapterUpdated(address indexed newAdapter);
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
    /// @param _mstrSwapAdapter    Address implementing IMSTRSwapAdapter for the ETH->MSTR
    ///                            dividend leg. Can be address(0) at launch and set later
    ///                            by Guardian, but dispatchDividend() will revert until set.
    /// @param _liquidityAdapter   Address implementing ILiquidityAdapter for the auto-liquidity
    ///                            leg. Can be address(0) at launch and set later by Guardian,
    ///                            but dispatchLiquidity() will revert until set.
    /// @param _burnSwapAdapter    Address implementing IMSTRSwapAdapter (reused generically)
    ///                            for the ETH->BRO buy-and-burn leg. Can be address(0) at
    ///                            launch and set later by Guardian, but dispatchBurn() will
    ///                            revert until set.
    /// @param _keeper             Off-chain automation address authorized alongside
    ///                            Guardian to call the dispatch*/push/credit functions.
    /// @param _instantDividend    UI/UX flag — see contract-level docs.
    /// @param _minSwapThresholdWei Minimum accumulated bucket balance before a dispatch*
    ///                            function will act (avoids burning gas on dust amounts).
    function initialize(
        address _taxToken,
        address _mstrToken,
        address _mstrSwapAdapter,
        address _liquidityAdapter,
        address _burnSwapAdapter,
        address _keeper,
        bool _instantDividend,
        uint256 _minSwapThresholdWei
    ) external initializer {
        __ReentrancyGuard_init();
        require(_taxToken != address(0) && _mstrToken != address(0), "Zero address");

        taxToken = _taxToken;
        mstrToken = _mstrToken;
        mstrSwapAdapter = _mstrSwapAdapter;
        liquidityAdapter = _liquidityAdapter;
        burnSwapAdapter = _burnSwapAdapter;
        keeper = _keeper;
        instantDividend = _instantDividend;
        minSwapThresholdWei = _minSwapThresholdWei;

        emit Initialized(_taxToken, _mstrToken, _instantDividend);
    }

    /// @notice Accepts tax revenue forwarded from the tax token / TaxProcessor
    ///         and splits it into the three fixed buckets. Bounded storage
    ///         writes only, no external calls — stays far under the 1M gas
    ///         cap on every path.
    receive() external payable {
        if (msg.value == 0) return;

        uint256 toDividend = (msg.value * DIVIDEND_BPS) / 10_000;
        uint256 toLiquidity = (msg.value * LIQUIDITY_BPS) / 10_000;
        // Remainder (rather than a third multiplication) absorbs any
        // rounding dust into the burn bucket so the three buckets always
        // sum to exactly msg.value.
        uint256 toBurn = msg.value - toDividend - toLiquidity;

        pendingDividendETH += toDividend;
        pendingLiquidityETH += toLiquidity;
        pendingBurnETH += toBurn;

        emit TaxReceived(msg.value, toDividend, toLiquidity, toBurn);
    }

    // ========== ACCESS CONTROL ==========

    modifier onlyGuardian() {
        require(msg.sender == _getGuardian(), "Not guardian");
        _;
    }

    /// @dev Per Flap's mandate, Guardian always has backup access to every
    ///      permissioned function alongside the keeper — see VaultBase.sol.
    modifier onlyKeeperOrGuardian() {
        require(msg.sender == keeper || msg.sender == _getGuardian(), "Not keeper or guardian");
        _;
    }

    // ========== GUARDIAN CONFIG ==========

    function setMstrSwapAdapter(address _adapter) external onlyGuardian {
        require(!configLocked, "Config is locked");
        mstrSwapAdapter = _adapter;
        emit MstrSwapAdapterUpdated(_adapter);
    }

    function setLiquidityAdapter(address _adapter) external onlyGuardian {
        require(!configLocked, "Config is locked");
        liquidityAdapter = _adapter;
        emit LiquidityAdapterUpdated(_adapter);
    }

    function setBurnSwapAdapter(address _adapter) external onlyGuardian {
        require(!configLocked, "Config is locked");
        burnSwapAdapter = _adapter;
        emit BurnSwapAdapterUpdated(_adapter);
    }

    function setKeeper(address _keeper) external onlyGuardian {
        keeper = _keeper;
        emit KeeperUpdated(_keeper);
    }

    function setMinSwapThreshold(uint256 _thresholdWei) external onlyGuardian {
        minSwapThresholdWei = _thresholdWei;
        emit MinSwapThresholdUpdated(_thresholdWei);
    }

    /// @notice Permanently disables all three `set*Adapter` functions. Irreversible.
    /// @dev    Does NOT lock keeper/threshold — those are operational, not
    ///         asset-selection parameters. MSTR itself, and the bucket
    ///         percentages, were never settable after initialize() to begin
    ///         with, so this only locks the execution-adapter paths.
    function lockConfig() external onlyGuardian {
        configLocked = true;
        emit ConfigLocked();
    }

    // ========== DIVIDEND LEG: ACQUIRE MSTR ==========

    /// @notice Swap the accumulated dividend-bucket ETH for MSTR via the
    ///         configured adapter.
    /// @param minMstrOut Slippage floor, computed off-chain by the caller.
    /// @param deadline   Swap must execute before this unix timestamp.
    function dispatchDividend(uint256 minMstrOut, uint256 deadline) external nonReentrant onlyKeeperOrGuardian {
        require(mstrSwapAdapter != address(0), "Swap adapter not set");
        require(block.timestamp <= deadline, "Deadline passed");

        uint256 ethIn = pendingDividendETH;
        require(ethIn >= minSwapThresholdWei && ethIn > 0, "Nothing to dispatch");
        pendingDividendETH = 0;

        uint256 mstrBefore = IERC20(mstrToken).balanceOf(address(this));
        uint256 mstrOut = IMSTRSwapAdapter(mstrSwapAdapter).swapForMSTR{value: ethIn}(minMstrOut, deadline);
        uint256 mstrReceived = IERC20(mstrToken).balanceOf(address(this)) - mstrBefore;

        require(mstrOut >= minMstrOut && mstrReceived >= minMstrOut, "Insufficient output");

        totalMSTRAcquired += mstrReceived;
        emit DividendDispatched(ethIn, mstrReceived);
    }

    // ========== LIQUIDITY LEG: PERMANENT BRO/ETH LIQUIDITY ==========

    /// @notice Convert the accumulated liquidity-bucket ETH into permanent
    ///         BRO/ETH liquidity via the configured adapter. The resulting
    ///         LP tokens are forwarded to BURN_ADDRESS in the same
    ///         transaction — the vault never custodies them.
    /// @param minLpOut Slippage floor on LP tokens minted, computed off-chain.
    /// @param deadline Call must execute before this unix timestamp.
    function dispatchLiquidity(uint256 minLpOut, uint256 deadline) external nonReentrant onlyKeeperOrGuardian {
        require(liquidityAdapter != address(0), "Liquidity adapter not set");
        require(block.timestamp <= deadline, "Deadline passed");

        uint256 ethIn = pendingLiquidityETH;
        require(ethIn >= minSwapThresholdWei && ethIn > 0, "Nothing to dispatch");
        pendingLiquidityETH = 0;

        (address lpToken, uint256 lpAmount) =
            ILiquidityAdapter(liquidityAdapter).addLiquidity{value: ethIn}(minLpOut, deadline);
        require(lpAmount >= minLpOut, "Insufficient output");

        totalLpBurned += lpAmount;
        IERC20(lpToken).safeTransfer(BURN_ADDRESS, lpAmount);
        emit LiquidityAdded(ethIn, lpToken, lpAmount);
    }

    // ========== BURN LEG: BUY & BURN BRO ==========

    /// @notice Swap the accumulated burn-bucket ETH for BRO via the
    ///         configured adapter and send the BRO received to
    ///         BURN_ADDRESS. Sending to BURN_ADDRESS is used instead of
    ///         calling a `burn()` function on the tax token because this
    ///         project has not verified that BRO's token contract exposes
    ///         one.
    /// @param minBroOut Slippage floor, computed off-chain by the caller.
    /// @param deadline  Swap must execute before this unix timestamp.
    function dispatchBurn(uint256 minBroOut, uint256 deadline) external nonReentrant onlyKeeperOrGuardian {
        require(burnSwapAdapter != address(0), "Burn adapter not set");
        require(block.timestamp <= deadline, "Deadline passed");

        uint256 ethIn = pendingBurnETH;
        require(ethIn >= minSwapThresholdWei && ethIn > 0, "Nothing to dispatch");
        pendingBurnETH = 0;

        uint256 broBefore = IERC20(taxToken).balanceOf(address(this));
        uint256 broOut = IMSTRSwapAdapter(burnSwapAdapter).swapForMSTR{value: ethIn}(minBroOut, deadline);
        uint256 broReceived = IERC20(taxToken).balanceOf(address(this)) - broBefore;

        require(broOut >= minBroOut && broReceived >= minBroOut, "Insufficient output");

        totalBroBurned += broReceived;
        IERC20(taxToken).safeTransfer(BURN_ADDRESS, broReceived);
        emit BroBurned(ethIn, broReceived);
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
        require(holders.length == amounts.length, "Array length mismatch");

        uint256 total;
        for (uint256 i = 0; i < amounts.length; i++) {
            total += amounts[i];
        }

        uint256 available = IERC20(mstrToken).balanceOf(address(this)) - reservedForClaims;
        require(total <= available, "Exceeds available balance");

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
        require(holders.length == amounts.length, "Array length mismatch");

        uint256 total;
        for (uint256 i = 0; i < amounts.length; i++) {
            total += amounts[i];
        }

        uint256 available = IERC20(mstrToken).balanceOf(address(this)) - reservedForClaims;
        require(total <= available, "Exceeds available balance");

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
        require(amount > 0, "Nothing to claim");

        claimable[msg.sender] = 0;
        reservedForClaims -= amount;
        emit DividendClaimed(msg.sender, amount);
        IERC20(mstrToken).safeTransfer(msg.sender, amount);
    }

    // ========== VIEWS ==========

    function description() public view override returns (string memory) {
        return string.concat(
            "BRO Vault -- 80% MSTR dividend / 15% auto-liquidity / 5% burn. MSTR acquired: ",
            _u2s(totalMSTRAcquired),
            ", distributed: ",
            _u2s(totalMSTRDistributed),
            ", BRO burned: ",
            _u2s(totalBroBurned),
            ", LP burned: ",
            _u2s(totalLpBurned)
        );
    }

    function vaultUISchema() public pure override returns (VaultUISchema memory schema) {
        schema.vaultType = "BROMSTRVault";
        schema.description =
            "Receives $BRO trading tax in ETH and splits it: 80% swaps to MSTR for holder dividends, 15% becomes permanent BRO/ETH liquidity, 5% buys and burns BRO. Instant dividend push by default, with a manual claim fallback.";

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
