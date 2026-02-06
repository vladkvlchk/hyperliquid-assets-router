"use client";

import { useState } from "react";
import { OpenOrder, SpotMeta } from "@/lib/domain/types";
import { cancelOrder } from "@/lib/exchange/cancel-order";
import { Panel, SectionLabel } from "./panel";
import type { Hex } from "viem";

interface OpenOrdersProps {
  orders: OpenOrder[];
  agentPrivateKey: Hex;
  spotMeta: SpotMeta;
  onOrderCancelled: () => void;
}

export function OpenOrders({
  orders,
  agentPrivateKey,
  spotMeta,
  onOrderCancelled,
}: OpenOrdersProps) {
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (orders.length === 0) {
    return null;
  }

  // Find asset ID from coin name (e.g., "HYPE/USDC" or "@107" -> 10000 + index)
  function getAssetId(coin: string): number | null {
    // Direct match by pair name
    const pair = spotMeta.universe.find((p) => p.name === coin);
    if (pair) {
      return 10000 + pair.index;
    }
    // Handle @N format (spot asset index)
    if (coin.startsWith("@")) {
      const index = parseInt(coin.slice(1), 10);
      if (!isNaN(index)) {
        return 10000 + index;
      }
    }
    return null;
  }

  // Get display name for coin (convert "@107" to "HYPE/USDC")
  function getDisplayName(coin: string): string {
    if (coin.startsWith("@")) {
      const index = parseInt(coin.slice(1), 10);

      // Try to find by index property
      const pair = spotMeta.universe.find((p) => p.index === index);
      if (pair) {
        // The pair name might itself be "@N", extract base token name
        if (pair.name.startsWith("@")) {
          const baseToken = spotMeta.tokens.find((t) => t.index === pair.tokens[0]);
          if (baseToken) {
            return baseToken.name;
          }
        }
        return pair.name;
      }
    }
    return coin;
  }

  async function handleCancel(order: OpenOrder) {
    setCancellingId(order.oid);
    setError(null);

    try {
      const assetId = getAssetId(order.coin);
      if (assetId === null) {
        setError(`Unknown asset: ${order.coin}`);
        setCancellingId(null);
        return;
      }

      const result = await cancelOrder({
        assetId,
        orderId: order.oid,
        agentPrivateKey,
      });

      if (result.status === "error") {
        setError(result.error ?? "Cancel failed");
      } else {
        onOrderCancelled();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <Panel>
      <SectionLabel>Open Orders</SectionLabel>
      <div className="mt-2 space-y-2">
        {orders.map((order) => (
          <div
            key={order.oid}
            className="flex items-center justify-between text-xs border-b border-hl-border/30 pb-2 last:border-0 last:pb-0"
          >
            <div className="flex flex-col gap-0.5">
              <div className="text-hl-text">
                <span
                  className={
                    order.side === "B" ? "text-green-400" : "text-red-400"
                  }
                >
                  {order.side === "B" ? "Buy" : "Sell"}
                </span>{" "}
                <span className="text-hl-muted">{order.sz}</span>{" "}
                {getDisplayName(order.coin)}
                <span className="text-hl-text-dim">
                  {" "}for {(parseFloat(order.sz) * parseFloat(order.limitPx)).toFixed(2)} USDC
                </span>
              </div>
              <div className="text-[10px] text-hl-text-dim">
                Limit ${order.limitPx}
              </div>
            </div>
            <button
              onClick={() => handleCancel(order)}
              disabled={cancellingId === order.oid}
              className="px-2 py-1 text-[10px] text-hl-error border border-hl-error/30
                         hover:bg-hl-error/10 transition-colors cursor-pointer
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancellingId === order.oid ? "..." : "Cancel"}
            </button>
          </div>
        ))}
        {error && (
          <div className="text-[10px] text-hl-error mt-1">{error}</div>
        )}
      </div>
    </Panel>
  );
}
