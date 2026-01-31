import { SpotPair } from "./types";
import { TOKENS } from "./tokens";

function pair(base: string, quote: string): SpotPair {
  return {
    id: `${base}/${quote}`,
    base: TOKENS[base],
    quote: TOKENS[quote],
  };
}

/**
 * Available spot pairs on the exchange.
 *
 * Not every token combination has a direct pair — this is intentional.
 * The routing engine exists because direct paths don't always exist.
 *
 * Example: PIP only pairs with HYPE, so PIP→USDC requires two hops.
 */
export const SPOT_PAIRS: SpotPair[] = [
  // Major USDC pairs
  pair("HYPE", "USDC"),
  pair("PURR", "USDC"),
  pair("BTC", "USDC"),
  pair("ETH", "USDC"),
  pair("SOL", "USDC"),
  pair("DOGE", "USDC"),
  pair("JEFF", "USDC"),
  pair("ANIME", "USDC"),

  // HYPE pairs — these create interesting multi-hop routes
  pair("PURR", "HYPE"),
  pair("PIP", "HYPE"),
];
