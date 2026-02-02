import { SpotBalance, SpotPrice } from "@/lib/domain/types";
import { TOKENS } from "@/lib/domain/tokens";

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

interface Candle {
  o: string;
  v: string;
}

async function fetchAllMids(): Promise<Record<string, string>> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "allMids", dex: "" }),
  });
  if (!res.ok) throw new Error(`Hyperliquid API error: ${res.status}`);
  return res.json();
}

async function fetchCandles(coin: string): Promise<Candle[]> {
  const now = Date.now();
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "candleSnapshot",
      req: {
        coin,
        interval: "1h",
        startTime: now - 86_400_000,
        endTime: now,
      },
    }),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchSpotPrices(): Promise<SpotPrice[]> {
  const mids = await fetchAllMids();

  // Filter to named assets (skip @N spot indices)
  const assets = Object.entries(mids)
    .filter(([name]) => !name.startsWith("@"))
    .map(([name, px]) => ({ name, midPx: parseFloat(px) }))
    .filter((a) => a.midPx > 0);

  // Prioritise known tokens, then sort alphabetically for stable order
  assets.sort((a, b) => {
    const aKnown = a.name in TOKENS ? 1 : 0;
    const bKnown = b.name in TOKENS ? 1 : 0;
    if (aKnown !== bKnown) return bKnown - aKnown;
    return a.name.localeCompare(b.name);
  });

  const top = assets.slice(0, 25);

  // Fetch 24h candles in parallel
  const candleResults = await Promise.all(
    top.map((a) => fetchCandles(a.name)),
  );

  return top
    .map((a, i) => {
      const candles = candleResults[i];
      const open24h = candles.length ? parseFloat(candles[0].o) : 0;
      const volume24h = candles.reduce((sum, c) => sum + parseFloat(c.v), 0);

      return {
        pair: a.name,
        midPx: a.midPx,
        prevDayPx: open24h,
        change24h: open24h ? ((a.midPx - open24h) / open24h) * 100 : 0,
        volume24h,
      } satisfies SpotPrice;
    })
    .sort((a, b) => {
      const aKnown = a.pair in TOKENS ? 1 : 0;
      const bKnown = b.pair in TOKENS ? 1 : 0;
      if (aKnown !== bKnown) return bKnown - aKnown;
      return b.volume24h - a.volume24h;
    });
}
