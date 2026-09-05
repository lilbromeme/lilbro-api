import { createWalletClient, http, publicActions, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { erc20Abi, vaultAbi } from "./abis.js";
import { BLOCKSCOUT_BASE, BURN_ADDRESS, config } from "./config.js";

const chain = { id: 4663, name: "Robinhood Chain", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [config.rpcUrl] } } };

// Blockscout returns a browser-challenge page instead of JSON to requests
// without a normal browser User-Agent -- this was confirmed directly while
// building this project, not a guess.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

interface HolderEntry {
  address: string;
  value: string; // raw token amount, as a decimal string
}

/// Fetches every current BRO holder and raw balance from Robinhood Chain's
/// block explorer, paginating through Blockscout's v2 API.
/// @dev This is a live snapshot at call time, not tied to a specific block
///      number -- Blockscout's holders endpoint doesn't expose historical
///      snapshots. For a token trading actively between snapshot and the
///      pushDividends/creditDividends transaction landing, this has an
///      inherent small window for balances to shift; this is a known,
///      accepted imprecision, not a security issue, since the contract
///      itself only limits *total* payout to real MSTR held (see
///      BROMSTRVault.sol's NatSpec on distribution design) -- it never
///      trusts this snapshot to be authoritative on-chain.
async function fetchHolders(token: Address): Promise<HolderEntry[]> {
  const holders: HolderEntry[] = [];
  let nextPageParams: Record<string, string> | null = null;

  for (;;) {
    const url = new URL(`${BLOCKSCOUT_BASE}/api/v2/tokens/${token}/holders`);
    if (nextPageParams) {
      for (const [k, v] of Object.entries(nextPageParams)) url.searchParams.set(k, v);
    }

    const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA, Accept: "application/json" } });
    if (!res.ok) throw new Error(`Blockscout holders fetch failed: ${res.status}`);
    const data = (await res.json()) as { items: Array<{ address: { hash: string }; value: string }>; next_page_params: Record<string, string> | null };

    for (const item of data.items) {
      holders.push({ address: item.address.hash, value: item.value });
    }

    if (!data.next_page_params) break;
    nextPageParams = data.next_page_params;
  }

  return holders;
}

async function main() {
  const account = privateKeyToAccount(config.keeperPrivateKey);
  const client = createWalletClient({ account, chain, transport: http(config.rpcUrl) }).extend(publicActions);

  const [taxToken, mstrToken, instantDividend, reservedForClaims] = await Promise.all([
    client.readContract({ address: config.vaultAddress, abi: vaultAbi, functionName: "taxToken" }) as Promise<Address>,
    client.readContract({ address: config.vaultAddress, abi: vaultAbi, functionName: "mstrToken" }) as Promise<Address>,
    client.readContract({ address: config.vaultAddress, abi: vaultAbi, functionName: "instantDividend" }) as Promise<boolean>,
    client.readContract({ address: config.vaultAddress, abi: vaultAbi, functionName: "reservedForClaims" }) as Promise<bigint>,
  ]);

  const mstrBalance = (await client.readContract({
    address: mstrToken,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [config.vaultAddress],
  })) as bigint;

  const available = mstrBalance - reservedForClaims;
  if (available <= 0n) {
    console.log("No unreserved MSTR available to distribute -- nothing to do.");
    return;
  }

  const excluded = new Set([
    config.vaultAddress.toLowerCase(),
    BURN_ADDRESS.toLowerCase(),
    "0x0000000000000000000000000000000000000000",
    ...config.excludedHolderAddresses,
  ]);

  const rawHolders = await fetchHolders(taxToken);
  const eligible = rawHolders
    .map((h) => ({ address: h.address as Address, balance: BigInt(h.value) }))
    .filter((h) => h.balance > 0n && !excluded.has(h.address.toLowerCase()));

  const totalEligibleSupply = eligible.reduce((sum, h) => sum + h.balance, 0n);
  if (totalEligibleSupply === 0n) {
    console.log("No eligible holders found -- nothing to do.");
    return;
  }

  const shares = eligible
    .map((h) => ({ address: h.address, amount: (available * h.balance) / totalEligibleSupply }))
    .filter((s) => s.amount > 0n);

  console.log(`Distributing ${available} MSTR across ${shares.length} eligible holders (of ${eligible.length} total) via ${instantDividend ? "pushDividends" : "creditDividends"}`);

  for (let i = 0; i < shares.length; i += config.dividendBatchSize) {
    const batch = shares.slice(i, i + config.dividendBatchSize);
    const holders = batch.map((s) => s.address);
    const amounts = batch.map((s) => s.amount);

    const hash = await client.writeContract({
      address: config.vaultAddress,
      abi: vaultAbi,
      functionName: instantDividend ? "pushDividends" : "creditDividends",
      args: [holders, amounts],
    });
    console.log(`  batch ${i / config.dividendBatchSize + 1}: ${batch.length} holders, tx ${hash}`);
    await client.waitForTransactionReceipt({ hash });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
