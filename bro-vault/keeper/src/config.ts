import "dotenv/config";
import { type Address, isAddress } from "viem";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function requireAddress(name: string): Address {
  const v = requireEnv(name);
  if (!isAddress(v)) throw new Error(`${name} is not a valid address: ${v}`);
  return v;
}

export const config = {
  rpcUrl: requireEnv("RPC_URL"),
  vaultAddress: requireAddress("VAULT_ADDRESS"),
  keeperPrivateKey: requireEnv("KEEPER_PRIVATE_KEY") as `0x${string}`,
  minDispatchWei: BigInt(process.env.MIN_DISPATCH_WEI ?? "10000000000000000"),
  slippageBps: BigInt(process.env.SLIPPAGE_BPS ?? "150"),
  dividendBatchSize: Number(process.env.DIVIDEND_BATCH_SIZE ?? "200"),
  excludedHolderAddresses: (process.env.EXCLUDED_HOLDER_ADDRESSES ?? "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter((a) => a.length > 0),
};

// Real, independently verified Robinhood Chain mainnet addresses -- see
// ../README.md and the main project README for how each was confirmed.
export const ROBINHOOD_CHAIN_ID = 4663;
export const WETH_ADDRESS: Address = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
export const UNISWAP_V2_FACTORY: Address = "0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f";
export const MSTR_ADDRESS: Address = "0xec262a75e413fAfD0dF80480274532C79D42da09";
export const MSTR_WETH_V3_POOL: Address = "0x70504a6FafdbfB75fE971FAA4dD716e79aC5624c";
export const MSTR_V3_FEE = 10_000; // 1%, read directly from the pool contract
export const BURN_ADDRESS: Address = "0x000000000000000000000000000000000000dEaD";

// Robinhood Chain's own block explorer -- used for BRO holder snapshots.
// See dividends.ts for exactly what's fetched and why.
export const BLOCKSCOUT_BASE = "https://robinhoodchain.blockscout.com";
