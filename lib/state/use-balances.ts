import { useQuery } from "@tanstack/react-query";
import { fetchSpotBalances } from "@/lib/api/hyperliquid";

export function useBalances(address: string | undefined) {
  return useQuery({
    queryKey: ["spotBalances", address],
    queryFn: () => fetchSpotBalances(address!),
    enabled: !!address,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
}
