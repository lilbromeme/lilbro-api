import { type Address } from "viem";
import { erc20Abi, v2FactoryAbi, v2PairAbi, v3PoolAbi } from "./abis.js";
import { MSTR_V3_FEE, MSTR_WETH_V3_POOL, UNISWAP_V2_FACTORY } from "./config.js";

// Both dispatch.ts and dividends.ts pass a wallet client extended with
// publicActions, whose `account` field makes it structurally incompatible
// with viem's strict `PublicClient` type -- this only needs `readContract`.
type ReadClient = { readContract: (args: any) => Promise<any> };

/// Estimates ETH -> MSTR output using the real WETH/MSTR V3 pool's current
/// spot price (slot0().sqrtPriceX96), then applies `slippageBps` as a
/// tolerance floor. This is a SPOT-PRICE estimate, not an exact quote: it
/// ignores the trade's own price impact (fine for the vault's per-dispatch
/// sizes relative to the pool's ~3933 MSTR of liquidity at time of writing,
/// but re-check that assumption if dispatch amounts grow much larger) and
/// the pool's 1% fee is subtracted explicitly below.
///
/// Deliberately does not depend on a separate Quoter contract: the pool's
/// own token0/token1/slot0 were already independently verified in this
/// project (see MSTRSwapAdapterRobinhoodV3.sol), so this reuses that same
/// verified surface rather than introducing another unverified address.
export async function quoteMinMstrOut(
  client: ReadClient,
  ethIn: bigint,
  slippageBps: bigint,
): Promise<bigint> {
  const [token0, slot0] = await Promise.all([
    client.readContract({ address: MSTR_WETH_V3_POOL, abi: v3PoolAbi, functionName: "token0" }) as Promise<Address>,
    client.readContract({ address: MSTR_WETH_V3_POOL, abi: v3PoolAbi, functionName: "slot0" }),
  ]);

  const sqrtPriceX96 = slot0[0] as bigint;
  const Q96 = 2n ** 96n;
  const SCALE = 10n ** 18n;

  // price1Per0 = (sqrtPriceX96 / 2^96)^2, scaled by 1e18: value of 1 unit of
  // token0 expressed in token1, since both WETH and MSTR use 18 decimals no
  // further decimal adjustment is needed.
  const price1Per0 = (sqrtPriceX96 * sqrtPriceX96 * SCALE) / (Q96 * Q96);

  const isWethToken0 = token0.toLowerCase() === "0x0bd7d308f8e1639fab988df18a8011f41eacad73";
  // MSTR per 1 WETH, scaled by 1e18.
  const mstrPerWeth = isWethToken0 ? price1Per0 : (SCALE * SCALE) / price1Per0;

  const feeBps = BigInt(MSTR_V3_FEE) / 100n; // MSTR_V3_FEE is in hundredths of a bip (1e6 = 100%)
  const ethAfterFee = (ethIn * (10_000n - feeBps)) / 10_000n;
  const expectedMstrOut = (ethAfterFee * mstrPerWeth) / SCALE;

  return (expectedMstrOut * (10_000n - slippageBps)) / 10_000n;
}

/// Estimates ETH -> token output through a real, existing Uniswap V2 pair
/// using the standard constant-product formula against the pair's current
/// on-chain reserves, then applies `slippageBps`. Returns 0 if the pair
/// does not exist yet (e.g. BRO hasn't graduated to its own pool) -- callers
/// must treat that as "cannot dispatch yet", not "swap for free".
export async function quoteMinTokenOutV2(
  client: ReadClient,
  weth: Address,
  token: Address,
  ethIn: bigint,
  slippageBps: bigint,
): Promise<bigint> {
  const pair = (await client.readContract({
    address: UNISWAP_V2_FACTORY,
    abi: v2FactoryAbi,
    functionName: "getPair",
    args: [weth, token],
  })) as Address;

  if (pair === "0x0000000000000000000000000000000000000000") return 0n;

  const [reserves, pairToken0] = await Promise.all([
    client.readContract({ address: pair, abi: v2PairAbi, functionName: "getReserves" }),
    client.readContract({ address: pair, abi: v2PairAbi, functionName: "token0" }) as Promise<Address>,
  ]);

  const [reserve0, reserve1] = reserves as [bigint, bigint, number];
  const wethIsToken0 = pairToken0.toLowerCase() === weth.toLowerCase();
  const [reserveIn, reserveOut] = wethIsToken0 ? [reserve0, reserve1] : [reserve1, reserve0];

  // Standard Uniswap V2 getAmountOut, 0.3% fee.
  const amountInWithFee = ethIn * 997n;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 1000n + amountInWithFee;
  const expectedOut = numerator / denominator;

  return (expectedOut * (10_000n - slippageBps)) / 10_000n;
}

/// Rough LP-out estimate for BROLiquidityAdapterRobinhoodV2's addLiquidity():
/// it swaps half the incoming ETH for `token`, then supplies the remaining
/// half (as WETH) plus the received `token` to the pair. This estimates the
/// resulting mint using Uniswap V2's own proportional-share formula against
/// current reserves + LP total supply. This is an approximation of an
/// approximation (the adapter's own 50/50 split is itself not perfectly
/// ratio-matched -- see BROLiquidityAdapterRobinhoodV2.sol's NatSpec) and
/// exists only to set a sane keeper-side slippage floor; it is not a
/// security boundary. Returns 0 if the pair doesn't exist yet.
export async function quoteMinLpOut(
  client: ReadClient,
  weth: Address,
  token: Address,
  ethIn: bigint,
  slippageBps: bigint,
): Promise<bigint> {
  const pair = (await client.readContract({
    address: UNISWAP_V2_FACTORY,
    abi: v2FactoryAbi,
    functionName: "getPair",
    args: [weth, token],
  })) as Address;

  if (pair === "0x0000000000000000000000000000000000000000") return 0n;

  const half = ethIn / 2n;
  const remaining = ethIn - half;
  const rawTokenFromSwap = await quoteMinTokenOutV2(client, weth, token, half, 0n);

  const [reserves, pairToken0, totalSupply] = await Promise.all([
    client.readContract({ address: pair, abi: v2PairAbi, functionName: "getReserves" }),
    client.readContract({ address: pair, abi: v2PairAbi, functionName: "token0" }) as Promise<Address>,
    client.readContract({ address: pair, abi: erc20Abi, functionName: "totalSupply" }) as Promise<bigint>,
  ]);

  const [reserve0, reserve1] = reserves as [bigint, bigint, number];
  const wethIsToken0 = pairToken0.toLowerCase() === weth.toLowerCase();
  const [reserveWeth, reserveToken] = wethIsToken0 ? [reserve0, reserve1] : [reserve1, reserve0];

  if (totalSupply === 0n || reserveWeth === 0n || reserveToken === 0n) return 0n; // freshly created, empty pair

  const lpFromWeth = (remaining * totalSupply) / reserveWeth;
  const lpFromToken = (rawTokenFromSwap * totalSupply) / reserveToken;
  const expectedLp = lpFromWeth < lpFromToken ? lpFromWeth : lpFromToken;

  return (expectedLp * (10_000n - slippageBps)) / 10_000n;
}
