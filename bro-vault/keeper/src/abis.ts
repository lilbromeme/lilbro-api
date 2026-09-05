// Minimal ABI fragments -- only what this keeper actually calls.

export const vaultAbi = [
  { type: "function", name: "pendingDividendETH", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "pendingLiquidityETH", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "pendingBurnETH", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "mstrToken", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "taxToken", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "instantDividend", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "totalMSTRAcquired", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalMSTRDistributed", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "reservedForClaims", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "dispatchDividend",
    stateMutability: "nonpayable",
    inputs: [{ name: "minMstrOut", type: "uint256" }, { name: "deadline", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "dispatchLiquidity",
    stateMutability: "nonpayable",
    inputs: [{ name: "minLpOut", type: "uint256" }, { name: "deadline", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "dispatchBurn",
    stateMutability: "nonpayable",
    inputs: [{ name: "minBroOut", type: "uint256" }, { name: "deadline", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "pushDividends",
    stateMutability: "nonpayable",
    inputs: [{ name: "holders", type: "address[]" }, { name: "amounts", type: "uint256[]" }],
    outputs: [],
  },
  {
    type: "function",
    name: "creditDividends",
    stateMutability: "nonpayable",
    inputs: [{ name: "holders", type: "address[]" }, { name: "amounts", type: "uint256[]" }],
    outputs: [],
  },
] as const;

export const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

export const v3PoolAbi = [
  {
    type: "function",
    name: "slot0",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" },
    ],
  },
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "token1", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

export const v2FactoryAbi = [
  {
    type: "function",
    name: "getPair",
    stateMutability: "view",
    inputs: [{ type: "address" }, { type: "address" }],
    outputs: [{ type: "address" }],
  },
] as const;

export const v2PairAbi = [
  {
    type: "function",
    name: "getReserves",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "reserve0", type: "uint112" }, { name: "reserve1", type: "uint112" }, { name: "blockTimestampLast", type: "uint32" }],
  },
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;
