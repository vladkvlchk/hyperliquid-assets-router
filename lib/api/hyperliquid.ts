import {
  SpotBalance,
  SpotPrice,
  SpotAssetCtx,
  SpotMetaToken,
  SpotMetaUniverse,
} from "@/lib/domain/types";
import { TOKENS } from "@/lib/domain/tokens";

const API_URL = "https://api.hyperliquid.xyz/info";

/** Map Hyperliquid spot symbols to friendly display names */
const DISPLAY_ALIAS: Record<string, string> = {
  UBTC: "BTC",
  UETH: "ETH",
  USOL: "SOL",
};

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

export async function fetchSpotPrices(): Promise<SpotPrice[]> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "spotMetaAndAssetCtxs" }),
  });

  if (!res.ok) throw new Error(`Hyperliquid API error: ${res.status}`);

  const [meta, ctxs]: [
    { tokens: SpotMetaToken[]; universe: SpotMetaUniverse[] },
    SpotAssetCtx[],
  ] = await res.json();

  const tokenName = new Map(meta.tokens.map((t) => [t.index, t.name]));

  return meta.universe
    .map((pair, i) => {
      const ctx = ctxs[i];
      if (!ctx) return null;

      const mid = parseFloat(ctx.midPx);
      const prev = parseFloat(ctx.prevDayPx);
      const vol = parseFloat(ctx.dayNtlVlm);

      if (!mid || !prev) return null;

      const rawBase = tokenName.get(pair.tokens[0]) ?? `@${pair.tokens[0]}`;
      const rawQuote = tokenName.get(pair.tokens[1]) ?? `@${pair.tokens[1]}`;
      const base = DISPLAY_ALIAS[rawBase] ?? rawBase;
      const quote = DISPLAY_ALIAS[rawQuote] ?? rawQuote;

      return {
        pair: `${base}/${quote}`,
        midPx: mid,
        prevDayPx: prev,
        change24h: ((mid - prev) / prev) * 100,
        volume24h: vol,
      } satisfies SpotPrice;
    })
    .filter((p): p is SpotPrice => {
      if (!p) return false;
      const base = p.pair.split("/")[0];
      return base in TOKENS || p.volume24h > 0;
    })
    .sort((a, b) => {
      const aKnown = a.pair.split("/")[0] in TOKENS ? 1 : 0;
      const bKnown = b.pair.split("/")[0] in TOKENS ? 1 : 0;
      if (aKnown !== bKnown) return bKnown - aKnown;
      return b.volume24h - a.volume24h;
    });
}
