// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IMSTRSwapAdapter
/// @notice Minimal interface the vault uses to acquire MSTR with native ETH.
/// @dev    WHY THIS IS A SEPARATE INTERFACE, NOT INLINED INTO THE VAULT:
///
///         The exact swap mechanism Flap's own Index Vault infrastructure
///         uses internally to acquire Stock Tokens (which router, which
///         pool type, which quote asset path) has not been independently
///         confirmed for Robinhood Chain as part of this project. Robinhood
///         Chain is known to support Uniswap v4-style infrastructure, but
///         hardcoding a specific router address or pool key here would mean
///         guessing at a live contract address that moves real money —
///         exactly what this project's own brief says not to do.
///
///         Instead, the vault depends only on this interface. The actual
///         swap implementation lives in a separate, small adapter contract
///         (see MSTRSwapAdapterUniV3Reference.sol for a reference
///         implementation) that YOU deploy and verify independently before
///         wiring it into the vault via `setSwapAdapter()`. If Robinhood
///         Chain's actual DEX turns out to need a different interface
///         (Uniswap v4's PoolManager + hooks pattern, for instance), only
///         the adapter needs to change — the vault and factory do not.
interface IMSTRSwapAdapter {
    /// @notice Swap `msg.value` native ETH for MSTR.
    /// @param minMstrOut Minimum acceptable MSTR output (slippage protection).
    /// @param deadline   Unix timestamp after which the swap must revert.
    /// @return mstrOut   Actual amount of MSTR received.
    function swapForMSTR(uint256 minMstrOut, uint256 deadline) external payable returns (uint256 mstrOut);
}
