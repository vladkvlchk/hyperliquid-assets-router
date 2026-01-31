"use client";

import { useReducer, useCallback } from "react";
import { Token, Route } from "@/lib/domain/types";
import { findRoute } from "@/lib/routing/pathfinder";
import { SPOT_PAIRS } from "@/lib/domain/pairs";
import { MOCK_ORDERBOOKS } from "@/lib/data/mock-orderbooks";

/**
 * Explicit state machine for the route discovery flow.
 *
 * States:
 *   idle            → User hasn't initiated a search
 *   discovering     → Route computation in progress
 *   route_found     → Valid route discovered
 *   no_route        → No path exists between selected tokens
 *   error           → Something went wrong
 *
 * No implicit or magical state — every transition is an explicit dispatch.
 */

type RouteState =
  | { status: "idle" }
  | { status: "discovering" }
  | { status: "route_found"; route: Route }
  | { status: "no_route"; from: Token; to: Token }
  | { status: "error"; message: string };

type RouteAction =
  | { type: "DISCOVER" }
  | { type: "ROUTE_FOUND"; route: Route }
  | { type: "NO_ROUTE"; from: Token; to: Token }
  | { type: "ERROR"; message: string }
  | { type: "RESET" };

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

      // Simulate async delay — in production this is an API call.
      // The delay keeps the UI honest about loading states.
      setTimeout(() => {
        try {
          const route = findRoute(from, to, amount, SPOT_PAIRS, MOCK_ORDERBOOKS);
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

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return { state, discoverRoute, reset };
}
