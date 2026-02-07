"use client";

import { useReducer, useCallback } from "react";
import { Token, Route, TradeResult, SpotMeta, MultiHopResult, OrderType, OrderbookSnapshot, SpotPair } from "@/lib/domain/types";
import { findRoute } from "@/lib/routing/pathfinder";
import { fetchL2Book } from "@/lib/api/hyperliquid";
import { executeTrade, executeMultiHopTrade } from "@/lib/exchange/execute-trade";
import { TOKENS, displayName } from "@/lib/domain/tokens";
import type { Hex } from "viem";

/** Convert L2Book to OrderbookSnapshot format */
async function fetchOrderbookSnapshot(pairId: string): Promise<OrderbookSnapshot | null> {
  try {
    const book = await fetchL2Book(pairId);
    return {
      pairId,
      bids: book.levels[0].map((l) => ({ price: parseFloat(l.px), size: parseFloat(l.sz) })),
      asks: book.levels[1].map((l) => ({ price: parseFloat(l.px), size: parseFloat(l.sz) })),
      timestamp: book.time,
    };
  } catch {
    return null;
  }
}

/** Build SpotPair from spotMeta */
function buildPairsFromMeta(spotMeta: SpotMeta): SpotPair[] {
  return spotMeta.universe.map((pair) => {
    const baseToken = spotMeta.tokens.find((t) => t.index === pair.tokens[0]);
    const quoteToken = spotMeta.tokens.find((t) => t.index === pair.tokens[1]);
    // Apply display name aliases (UETH -> ETH, UBTC -> BTC, etc.)
    const baseName = displayName(baseToken?.name ?? "UNKNOWN");
    const quoteName = displayName(quoteToken?.name ?? "UNKNOWN");
    return {
      id: pair.name,
      base: TOKENS[baseName] ?? { symbol: baseName, name: baseName, decimals: 4 },
      quote: TOKENS[quoteName] ?? { symbol: quoteName, name: quoteName, decimals: 4 },
    };
  });
}

/**
 * Explicit state machine for route discovery + trade execution.
 *
 * States:
 *   idle              → User hasn't initiated a search
 *   discovering       → Route computation in progress
 *   route_found       → Valid route discovered
 *   no_route          → No path exists between selected tokens
 *   error             → Something went wrong
 *   executing         → Trade signing + submission in progress
 *   executed          → Trade completed successfully
 *   execution_error   → Trade failed
 *
 * No implicit or magical state — every transition is an explicit dispatch.
 */

export type RouteState =
  | { status: "idle" }
  | { status: "discovering" }
  | { status: "route_found"; route: Route }
  | { status: "no_route"; from: Token; to: Token }
  | { status: "error"; message: string }
  | { status: "executing"; route: Route; currentHop?: number }
  | { status: "executed"; route: Route; result: TradeResult | MultiHopResult }
  | { status: "execution_error"; route: Route; message: string };

type RouteAction =
  | { type: "DISCOVER" }
  | { type: "ROUTE_FOUND"; route: Route }
  | { type: "NO_ROUTE"; from: Token; to: Token }
  | { type: "ERROR"; message: string }
  | { type: "RESET" }
  | { type: "EXECUTE"; route: Route }
  | { type: "HOP_PROGRESS"; route: Route; currentHop: number }
  | { type: "EXECUTED"; route: Route; result: TradeResult | MultiHopResult }
  | { type: "EXECUTION_ERROR"; route: Route; message: string };

function routeReducer(_state: RouteState, action: RouteAction): RouteState {
  switch (action.type) {
    case "DISCOVER":
      return { status: "discovering" };
    case "ROUTE_FOUND":
      return { status: "route_found", route: action.route };
    case "NO_ROUTE":
      return { status: "no_route", from: action.from, to: action.to };
    case "ERROR":
      return { status: "error", message: action.message };
    case "RESET":
      return { status: "idle" };
    case "EXECUTE":
      return { status: "executing", route: action.route };
    case "HOP_PROGRESS":
      return { status: "executing", route: action.route, currentHop: action.currentHop };
    case "EXECUTED":
      return { status: "executed", route: action.route, result: action.result };
    case "EXECUTION_ERROR":
      return {
        status: "execution_error",
        route: action.route,
        message: action.message,
      };
  }
}

