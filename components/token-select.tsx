"use client";

import { useState, useRef, useEffect } from "react";
import { Token } from "@/lib/domain/types";
import { TOKEN_LIST } from "@/lib/domain/tokens";

interface TokenSelectProps {
  label: string;
  value: Token | null;
  onChange: (token: Token) => void;
  exclude?: string;
}

export function TokenSelect({
  label,
  value,
  onChange,
  exclude,
}: TokenSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const available = TOKEN_LIST.filter((t) => t.symbol !== exclude);

  return (
    <div ref={ref} className="relative">
      <div className="text-[11px] font-medium uppercase tracking-wider text-hl-muted mb-1">
        {label}
      </div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 border border-hl-border bg-hl-input text-left hover:border-hl-border-hover transition-colors cursor-pointer"
      >
        <span
          className={value ? "text-hl-text font-medium" : "text-hl-text-dim"}
        >
          {value ? value.symbol : "Select token"}
        </span>
        <span className="text-hl-text-dim text-xs">&#x25BC;</span>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 border border-hl-border bg-hl-input max-h-[200px] overflow-y-auto">
          {available.map((token) => (
            <button
              key={token.symbol}
              onClick={() => {
                onChange(token);
                setOpen(false);
              }}
              className="w-full px-3 py-2 text-left hover:bg-hl-hover flex items-center gap-3 text-sm cursor-pointer"
            >
              <span className="font-medium text-hl-text w-[60px]">
                {token.symbol}
              </span>
              <span className="text-hl-text-dim text-xs">{token.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
