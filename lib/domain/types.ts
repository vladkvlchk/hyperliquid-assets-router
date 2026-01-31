/**
 * Core domain types for the Hyperliquid asset routing system.
 * These types model the spot market structure needed for multi-hop routing.
 */

export interface Token {
  /** Unique symbol used as identifier (e.g. "HYPE", "USDC") */
  symbol: string;
  /** Human-readable name */
  name: string;
  /** Decimal precision for display and calculation */
  decimals: number;
}

export interface SpotPair {
  /** Unique pair identifier (e.g. "HYPE/USDC") */
  id: string;
  /** Base token (the token being bought/sold) */
  base: Token;
  /** Quote token (the token used for pricing) */
  quote: Token;
}

export interface OrderbookLevel {
  price: number;
  size: number;
}

export interface OrderbookSnapshot {
  pairId: string;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  /** Timestamp in ms — used to detect stale data */
  timestamp: number;
}

/** Direction of trade through a pair */
export type TradeSide = "buy" | "sell";

/** A single hop in a multi-hop route */
export interface RouteHop {
  pair: SpotPair;
  side: TradeSide;
  /** Estimated execution price for this hop */
  estimatedPrice: number;
  /** Estimated output amount from this hop */
  estimatedOutput: number;
}

/** A complete route from token A to token B */
export interface Route {
  from: Token;
  to: Token;
  hops: RouteHop[];
  /** Total estimated output amount */
  estimatedOutput: number;
  /** Warnings generated during route discovery */
  warnings: RouteWarning[];
}

export interface RouteWarning {
  type: "low_liquidity" | "stale_data" | "high_slippage" | "long_route";
  message: string;
  severity: "info" | "warn" | "error";
}

export interface SpotBalance {
  coin: string;
  token: number;
  total: string;
  hold: string;
  entryNtl: string;
}

export interface SpotAssetCtx {
  coin: string;
  midPx: string;
  markPx: string;
  prevDayPx: string;
  dayNtlVlm: string;
}

export interface SpotMetaToken {
  name: string;
  index: number;
  isCanonical: boolean;
}

export interface SpotMetaUniverse {
  tokens: [number, number];
  name: string;
  index: number;
  isCanonical: boolean;
}

export interface SpotPrice {
  pair: string;
  midPx: number;
  prevDayPx: number;
  change24h: number;
  volume24h: number;
}
