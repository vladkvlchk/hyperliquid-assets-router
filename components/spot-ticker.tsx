import { useSpotPrices } from "@/lib/state/use-spot-prices";

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (price >= 1) return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (price >= 0.01) return price.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return price.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `$${(vol / 1_000).toFixed(1)}K`;
  if (vol > 0) return `$${vol.toFixed(0)}`;
  return "$0";
}

export function SpotTicker({ onSelect }: { onSelect?: (name: string) => void }) {
  const { data: prices } = useSpotPrices();

  if (!prices?.length) return null;

  const items = prices.slice(0, 25);

  return (
    <div className="relative z-10 border-b border-hl-border/60 bg-hl-surface/30 backdrop-blur-xl overflow-hidden">
      <div className="flex animate-ticker whitespace-nowrap">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0">
            {items.map((p) => (
              <div
                key={`${copy}-${p.pair}`}
                onClick={() => onSelect?.(p.pair)}
                className={`inline-flex items-center gap-2 px-4 py-1.5 ${onSelect ? " cursor-pointer hover:bg-hl-hover/50" : ""}`}
              >
                <span className="text-[11px] text-hl-text font-medium">
                  {p.pair}
                </span>
                <span className="text-[11px] text-hl-muted tabular-nums">
                  ${formatPrice(p.midPx)}
                </span>
                <span
                  className={`text-[10px] tabular-nums ${
                    p.change24h >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {p.change24h >= 0 ? "+" : ""}
                  {p.change24h.toFixed(1)}%
                </span>
                <span className="text-[10px] text-hl-text-dim tabular-nums">
                  {formatVolume(p.volume24h)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
