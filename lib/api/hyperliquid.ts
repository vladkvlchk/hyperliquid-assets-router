import { SpotBalance } from "@/lib/domain/types";

const API_URL = "https://api.hyperliquid.xyz/info";

export async function fetchSpotBalances(
  address: string,
): Promise<SpotBalance[]> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "spotClearinghouseState",
      user: address,
    }),
  });

  if (!res.ok) throw new Error(`Hyperliquid API error: ${res.status}`);

  const data = await res.json();
  return data.balances as SpotBalance[];
}
