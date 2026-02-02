"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Token } from "@/lib/domain/types";
import { TOKEN_LIST } from "@/lib/domain/tokens";

interface TokenSelectProps {
  label: string;
  value: Token | null;
  onChange: (token: Token) => void;
  exclude?: string;
  /** Override the default token list (e.g. with user-held tokens) */
  tokens?: Token[];
}

export function TokenSelect({
  label,
  value,
  onChange,
  exclude,
  tokens,
}: TokenSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlighted(0);
      inputRef.current?.focus();
    }
  }, [open]);

  const available = useMemo(() => {
    const list = (tokens ?? TOKEN_LIST).filter((t) => t.symbol !== exclude);
    if (!query) return list;
    const q = query.toLowerCase();
    return list.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q),
    );
  }, [tokens, exclude, query]);

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlighted(0);
  }, [available.length]);

  // Scroll highlighted item into view
  useEffect(() => {
    const el = listRef.current?.children[highlighted] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  const select = useCallback(
    (token: Token) => {
      onChange(token);
      setOpen(false);
    },
    [onChange],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlighted((i) => Math.min(i + 1, available.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlighted((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (available[highlighted]) select(available[highlighted]);
        break;
      case "Escape":
        setOpen(false);
        break;
    }
  }

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
        <div className="absolute z-50 top-full left-0 right-0 mt-1 border border-hl-border bg-hl-input">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search..."
            className="w-full px-3 py-2 text-sm bg-transparent text-hl-text placeholder:text-hl-text-dim outline-none border-b border-hl-border"
          />
          <div ref={listRef} className="max-h-[200px] overflow-y-auto">
            {available.length === 0 && (
              <div className="px-3 py-2 text-xs text-hl-text-dim">
                No tokens found
              </div>
            )}
            {available.map((token, i) => (
              <button
                key={token.symbol}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => select(token)}
                className={`w-full px-3 py-2 text-left flex items-center gap-3 text-sm cursor-pointer ${
                  i === highlighted ? "bg-hl-hover" : "hover:bg-hl-hover"
                }`}
              >
                <span className="font-medium text-hl-text w-[60px]">
                  {token.symbol}
                </span>
                <span className="text-hl-text-dim text-xs">{token.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
