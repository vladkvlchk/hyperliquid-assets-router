import { OrderbookSnapshot } from "@/lib/domain/types";

/**
 * Mock orderbook data — structured to simulate realistic Hyperliquid spot markets.
 *
 * Prices are approximate. Spreads and depths vary intentionally
 * to test routing quality and warning generation.
 */

const now = Date.now();

function makeOrderbook(
  pairId: string,
  midPrice: number,
  spreadBps: number,
  depth: number,
  ageMs: number = 0,
): OrderbookSnapshot {
  const halfSpread = midPrice * (spreadBps / 10000 / 2);
  const bestBid = midPrice - halfSpread;
  const bestAsk = midPrice + halfSpread;

  // Generate 5 levels of depth on each side, thinning out further from mid
  const bids = Array.from({ length: 5 }, (_, i) => ({
    price: Number((bestBid - i * halfSpread * 0.5).toFixed(6)),
    size: Number((depth * (1 - i * 0.15)).toFixed(4)),
  }));

  const asks = Array.from({ length: 5 }, (_, i) => ({
    price: Number((bestAsk + i * halfSpread * 0.5).toFixed(6)),
    size: Number((depth * (1 - i * 0.15)).toFixed(4)),
  }));

  return { pairId, bids, asks, timestamp: now - ageMs };
}

/** Staleness threshold — data older than this is considered stale */
export const STALE_THRESHOLD_MS = 30_000;

export const MOCK_ORDERBOOKS: Record<string, OrderbookSnapshot> = {
  // Major pairs: tight spreads, deep books
  "HYPE/USDC": makeOrderbook("HYPE/USDC", 24.5, 10, 5000),
  "BTC/USDC": makeOrderbook("BTC/USDC", 97500, 5, 2.5),
  "ETH/USDC": makeOrderbook("ETH/USDC", 3450, 8, 40),
  "SOL/USDC": makeOrderbook("SOL/USDC", 185, 12, 300),

  // Mid-tier: moderate spreads
  "PURR/USDC": makeOrderbook("PURR/USDC", 0.85, 30, 50000),
  "DOGE/USDC": makeOrderbook("DOGE/USDC", 0.32, 25, 100000),
  "ANIME/USDC": makeOrderbook("ANIME/USDC", 0.045, 40, 500000),
  "JEFF/USDC": makeOrderbook("JEFF/USDC", 0.012, 60, 1000000),

  // Thin/exotic pairs — wider spreads, less depth
  "PURR/HYPE": makeOrderbook("PURR/HYPE", 0.035, 50, 30000),
  // PIP/HYPE intentionally has stale data to trigger warnings
  "PIP/HYPE": makeOrderbook("PIP/HYPE", 0.0008, 80, 500000, 45_000),
};
