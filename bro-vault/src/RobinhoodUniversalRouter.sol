// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title Robinhood Chain Universal Router constants and interface
/// @notice Pulled directly from Robinhood Chain mainnet's own VERIFIED,
///         deployed Universal Router source at
///         `0x8876789976dEcBfCbBbe364623C63652db8C0904` (retrieved from
///         Robinhood's own block explorer, robinhoodchain.blockscout.com,
///         via its contract-verification API -- not a third-party summary).
///
/// @dev    Robinhood's fork is byte-identical to canonical Uniswap Universal
///         Router (`src/pkgs/universal-router/contracts/UniversalRouter.sol`,
///         solc 0.8.26) with exactly one change, applied uniformly to every
///         swap command (V2_SWAP_EXACT_IN/OUT, V3_SWAP_EXACT_IN/OUT, and
///         every V4Router struct): each gained an additional
///         `minHopPriceX36` parameter -- a per-hop minimum price floor in
///         1e36 precision, checked in addition to (not instead of) the
///         existing `amountOutMinimum`/`amountInMaximum`. Passing an EMPTY
///         array disables the per-hop check entirely and falls back to
///         relying solely on `amountOutMinimum`, confirmed directly from
///         V2SwapRouter.sol's `_v2Swap`:
///         `bool minHopPriceEnabled = minHopPriceX36.length != 0;`.
///         This is why standard Uniswap SDK-generated calldata reverts
///         against this router (wrong parameter count), and why every
///         adapter in this project builds calldata by hand against this
///         exact, verified layout instead.
///
///         Command byte values (Commands.sol) and the ETH/token payment
///         helpers (Payments.sol, ActionConstants.sol) are UNCHANGED from
///         canonical Uniswap -- verified by direct comparison of Robinhood's
///         deployed source against Uniswap's own repository.
interface IRobinhoodUniversalRouter {
    function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable;
}

library RobinhoodRouterCommands {
    // Commands.sol -- unmodified from canonical Uniswap Universal Router.
    uint8 internal constant V3_SWAP_EXACT_IN = 0x00;
    uint8 internal constant V2_SWAP_EXACT_IN = 0x08;
    uint8 internal constant WRAP_ETH = 0x0b;

    // ActionConstants.sol -- unmodified from canonical Uniswap.
    address internal constant ADDRESS_THIS = address(2);
    uint256 internal constant CONTRACT_BALANCE =
        0x8000000000000000000000000000000000000000000000000000000000000000;
}
