"use client";

import { useReducer, useCallback } from "react";
import { Token, Route, TradeResult, SpotMeta, MultiHopResult, OrderType } from "@/lib/domain/types";
import { findRoute } from "@/lib/routing/pathfinder";
import { SPOT_PAIRS } from "@/lib/domain/pairs";
import { MOCK_ORDERBOOKS } from "@/lib/data/mock-orderbooks";
import { executeTrade, executeMultiHopTrade } from "@/lib/exchange/execute-trade";
import type { Hex } from "viem";

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
    (from: Token | null, to: Token | null, amount: number) => {
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

      dispatch({ type: "DISCOVER" });

      setTimeout(() => {
        try {
          const route = findRoute(
            from,
            to,
            amount,
            SPOT_PAIRS,
            MOCK_ORDERBOOKS,
          );
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
      }, 400);
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
