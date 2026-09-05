// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IMSTRSwapAdapter} from "./IMSTRSwapAdapter.sol";

/// @notice Minimal Uniswap-v3-style router interface. Only the single
///         function this adapter needs -- not a full router ABI.
interface IUniswapV3StyleRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/// @notice WETH-style wrapped native token, needed because most v3-style
///         routers swap ERC-20-to-ERC-20, not native-ETH-to-ERC-20 directly.
interface IWETH9 {
    function deposit() external payable;
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @title MSTRSwapAdapterUniV3Reference
/// @notice REFERENCE implementation only. Every address below is a
///         constructor parameter, not a hardcoded constant -- because none
///         of them have been independently verified as part of this
///         project. Deploy this only after you have confirmed, yourself,
///         against Robinhood Chain's actual live infrastructure:
///
///           1. That a Uniswap-v3-style router actually exists and is the
///              correct integration point on Robinhood Chain (the chain is
///              documented as supporting Uniswap v4-style infrastructure --
///              v4 uses a fundamentally different PoolManager + hooks
///              interface, not the exactInputSingle pattern used here. If
///              the real integration point is v4, this adapter's internals
///              need to be rewritten against PoolManager, not just
///              reparameterized).
///           2. The WETH9 address on Robinhood Chain.
///           3. That an MSTR/WETH pool with adequate liquidity actually
///              exists at the fee tier you configure.
///
///         Do not deploy this to mainnet on the assumption that it works --
///         it is structurally correct Solidity against a common router
///         pattern, not a confirmed integration against Robinhood Chain's
///         actual live DEX.
contract MSTRSwapAdapterUniV3Reference is IMSTRSwapAdapter {
    error ZeroAddress();
    error OnlyVault();
    error UnsupportedOnRobinhoodChain();

    address public immutable VAULT;
    address public immutable ROUTER;
    address public immutable WETH;
    address public immutable MSTR;
    uint24 public immutable POOL_FEE;

    constructor(address _vault, address _router, address _weth, address _mstr, uint24 _poolFee) {
        // Robinhood Chain's supported Uniswap deployment is V4/Universal
        // Router, not this V3 exactInputSingle interface. Refuse deployment
        // on both Robinhood environments so this reference cannot be wired
        // into a BRO vault by mistake.
        if (block.chainid == 4663 || block.chainid == 46630) revert UnsupportedOnRobinhoodChain();
        if (_vault == address(0) || _router == address(0) || _weth == address(0) || _mstr == address(0)) {
            revert ZeroAddress();
        }
        VAULT = _vault;
        ROUTER = _router;
        WETH = _weth;
        MSTR = _mstr;
        POOL_FEE = _poolFee;
    }

    modifier onlyVault() {
        _checkOnlyVault();
        _;
    }

    function _checkOnlyVault() internal view {
        if (msg.sender != VAULT) revert OnlyVault();
    }

    function swapForMSTR(uint256 minMstrOut, uint256 deadline) external payable onlyVault returns (uint256 mstrOut) {
        IWETH9(WETH).deposit{value: msg.value}();
        IWETH9(WETH).approve(ROUTER, msg.value);

        mstrOut = IUniswapV3StyleRouter(ROUTER).exactInputSingle(
            IUniswapV3StyleRouter.ExactInputSingleParams({
                tokenIn: WETH,
                tokenOut: MSTR,
                fee: POOL_FEE,
                recipient: VAULT,
                deadline: deadline,
                amountIn: msg.value,
                amountOutMinimum: minMstrOut,
                sqrtPriceLimitX96: 0
            })
        );
    }
}
