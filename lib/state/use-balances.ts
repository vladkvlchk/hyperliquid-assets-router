import { useQuery } from "@tanstack/react-query";
import { fetchSpotBalances } from "@/lib/api/hyperliquid";

export function useBalances(address: string | undefined) {
  return useQuery({
    queryKey: ["spotBalances", address],
    queryFn: () => fetchSpotBalances(address!),
    enabled: !!address,
    refetchInterval: 10_000,
  });
}
