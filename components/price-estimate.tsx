import { Route } from "@/lib/domain/types";

interface PriceEstimateProps {
  route: Route;
  inputAmount: number;
}

export function PriceEstimate({ route, inputAmount }: PriceEstimateProps) {
  const effectiveRate =
    inputAmount > 0 ? route.estimatedOutput / inputAmount : 0;

  return (
    <div className="border border-hl-border bg-hl-deep p-3">
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-[11px] uppercase tracking-wider text-hl-muted">
          Estimated output
        </span>
        <span className="font-mono text-sm text-hl-text">
          {route.estimatedOutput.toFixed(4)} {route.to.symbol}
        </span>
      </div>
      <div className="flex justify-between items-baseline">
        <span className="text-[11px] uppercase tracking-wider text-hl-muted">
          Effective rate
        </span>
        <span className="font-mono text-xs text-hl-muted">
          1 {route.from.symbol} &asymp; {effectiveRate.toFixed(6)}{" "}
          {route.to.symbol}
        </span>
      </div>
    </div>
  );
}
