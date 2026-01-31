import { SpotPair, TradeSide } from "@/lib/domain/types";

/**
 * Edge in the token graph — represents one direction of a tradable pair.
 *
 * Each SpotPair creates two edges:
 *   base→quote (sell side: you sell base to receive quote)
 *   quote→base (buy side: you buy base by spending quote)
 */
export interface GraphEdge {
  pair: SpotPair;
  from: string; // token symbol
  to: string; // token symbol
  side: TradeSide;
}

/**
 * Adjacency list representation of the token trading graph.
 *
 * Why a graph? Because not every token pair exists on the exchange.
 * To convert PIP→USDC, you need PIP→HYPE→USDC.
 * The graph makes these multi-hop routes discoverable.
 */
export type TokenGraph = Map<string, GraphEdge[]>;

export function buildTokenGraph(pairs: SpotPair[]): TokenGraph {
  const graph: TokenGraph = new Map();

  const addEdge = (
    from: string,
    to: string,
    pair: SpotPair,
    side: TradeSide,
  ) => {
    if (!graph.has(from)) graph.set(from, []);
    graph.get(from)!.push({ pair, from, to, side });
  };

  for (const pair of pairs) {
    // Selling base token → receive quote token
    addEdge(pair.base.symbol, pair.quote.symbol, pair, "sell");
    // Buying base token ← spend quote token
    addEdge(pair.quote.symbol, pair.base.symbol, pair, "buy");
  }

  return graph;
}
