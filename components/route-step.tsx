import { RouteHop } from "@/lib/domain/types";

interface RouteStepProps {
  hop: RouteHop;
  index: number;
}

export function RouteStep({ hop, index }: RouteStepProps) {
  const direction =
    hop.side === "sell"
      ? `Sell ${hop.pair.base.symbol} for ${hop.pair.quote.symbol}`
      : `Buy ${hop.pair.base.symbol} with ${hop.pair.quote.symbol}`;

  return (
    <div className="flex items-center gap-3 py-2 px-3 border border-hl-border bg-hl-deep">
      <span className="text-[10px] font-mono text-hl-text-dim w-[20px] shrink-0">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-hl-text">
          {direction}
        </div>
        <div className="text-[10px] text-hl-muted font-mono mt-0.5">
          @ {hop.estimatedPrice.toFixed(6)} &middot; out:{" "}
          {hop.estimatedOutput.toFixed(4)}
        </div>
      </div>
    </div>
  );
}
