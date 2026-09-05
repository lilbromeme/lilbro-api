import { createPublicClient, createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { vaultAbi } from "./abis.js";
import { config, WETH_ADDRESS } from "./config.js";
import { quoteMinLpOut, quoteMinMstrOut, quoteMinTokenOutV2 } from "./quote.js";

const chain = { id: 4663, name: "Robinhood Chain", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [config.rpcUrl] } } };

async function main() {
  const account = privateKeyToAccount(config.keeperPrivateKey);
  const client = createWalletClient({ account, chain, transport: http(config.rpcUrl) }).extend(publicActions);

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 60); // 30 minutes from now

  const [pendingDividendETH, pendingLiquidityETH, pendingBurnETH, taxToken] = await Promise.all([
    client.readContract({ address: config.vaultAddress, abi: vaultAbi, functionName: "pendingDividendETH" }),
    client.readContract({ address: config.vaultAddress, abi: vaultAbi, functionName: "pendingLiquidityETH" }),
    client.readContract({ address: config.vaultAddress, abi: vaultAbi, functionName: "pendingBurnETH" }),
    client.readContract({ address: config.vaultAddress, abi: vaultAbi, functionName: "taxToken" }),
  ]);

  console.log(`pendingDividendETH=${pendingDividendETH} pendingLiquidityETH=${pendingLiquidityETH} pendingBurnETH=${pendingBurnETH}`);

  if (pendingDividendETH >= config.minDispatchWei) {
    const minMstrOut = await quoteMinMstrOut(client, pendingDividendETH, config.slippageBps);
    if (minMstrOut > 0n) {
      console.log(`dispatchDividend: ${pendingDividendETH} wei -> minMstrOut ${minMstrOut}`);
      const hash = await client.writeContract({
        address: config.vaultAddress,
        abi: vaultAbi,
        functionName: "dispatchDividend",
        args: [minMstrOut, deadline],
      });
      console.log(`  tx: ${hash}`);
      await client.waitForTransactionReceipt({ hash });
    } else {
      console.log("dispatchDividend: quote came back 0, skipping this run");
    }
  }

  if (pendingLiquidityETH >= config.minDispatchWei) {
    const minLpOut = await quoteMinLpOut(client, WETH_ADDRESS, taxToken, pendingLiquidityETH, config.slippageBps);
    if (minLpOut > 0n) {
      console.log(`dispatchLiquidity: ${pendingLiquidityETH} wei -> minLpOut ${minLpOut}`);
      const hash = await client.writeContract({
        address: config.vaultAddress,
        abi: vaultAbi,
        functionName: "dispatchLiquidity",
        args: [minLpOut, deadline],
      });
      console.log(`  tx: ${hash}`);
      await client.waitForTransactionReceipt({ hash });
    } else {
      console.log("dispatchLiquidity: BRO's WETH pair doesn't exist yet (or reserves are empty) -- skipping");
    }
  }

  if (pendingBurnETH >= config.minDispatchWei) {
    const minBroOut = await quoteMinTokenOutV2(client, WETH_ADDRESS, taxToken, pendingBurnETH, config.slippageBps);
    if (minBroOut > 0n) {
      console.log(`dispatchBurn: ${pendingBurnETH} wei -> minBroOut ${minBroOut}`);
      const hash = await client.writeContract({
        address: config.vaultAddress,
        abi: vaultAbi,
        functionName: "dispatchBurn",
        args: [minBroOut, deadline],
      });
      console.log(`  tx: ${hash}`);
      await client.waitForTransactionReceipt({ hash });
    } else {
      console.log("dispatchBurn: BRO's WETH pair doesn't exist yet (or reserves are empty) -- skipping");
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
