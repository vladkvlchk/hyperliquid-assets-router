import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchOpenOrders } from "@/lib/api/hyperliquid";

export function useOpenOrders(address: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["openOrders", address],
    queryFn: () => fetchOpenOrders(address!),
    enabled: !!address,
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["openOrders", address] });
  };

  return { ...query, invalidate };
}
