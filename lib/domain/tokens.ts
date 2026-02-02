import { Token } from "./types";

/**
 * Token registry — the canonical set of tokens available in the system.
 * In production, this would come from the Hyperliquid API.
 */
export const TOKENS: Record<string, Token> = {
  USDC: { symbol: "USDC", name: "USD Coin", decimals: 2 },
  HYPE: { symbol: "HYPE", name: "Hyperliquid", decimals: 4 },
  PURR: { symbol: "PURR", name: "Purr", decimals: 4 },
  BTC: { symbol: "BTC", name: "Bitcoin", decimals: 8 },
  ETH: { symbol: "ETH", name: "Ethereum", decimals: 6 },
  SOL: { symbol: "SOL", name: "Solana", decimals: 4 },
  DOGE: { symbol: "DOGE", name: "Dogecoin", decimals: 2 },
  JEFF: { symbol: "JEFF", name: "Jeff", decimals: 4 },
  PIP: { symbol: "PIP", name: "Pip", decimals: 4 },
  ANIME: { symbol: "ANIME", name: "Anime", decimals: 4 },
};

export const TOKEN_LIST: Token[] = Object.values(TOKENS);

/** Hyperliquid spot symbols → canonical display names */
const SPOT_ALIASES: Record<string, string> = {
  UBTC: "BTC",
  UETH: "ETH",
  USOL: "SOL",
};

export function displayName(coin: string): string {
  return SPOT_ALIASES[coin] ?? coin;
}
