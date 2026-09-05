// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ILiquidityAdapter} from "./ILiquidityAdapter.sol";
import {IRobinhoodUniversalRouter, RobinhoodRouterCommands} from "./RobinhoodUniversalRouter.sol";
import {IERC20} from "@openzeppelin/token/ERC20/IERC20.sol";

interface IUniswapV2FactoryLike {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
    function createPair(address tokenA, address tokenB) external returns (address pair);
}

interface IUniswapV2PairLike {
    function mint(address to) external returns (uint256 liquidity);
}

interface IWETH9Like {
    function deposit() external payable;
}

/// @title BROLiquidityAdapterRobinhoodV2
/// @notice REAL, production adapter for the vault's 15% auto-liquidity leg.
///         Swaps half of `msg.value` for BRO via Robinhood Chain's real,
///         verified Universal Router + Uniswap V2 Factory, then supplies
///         both legs directly to BRO's real WETH/BRO V2 pair and mints LP
///         tokens straight to the vault (which immediately forwards them to
///         the burn address -- see BROMSTRVault.sol:dispatchLiquidity).
///
/// @dev Uniswap V2 Factory : 0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f
///        Read directly from the Universal Router's own verified
///        constructor arguments -- see BROBurnSwapAdapterRobinhoodV2.sol
///        for the full reasoning on why V2, not V4, is the expected route
///        for BRO's own pair on Robinhood Chain.
///
///      Approximate, not optimal, LP split: this adapter swaps exactly
///      50% of incoming ETH for BRO, then supplies the resulting BRO and
///      the remaining 50% (wrapped to WETH) as liquidity as-is. If that
///      resulting ratio doesn't exactly match the pair's current reserve
///      ratio, Uniswap V2's `mint()` mints LP for only the matching
///      portion and silently donates the excess of whichever side is
///      oversupplied to the pool -- it does not revert or misallocate
///      funds, it is simply not perfectly capital-efficient. This is the
///      same approximate approach used by the overwhelming majority of
///      production "auto-liquidity" tax tokens; computing the exact
///      optimal swap-then-add split is a known harder problem this
///      project deliberately does not attempt, per the "simplest
///      implementation that actually works" brief.
///
///      BRO's own WETH/BRO pair does not exist until BRO itself first
///      graduates off Flap's bonding curve (Flap's own migrator creates
///      it, using whichever MigratorType BRO is launched with -- V2 is
///      expected but not guaranteed, see BROBurnSwapAdapterRobinhoodV2.sol).
///      This adapter cannot be deployed for real, and this contract's
///      constructor cannot be given BRO's real address, until that has
///      happened and the resulting pair has been independently confirmed
///      to exist and hold real liquidity.
contract BROLiquidityAdapterRobinhoodV2 is ILiquidityAdapter {
    error ZeroAddress();
    error OnlyVault();
    error UnsupportedOnNonRobinhoodChain();

    address public immutable VAULT;
    address public immutable ROUTER;
    address public immutable V2_FACTORY;
    address public immutable WETH;
    address public immutable BRO;

    constructor(address _vault, address _router, address _v2Factory, address _weth, address _bro) {
        if (block.chainid != 4663 && block.chainid != 46630) revert UnsupportedOnNonRobinhoodChain();
        if (
            _vault == address(0) || _router == address(0) || _v2Factory == address(0) || _weth == address(0)
                || _bro == address(0)
        ) {
            revert ZeroAddress();
        }
        VAULT = _vault;
        ROUTER = _router;
        V2_FACTORY = _v2Factory;
        WETH = _weth;
        BRO = _bro;
    }

    modifier onlyVault() {
        if (msg.sender != VAULT) revert OnlyVault();
        _;
    }

    function addLiquidity(uint256 minLpOut, uint256 deadline)
        external
        payable
        onlyVault
        returns (address lpToken, uint256 lpAmount)
    {
        uint256 half = msg.value / 2;
        uint256 remaining = msg.value - half;

        // ---- Swap `half` ETH for BRO, landing BRO in this adapter ----
        bytes memory commands =
            abi.encodePacked(bytes1(RobinhoodRouterCommands.WRAP_ETH), bytes1(RobinhoodRouterCommands.V2_SWAP_EXACT_IN));

        bytes[] memory inputs = new bytes[](2);
        inputs[0] = abi.encode(RobinhoodRouterCommands.ADDRESS_THIS, half);

        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = BRO;
        uint256[] memory minHopPriceX36 = new uint256[](0);
        // recipient = address(this): BRO must land here, not at the vault,
        // so this adapter can pair it with the remaining WETH below.
        inputs[1] = abi.encode(address(this), half, 0, path, false, minHopPriceX36);

        IRobinhoodUniversalRouter(ROUTER).execute{value: half}(commands, inputs, deadline);
        uint256 broAmount = IERC20(BRO).balanceOf(address(this));

        // ---- Wrap the remaining ETH into WETH held by this adapter ----
        IWETH9Like(WETH).deposit{value: remaining}();

        // ---- Supply both legs to the real WETH/BRO pair ----
        address pair = IUniswapV2FactoryLike(V2_FACTORY).getPair(WETH, BRO);
        if (pair == address(0)) {
            pair = IUniswapV2FactoryLike(V2_FACTORY).createPair(WETH, BRO);
        }

        IERC20(WETH).transfer(pair, remaining);
        IERC20(BRO).transfer(pair, broAmount);
        lpAmount = IUniswapV2PairLike(pair).mint(VAULT);

        require(lpAmount >= minLpOut, "Insufficient output");
        return (pair, lpAmount);
    }
}
