"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSpotMeta } from "@/lib/api/hyperliquid";

/**
 * Fetches Hyperliquid spot metadata (token definitions + universe pairs).
 * Cached with a long staleTime — this data rarely changes.
 */
export function useSpotMeta() {
  return useQuery({
    queryKey: ["spotMeta"],
    queryFn: fetchSpotMeta,
    staleTime: 5 * 60_000, // 5 minutes
    refetchInterval: 5 * 60_000,
  });
}
