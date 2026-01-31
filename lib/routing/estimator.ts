import { OrderbookSnapshot } from "@/lib/domain/types";
import { GraphEdge } from "./graph";

/**
 * Estimate the output of a single hop through the orderbook.
 *
 * Walks orderbook levels to simulate a market order.
 * Accounts for the spread but not for dynamic slippage from
 * our own order's market impact. A production system would need
 * a more sophisticated model here.
 *
 * For a "sell" (base→quote): we hit bids, converting base to quote.
 * For a "buy" (quote→base): we hit asks, converting quote to base.
 */
export function estimateHopOutput(
  edge: GraphEdge,
  inputAmount: number,
  book: OrderbookSnapshot,
): { output: number; price: number } {
  if (edge.side === "sell") {
    return walkBids(inputAmount, book);
  } else {
    return walkAsks(inputAmount, book);
  }
}

/**
 * Sell `amount` of base token into bids.
 * Returns quote token received and volume-weighted average price.
 */
function walkBids(
  amount: number,
  book: OrderbookSnapshot,
): { output: number; price: number } {
  let remaining = amount;
  let totalOutput = 0;

  for (const level of book.bids) {
    if (remaining <= 0) break;

    const filled = Math.min(remaining, level.size);
    totalOutput += filled * level.price;
    remaining -= filled;
  }

  // If orderbook doesn't have enough depth, extrapolate at worst bid
  if (remaining > 0 && book.bids.length > 0) {
    const worstBid = book.bids[book.bids.length - 1].price;
    totalOutput += remaining * worstBid;
  }

  const avgPrice = amount > 0 ? totalOutput / amount : 0;
  return { output: totalOutput, price: avgPrice };
}

/**
 * Buy base token by spending `amount` of quote token into asks.
 * Returns base token received and volume-weighted average price.
 */
function walkAsks(
  quoteAmount: number,
  book: OrderbookSnapshot,
): { output: number; price: number } {
  let remainingQuote = quoteAmount;
  let totalBase = 0;

  for (const level of book.asks) {
    if (remainingQuote <= 0) break;

    const maxBaseAtLevel = remainingQuote / level.price;
    const filled = Math.min(maxBaseAtLevel, level.size);
    totalBase += filled;
    remainingQuote -= filled * level.price;
  }

  // Extrapolate at worst ask if book is too thin
  if (remainingQuote > 0 && book.asks.length > 0) {
    const worstAsk = book.asks[book.asks.length - 1].price;
    totalBase += remainingQuote / worstAsk;
  }

  const avgPrice = totalBase > 0 ? quoteAmount / totalBase : 0;
  return { output: totalBase, price: avgPrice };
}
