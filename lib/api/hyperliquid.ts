import {
  SpotBalance,
  SpotPrice,
  SpotMeta,
  L2Book,
  OrderAction,
  TradeResult,
  CancelAction,
  CancelResult,
  OpenOrder,
} from "@/lib/domain/types";
import { TOKENS, displayName } from "@/lib/domain/tokens";

const INFO_URL = "https://api.hyperliquid.xyz/info";
const EXCHANGE_URL = "https://api.hyperliquid.xyz/exchange";

export async function fetchSpotBalances(
  address: string,
): Promise<SpotBalance[]> {
  const res = await fetch(INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "spotClearinghouseState",
      user: address,
    }),
  });

  if (!res.ok) throw new Error(`Hyperliquid API error: ${res.status}`);

  const data = await res.json();
  return (data.balances as SpotBalance[]).map((b) => ({
    ...b,
    coin: displayName(b.coin),
  }));
}

interface Candle {
  o: string;
  v: string;
}

async function fetchAllMids(): Promise<Record<string, string>> {
  const res = await fetch(INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "allMids", dex: "" }),
  });
  if (!res.ok) throw new Error(`Hyperliquid API error: ${res.status}`);
  return res.json();
}

async function fetchCandles(coin: string): Promise<Candle[]> {
  const now = Date.now();
  const res = await fetch(INFO_URL, {
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

  // Fetch 24h candles in batches of 5 to avoid rate limits
  const top = assets.slice(0, 15);
  const candleResults: Candle[][] = [];
  for (let i = 0; i < top.length; i += 5) {
    const batch = top.slice(i, i + 5);
    const results = await Promise.all(batch.map((a) => fetchCandles(a.name)));
    candleResults.push(...results);
  }

  const candleData = new Map(
    top.map((a, i) => [a.name, candleResults[i]]),
  );

  return assets
    .map((a) => {
      const candles = candleData.get(a.name);
      const open24h = candles?.length ? parseFloat(candles[0].o) : 0;
      const volume24h = candles?.reduce((sum, c) => sum + parseFloat(c.v), 0) ?? 0;

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

/* ── Spot metadata (asset indices for order placement) ── */

export async function fetchSpotMeta(): Promise<SpotMeta> {
  const res = await fetch(INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "spotMeta" }),
  });
  if (!res.ok) throw new Error(`Hyperliquid API error: ${res.status}`);
  return res.json();
}

/* ── L2 orderbook ── */

export async function fetchL2Book(coin: string): Promise<L2Book> {
  const res = await fetch(INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "l2Book", coin }),
  });
  if (!res.ok) throw new Error(`Hyperliquid API error: ${res.status}`);
  return res.json();
}

/* ── Open orders ── */

export async function fetchOpenOrders(address: string): Promise<OpenOrder[]> {
  const res = await fetch(INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "openOrders", user: address }),
  });
  if (!res.ok) throw new Error(`Hyperliquid API error: ${res.status}`);
  return res.json();
}

/* ── Exchange endpoint (order submission) ── */

/** Split a 65-byte hex signature into { r, s, v } as Hyperliquid expects */
function splitSig(sig: string): { r: string; s: string; v: number } {
  const raw = sig.startsWith("0x") ? sig.slice(2) : sig;
  return {
    r: "0x" + raw.slice(0, 64),
    s: "0x" + raw.slice(64, 128),
    v: parseInt(raw.slice(128, 130), 16),
  };
}

export async function submitOrder(
  action: OrderAction,
  nonce: number,
  signature: `0x${string}`,
): Promise<TradeResult> {
  const res = await fetch(EXCHANGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      nonce,
      signature: splitSig(signature),
      vaultAddress: null,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { status: "error", error: `HTTP ${res.status}: ${text}` };
  }

  const data = await res.json();

  if (data.status !== "ok") {
    return { status: "error", error: data.response ?? "Unknown error" };
  }

  const orderStatus = data.response?.data?.statuses?.[0];
  if (!orderStatus) {
    return { status: "error", error: "No order status in response" };
  }

  if (orderStatus.error) {
    return { status: "error", error: orderStatus.error };
  }

  if (orderStatus.filled) {
    return {
      status: "filled",
      totalSz: orderStatus.filled.totalSz,
      avgPx: orderStatus.filled.avgPx,
      oid: orderStatus.filled.oid,
    };
  }

  if (orderStatus.resting) {
    return { status: "resting", oid: orderStatus.resting.oid };
  }

  return { status: "error", error: "Unexpected response format" };
}

export async function submitCancel(
  action: CancelAction,
  nonce: number,
  signature: `0x${string}`,
): Promise<CancelResult> {
  const res = await fetch(EXCHANGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      nonce,
      signature: splitSig(signature),
      vaultAddress: null,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { status: "error", error: `HTTP ${res.status}: ${text}` };
  }

  const data = await res.json();

  if (data.status !== "ok") {
    return { status: "error", error: data.response ?? "Unknown error" };
  }

  return { status: "success" };
}
