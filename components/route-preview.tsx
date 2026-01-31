import { Route } from "@/lib/domain/types";
import { RouteStep } from "./route-step";

interface RoutePreviewProps {
  route: Route;
}

export function RoutePreview({ route }: RoutePreviewProps) {
  // Build the path label: SOL → USDC → HYPE
  const pathTokens = [route.from.symbol];
  for (const hop of route.hops) {
    if (hop.side === "sell") {
      pathTokens.push(hop.pair.quote.symbol);
    } else {
      pathTokens.push(hop.pair.base.symbol);
    }
  }

  return (
    <div>
      {/* Path visualization */}
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        {pathTokens.map((symbol, i) => (
          <div key={i} className="flex items-center gap-1">
            {i > 0 && (
              <span className="text-hl-text-dim text-xs mx-1">&rarr;</span>
            )}
            <span className="text-xs font-medium text-hl-accent bg-hl-accent/10 px-2 py-0.5 border border-hl-accent/20">
              {symbol}
            </span>
          </div>
        ))}
        <span className="text-[10px] text-hl-text-dim ml-2">
          {route.hops.length} hop{route.hops.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Hop details */}
      <div className="flex flex-col gap-1">
        {route.hops.map((hop, i) => (
          <RouteStep key={i} hop={hop} index={i} />
        ))}
      </div>
    </div>
  );
}
