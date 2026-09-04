// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IMSTRSwapAdapter} from "./IMSTRSwapAdapter.sol";
import {IRobinhoodUniversalRouter, RobinhoodRouterCommands} from "./RobinhoodUniversalRouter.sol";
import {IERC20} from "@openzeppelin/token/ERC20/IERC20.sol";

/// @title BROBurnSwapAdapterRobinhoodV2
/// @notice REAL, production ETH -> BRO adapter for the vault's 5%
///         buy-and-burn leg (reuses IMSTRSwapAdapter's ABI generically --
///         "ETH in, ERC20 out" -- exactly as the vault's own NatSpec already
///         documents). Routes through Robinhood Chain's real, verified
///         Uniswap V2 Factory via the real, verified Universal Router.
///
/// @dev Uniswap V2 Factory : 0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f
///        Read directly from the Universal Router's own verified
///        constructor arguments (`v2Factory` field) -- this is the ONLY
///        V2 factory the router will route V2 swap commands through, so
///        it is authoritative by construction, not a separate guess.
///
///      WHY V2 FOR BRO, NOT V4 (unlike the MSTR dividend leg): Flap's own
///      `MigratorType` enum (src/flap/IPortal.sol) documents
///      `V4_UNI_MIGRATOR` as supported only on Base and XLayer -- Robinhood
///      Chain is not in that list -- so a Flap tax token graduating off its
///      bonding curve on Robinhood Chain is expected to land on a V2- or
///      V3-style pool. This adapter targets V2 specifically because it is
///      confirmed real and heavily used on Robinhood Chain (40,700+ pairs
///      registered on the verified V2 factory above at time of writing,
///      including a real, live, liquid WETH/USDG pair independently
///      checked on-chain). BRO's own pair does not exist yet -- it is
///      created by Flap's migrator when BRO itself first graduates -- so
///      this adapter cannot be deployed for real until that has happened
///      and BRO's live pair is confirmed to exist and hold liquidity. If
///      BRO instead graduates onto a V3 pool, this adapter is the wrong
///      shape and a V3 equivalent (mirroring MSTRSwapAdapterRobinhoodV3.sol)
///      would be needed instead -- check which one applies before deploying.
contract BROBurnSwapAdapterRobinhoodV2 is IMSTRSwapAdapter {
    error ZeroAddress();
    error OnlyVault();
    error UnsupportedOnNonRobinhoodChain();

    address public immutable VAULT;
    address public immutable ROUTER;
    address public immutable WETH;
    address public immutable BRO;

    constructor(address _vault, address _router, address _weth, address _bro) {
        if (block.chainid != 4663 && block.chainid != 46630) revert UnsupportedOnNonRobinhoodChain();
        if (_vault == address(0) || _router == address(0) || _weth == address(0) || _bro == address(0)) {
            revert ZeroAddress();
        }
        VAULT = _vault;
        ROUTER = _router;
        WETH = _weth;
        BRO = _bro;
    }

    modifier onlyVault() {
        if (msg.sender != VAULT) revert OnlyVault();
        _;
    }

    /// @notice Swaps `msg.value` ETH for BRO via the real V2 route and
    ///         delivers it directly to the vault, which then forwards it to
    ///         the burn address itself (see BROMSTRVault.sol:dispatchBurn).
    function swapForMSTR(uint256 minBroOut, uint256 deadline) external payable onlyVault returns (uint256 broOut) {
        bytes memory commands =
            abi.encodePacked(bytes1(RobinhoodRouterCommands.WRAP_ETH), bytes1(RobinhoodRouterCommands.V2_SWAP_EXACT_IN));

        bytes[] memory inputs = new bytes[](2);
        inputs[0] =
            abi.encode(RobinhoodRouterCommands.ADDRESS_THIS, RobinhoodRouterCommands.CONTRACT_BALANCE);

        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = BRO;
        uint256[] memory minHopPriceX36 = new uint256[](0); // per-hop check disabled; amountOutMinimum still enforced
        // (recipient, amountIn, amountOutMinimum, path, payerIsUser, minHopPriceX36)
        inputs[1] = abi.encode(VAULT, msg.value, minBroOut, path, false, minHopPriceX36);

        uint256 broBefore = IERC20(BRO).balanceOf(VAULT);
        IRobinhoodUniversalRouter(ROUTER).execute{value: msg.value}(commands, inputs, deadline);
        broOut = IERC20(BRO).balanceOf(VAULT) - broBefore;
    }
}
