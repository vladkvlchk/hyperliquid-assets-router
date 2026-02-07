import { Token, Route, RouteHop, RouteWarning } from "@/lib/domain/types";
import { SpotPair, OrderbookSnapshot } from "@/lib/domain/types";
import { GraphEdge, TokenGraph, buildTokenGraph } from "./graph";
import { estimateHopOutput } from "./estimator";
import { STALE_THRESHOLD_MS } from "@/lib/data/mock-orderbooks";

/**
 * Maximum number of hops allowed in a route.
 * Keeps routes practical and cumulative fees/slippage bounded.
 */
const MAX_HOPS = 3;

/**
 * Find the shortest path between two tokens using BFS.
 *
 * Trade-off: BFS finds the path with fewest hops, not the best price.
 * A more sophisticated engine would use Dijkstra with edge weights based on
 * estimated slippage and spread. For this implementation, fewer hops generally
 * means less slippage, so BFS is a reasonable heuristic.
 *
 * Future improvement: weight edges by (spread + estimated slippage) and use
 * a priority queue to find the cheapest path, not just the shortest.
 */
function bfsPath(
  graph: TokenGraph,
  from: string,
  to: string,
): GraphEdge[] | null {
  if (from === to) return [];

  const visited = new Set<string>([from]);
  const queue: { node: string; path: GraphEdge[] }[] = [
    { node: from, path: [] },
  ];

  while (queue.length > 0) {
    const { node, path } = queue.shift()!;

    if (path.length >= MAX_HOPS) continue;

    const edges = graph.get(node) ?? [];
    for (const edge of edges) {
      if (visited.has(edge.to)) continue;

      const newPath = [...path, edge];
      if (edge.to === to) return newPath;

      visited.add(edge.to);
      queue.push({ node: edge.to, path: newPath });
    }
  }

  return null;
}

function generateWarnings(
  hops: RouteHop[],
  orderbooks: Record<string, OrderbookSnapshot>,
): RouteWarning[] {
  const warnings: RouteWarning[] = [];
  const now = Date.now();

  for (const hop of hops) {
    const book = orderbooks[hop.pair.id];
    if (!book) continue;

    const pairName = `${hop.pair.base.symbol}/${hop.pair.quote.symbol}`;

    // Stale data check
    if (now - book.timestamp > STALE_THRESHOLD_MS) {
      warnings.push({
        type: "stale_data",
        message: `Orderbook data for ${pairName} is stale (>${Math.round((now - book.timestamp) / 1000)}s old)`,
        severity: "warn",
      });
    }

    // Low liquidity: check if top-of-book depth is thin relative to trade size
    const relevantSide = hop.side === "buy" ? book.asks : book.bids;
    const topLevelSize = relevantSide[0]?.size ?? 0;
    if (topLevelSize < hop.estimatedOutput * 0.5) {
      warnings.push({
        type: "low_liquidity",
        message: `Low liquidity on ${pairName} — may experience significant slippage`,
        severity: "warn",
      });
    }
  }

  if (hops.length >= 3) {
    warnings.push({
      type: "long_route",
      message: `Route requires ${hops.length} hops — cumulative slippage may be significant`,
      severity: "info",
    });
  }

  return warnings;
}

export function findRoute(
  from: Token,
  to: Token,
  amount: number,
  pairs: SpotPair[],
  orderbooks: Record<string, OrderbookSnapshot>,
): Route | null {
  const graph = buildTokenGraph(pairs);
  const edges = bfsPath(graph, from.symbol, to.symbol);

  if (!edges || edges.length === 0) return null;

  // Walk the route, estimating output at each hop
  let currentAmount = amount;
  const hops: RouteHop[] = [];

  for (const edge of edges) {
    const book = orderbooks[edge.pair.id];
    if (!book) return null;

    const { output, price } = estimateHopOutput(edge, currentAmount, book);
    hops.push({
      pair: edge.pair,
      side: edge.side,
      estimatedPrice: price,
      estimatedOutput: output,
    });

    currentAmount = output;
  }

  const warnings = generateWarnings(hops, orderbooks);

  return {
    from,
    to,
    hops,
    estimatedOutput: currentAmount,
    warnings,
  };
}
