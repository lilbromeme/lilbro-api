// One-off script, not part of the keeper itself: sanity-checks quote.ts
// against live Robinhood Chain mainnet state. Run with:
//   npx tsx src/smoke-test.ts
import { createPublicClient, http, formatEther } from "viem";
import { quoteMinMstrOut } from "./quote.js";

const client = createPublicClient({
  chain: { id: 4663, name: "Robinhood Chain", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } } },
  transport: http(),
});

const oneEth = 10n ** 18n;
const minOut = await quoteMinMstrOut(client, oneEth, 150n);
console.log(`1 ETH -> minMstrOut (1.5% slippage tolerance): ${formatEther(minOut)} MSTR`);
