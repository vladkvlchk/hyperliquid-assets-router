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

export interface SpotPrice {
  pair: string;
  midPx: number;
  prevDayPx: number;
  change24h: number;
  volume24h: number;
}

/* ── Spot metadata (from spotMeta endpoint) ── */

export interface SpotMetaToken {
  name: string;
  szDecimals: number;
  weiDecimals: number;
  index: number;
  tokenId: string;
  isCanonical: boolean;
}

export interface SpotMetaPair {
  name: string;
  tokens: [number, number]; // [base_token_idx, quote_token_idx]
  index: number;
  isCanonical: boolean;
}

export interface SpotMeta {
  tokens: SpotMetaToken[];
  universe: SpotMetaPair[];
}

/* ── Order wire format (exchange endpoint) ── */

export type OrderType = "market" | "limit";
export type TimeInForce = "Ioc" | "Gtc" | "Alo";

export interface OrderWire {
  a: number;
  b: boolean;
  p: string;
  s: string;
  r: boolean;
  t: { limit: { tif: TimeInForce } };
}

export interface OrderAction {
  type: "order";
  orders: OrderWire[];
  grouping: "na";
}

export interface CancelWire {
  a: number;
  o: number;
}

export interface CancelAction {
  type: "cancel";
  cancels: CancelWire[];
}

export interface CancelResult {
  status: "success" | "error";
  error?: string;
}

export interface OpenOrder {
  coin: string;
  oid: number;
  side: "B" | "A"; // B = buy, A = ask/sell
  sz: string;
  limitPx: string;
  timestamp: number;
}

/* ── L2 orderbook ── */

export interface L2Level {
  px: string;
  sz: string;
  n: number;
}

export interface L2Book {
  coin: string;
  time: number;
  levels: [L2Level[], L2Level[]]; // [bids, asks]
}

/* ── Trade result ── */

export interface TradeResult {
  status: "filled" | "resting" | "error";
  totalSz?: string;
  avgPx?: string;
  oid?: number;
  error?: string;
}

/** Result of a single hop in a multi-hop trade */
export interface HopResult {
  hopIndex: number;
  fromSymbol: string;
  toSymbol: string;
  result: TradeResult;
}

/** Result of a multi-hop trade execution */
export interface MultiHopResult {
  status: "completed" | "partial" | "error";
  completedHops: HopResult[];
  failedHop?: HopResult;
  finalOutput?: string;
  error?: string;
}
