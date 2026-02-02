import {
  SpotMeta,
  OrderAction,
  OrderWire,
  TradeResult,
  TradeSide,
} from "@/lib/domain/types";
import { fetchL2Book, submitOrder } from "@/lib/api/hyperliquid";
import { floatToWire, signL1Action } from "./signing";
import type { Hex } from "viem";

/** Reverse display aliases back to Hyperliquid spot names */
const REVERSE_ALIASES: Record<string, string> = {
  BTC: "UBTC",
  ETH: "UETH",
  SOL: "USOL",
};

function toSpotName(displaySymbol: string): string {
  return REVERSE_ALIASES[displaySymbol] ?? displaySymbol;
}

const SLIPPAGE = 0.01; // 1%

export interface TradeParams {
  fromSymbol: string;
  toSymbol: string;
  amount: number;
  spotMeta: SpotMeta;
  agentPrivateKey: Hex;
}

interface ResolvedPair {
  assetId: number;
  side: TradeSide;
  pairName: string; // e.g. "PURR/USDC" as it appears in spotMeta.universe
  szDecimals: number;
}

/**
 * Resolve which Hyperliquid spot pair to use and which side (buy/sell).
 *
 * If user swaps A→B:
 *   - If pair A/B exists → SELL (sell A to get B)
 *   - If pair B/A exists → BUY  (buy B by spending A)
 */
function resolvePair(
  fromSymbol: string,
  toSymbol: string,
  meta: SpotMeta,
): ResolvedPair | null {
  const fromSpot = toSpotName(fromSymbol);
  const toSpot = toSpotName(toSymbol);

  // Build a lookup: token name → token index in spotMeta.tokens
  const tokenIndex = new Map(meta.tokens.map((t) => [t.name, t.index]));

  for (const pair of meta.universe) {
    const baseToken = meta.tokens.find((t) => t.index === pair.tokens[0]);
    const quoteToken = meta.tokens.find((t) => t.index === pair.tokens[1]);
    if (!baseToken || !quoteToken) continue;

    const baseName = baseToken.name;
    const quoteName = quoteToken.name;

    // Check if pair matches A/B → SELL base
    if (baseName === fromSpot && quoteName === toSpot) {
      return {
        assetId: 10000 + pair.index,
        side: "sell",
        pairName: pair.name,
        szDecimals: baseToken.szDecimals,
      };
    }

    // Check if pair matches B/A → BUY base
    if (baseName === toSpot && quoteName === fromSpot) {
      return {
        assetId: 10000 + pair.index,
        side: "buy",
        pairName: pair.name,
        szDecimals: baseToken.szDecimals,
      };
    }
  }

  return null;
}

/**
 * Execute a market-like spot trade on Hyperliquid.
 *
 * Steps:
 * 1. Resolve the spot pair and trade side from spotMeta
 * 2. Fetch the L2 orderbook for the pair
 * 3. Calculate IOC price with slippage tolerance
 * 4. Build, sign, and submit the order
 */
export async function executeTrade(
  params: TradeParams,
): Promise<TradeResult> {
  const { fromSymbol, toSymbol, amount, spotMeta, agentPrivateKey } = params;

  // 1. Resolve pair
  const resolved = resolvePair(fromSymbol, toSymbol, spotMeta);
  if (!resolved) {
    return {
      status: "error",
      error: `No direct spot pair found for ${fromSymbol} → ${toSymbol}`,
    };
  }

  // 2. Fetch L2 book using the pair name (e.g. "PURR/USDC")
  const book = await fetchL2Book(resolved.pairName);
  const [bids, asks] = book.levels;

  if (!bids.length || !asks.length) {
    return { status: "error", error: "Orderbook is empty" };
  }

  const bestBid = parseFloat(bids[0].px);
  const bestAsk = parseFloat(asks[0].px);
  const midPx = (bestBid + bestAsk) / 2;

  // 3. Calculate price and size
  let price: number;
  let size: number;

  if (resolved.side === "sell") {
    // Selling base token: user provides base amount
    size = amount;
    price = midPx * (1 - SLIPPAGE); // Sell at slightly worse price for guaranteed fill
  } else {
    // Buying base token: user provides quote amount, convert to base size
    size = amount / midPx;
    price = midPx * (1 + SLIPPAGE); // Buy at slightly worse price for guaranteed fill
  }

  // Round size to the pair's szDecimals
  const sizeFactor = Math.pow(10, resolved.szDecimals);
  size = Math.floor(size * sizeFactor) / sizeFactor;

  if (size <= 0) {
    return { status: "error", error: "Trade size too small" };
  }

  // Validate minimum order value ($10)
  const orderValue = resolved.side === "sell" ? size * midPx : amount;
  if (orderValue < 10) {
    return {
      status: "error",
      error: `Order value ($${orderValue.toFixed(2)}) is below the $10 minimum`,
    };
  }

  // 4. Build order wire
  const orderWire: OrderWire = {
    a: resolved.assetId,
    b: resolved.side === "buy",
    p: floatToWire(price),
    s: floatToWire(size),
    r: false,
    t: { limit: { tif: "Ioc" } },
  };

  const action: OrderAction = {
    type: "order",
    orders: [orderWire],
    grouping: "na",
  };

  // 5. Sign with agent private key (no wallet popup)
  const nonce = Date.now();
  const signature = await signL1Action(action, nonce, agentPrivateKey);

  // 6. Submit
  return submitOrder(action, nonce, signature);
}
