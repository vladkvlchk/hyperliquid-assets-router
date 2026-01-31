import { useQuery } from "@tanstack/react-query";
import { fetchSpotPrices } from "@/lib/api/hyperliquid";

export function useSpotPrices() {
  return useQuery({
    queryKey: ["spotPrices"],
    queryFn: fetchSpotPrices,
    refetchInterval: 10_000,
  });
}
