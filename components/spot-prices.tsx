"use client";

import { useState, useMemo } from "react";
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

export function SpotPrices({ onSelect }: { onSelect?: (name: string) => void }) {
  const { data: prices, isLoading } = useSpotPrices();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!prices) return [];
    if (!query) return prices;
    const q = query.toLowerCase();
    return prices.filter((p) => p.pair.toLowerCase().includes(q));
  }, [prices, query]);

  if (isLoading) {
    return (
      <div className="text-[10px] text-hl-text-dim py-4">
        Loading prices...
      </div>
    );
  }

  if (!prices?.length) return null;

  return (
    <div className="flex flex-col max-h-[70vh]">
      <div className="text-[10px] font-medium uppercase tracking-wider text-hl-muted mb-2">
        Spot Prices
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
        className="w-full px-2 py-1.5 mb-2 text-[11px] bg-hl-input border border-hl-border text-hl-text placeholder:text-hl-text-dim outline-none rounded-none"
      />
      <div className="overflow-y-auto flex-1">
        {filtered.length === 0 && (
          <div className="text-[10px] text-hl-text-dim py-2">No results</div>
        )}
        {filtered.map((p) => (
          <div
            key={p.pair}
            onClick={() => onSelect?.(p.pair)}
            className={`py-1.5 border-b border-hl-border/50 last:border-0${onSelect ? " cursor-pointer hover:bg-hl-hover/50 -mx-1 px-1 rounded" : ""}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-hl-text truncate mr-2">
                {p.pair}
              </span>
              <span className="text-[11px] text-hl-muted tabular-nums shrink-0">
                ${formatPrice(p.midPx)}
              </span>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[10px] text-hl-text-dim tabular-nums">
                {formatVolume(p.volume24h)}
              </span>
              <span
                className={`text-[10px] tabular-nums ${
                  p.change24h >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {p.change24h >= 0 ? "+" : ""}
                {p.change24h.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
