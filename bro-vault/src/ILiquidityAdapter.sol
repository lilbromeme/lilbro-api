// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title ILiquidityAdapter
/// @notice Minimal interface the vault uses to convert native ETH into
///         permanent BRO/ETH liquidity.
/// @dev    WHY THIS IS A SEPARATE INTERFACE, NOT INLINED INTO THE VAULT:
///
///         Adding liquidity is a fundamentally different operation from a
///         plain swap (see IMSTRSwapAdapter.sol): the adapter must swap part
///         of the incoming ETH for BRO, then supply both legs to BRO's
///         actual liquidity pool. Which pool type that is (Uniswap V2-style
///         pair, V3 concentrated position, or V4 PoolManager position) is
///         determined by whatever `migratorType` BRO itself launches with on
///         Flap -- Flap's own MigratorType enum documents V4_UNI_MIGRATOR as
///         supported only on Base/XLayer, not Robinhood Chain, so BRO's own
///         pair is likely V2- or V3-style, but this has NOT been
///         independently verified as part of this project and must not be
///         assumed. Exactly like IMSTRSwapAdapter, the vault depends only on
///         this interface -- the actual pool integration lives in a
///         separate, small adapter contract that YOU deploy and verify
///         independently before wiring it in via `setLiquidityAdapter()`.
interface ILiquidityAdapter {
    /// @notice Convert `msg.value` native ETH into permanent BRO/ETH
    ///         liquidity. The adapter decides internally how much of the ETH
    ///         to swap for BRO before pairing it; the caller only bounds the
    ///         final LP output.
    /// @param minLpOut Minimum acceptable LP amount (slippage protection).
    /// @param deadline Unix timestamp after which the call must revert.
    /// @return lpToken  The LP token contract address liquidity was minted into.
    /// @return lpAmount The amount of LP tokens minted.
    function addLiquidity(uint256 minLpOut, uint256 deadline)
        external
        payable
        returns (address lpToken, uint256 lpAmount);
}