export function useRouteMachine() {
  const [state, dispatch] = useReducer(routeReducer, { status: "idle" });

  const discoverRoute = useCallback(
    async (from: Token | null, to: Token | null, amount: number, spotMeta: SpotMeta | undefined) => {
      if (!from || !to) {
        dispatch({ type: "ERROR", message: "Select both tokens" });
        return;
      }

      if (from.symbol === to.symbol) {
        dispatch({
          type: "ERROR",
          message: "Source and destination must differ",
        });
        return;
      }

      if (amount <= 0) {
        dispatch({
          type: "ERROR",
          message: "Amount must be greater than zero",
        });
        return;
      }

      if (!spotMeta) {
        dispatch({ type: "ERROR", message: "Loading market data..." });
        return;
      }

      dispatch({ type: "DISCOVER" });

      try {
        // Build pairs from spotMeta
        const allPairs = buildPairsFromMeta(spotMeta);

        // First, check for direct pair (1 hop)
        const directPair = allPairs.find(
          (p) =>
            (p.base.symbol === from.symbol && p.quote.symbol === to.symbol) ||
            (p.base.symbol === to.symbol && p.quote.symbol === from.symbol)
        );

        let relevantPairs: SpotPair[];
        if (directPair) {
          // Direct route exists, only fetch that orderbook
          relevantPairs = [directPair];
        } else {
          // No direct route, find pairs for 2-hop routes via common intermediaries
          // Common intermediaries: USDC, HYPE
          const intermediaries = ["USDC", "HYPE"];
          relevantPairs = allPairs.filter(
            (p) =>
              // Pairs connecting from token to intermediary
              ((p.base.symbol === from.symbol || p.quote.symbol === from.symbol) &&
                intermediaries.some((i) => p.base.symbol === i || p.quote.symbol === i)) ||
              // Pairs connecting intermediary to to token
              ((p.base.symbol === to.symbol || p.quote.symbol === to.symbol) &&
                intermediaries.some((i) => p.base.symbol === i || p.quote.symbol === i))
          );
        }

        const orderbookPromises = relevantPairs.map((pair) =>
          fetchOrderbookSnapshot(pair.id)
        );
        const orderbookResults = await Promise.all(orderbookPromises);

        const orderbooks: Record<string, OrderbookSnapshot> = {};
        orderbookResults.forEach((book) => {
          if (book) {
            orderbooks[book.pairId] = book;
          }
        });

        const route = findRoute(from, to, amount, relevantPairs, orderbooks);
        if (route) {
          dispatch({ type: "ROUTE_FOUND", route });
        } else {
          dispatch({ type: "NO_ROUTE", from, to });
        }
      } catch (e) {
        dispatch({
          type: "ERROR",
          message: e instanceof Error ? e.message : "Unknown error",
        });
      }
    },
    [],
  );

  const executeRoute = useCallback(
    async (
      route: Route,
      amount: number,
      spotMeta: SpotMeta,
      agentPrivateKey: Hex,
      orderType: OrderType = "market",
      limitPrice?: number,
    ) => {
      dispatch({ type: "EXECUTE", route });

      try {
        if (route.hops.length === 1) {
          // Single-hop: direct trade
          const result = await executeTrade({
            fromSymbol: route.from.symbol,
            toSymbol: route.to.symbol,
            amount,
            spotMeta,
            agentPrivateKey,
            orderType,
            limitPrice,
          });

          if (result.status === "error") {
            dispatch({
              type: "EXECUTION_ERROR",
              route,
              message: result.error ?? "Trade failed",
            });
          } else {
            dispatch({ type: "EXECUTED", route, result });
          }
        } else {
          // Multi-hop: sequential execution
          const result = await executeMultiHopTrade({
            hops: route.hops,
            initialAmount: amount,
            spotMeta,
            agentPrivateKey,
            onHopComplete: (hopIndex) => {
              dispatch({ type: "HOP_PROGRESS", route, currentHop: hopIndex + 1 });
            },
          });

          if (result.status === "error") {
            dispatch({
              type: "EXECUTION_ERROR",
              route,
              message: result.error ?? "Trade failed",
            });
          } else if (result.status === "partial") {
            dispatch({
              type: "EXECUTION_ERROR",
              route,
              message: `Partial execution: ${result.completedHops.length}/${route.hops.length} hops completed. ${result.error ?? ""}`,
            });
          } else {
            dispatch({ type: "EXECUTED", route, result });
          }
        }
      } catch (e) {
        dispatch({
          type: "EXECUTION_ERROR",
          route,
          message: e instanceof Error ? e.message : "Trade failed",
        });
      }
    },
    [],
  );

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return { state, discoverRoute, executeRoute, reset };
}
