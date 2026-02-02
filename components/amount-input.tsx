"use client";

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  tokenSymbol?: string;
  maxAmount?: string;
}

export function AmountInput({
  value,
  onChange,
  tokenSymbol,
  maxAmount,
}: AmountInputProps) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-hl-muted mb-1">
        Amount
      </div>
      <div className="flex items-center border border-hl-border bg-hl-input">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "" || /^\d*\.?\d*$/.test(v)) {
              onChange(v);
            }
          }}
          placeholder="0.00"
          className="flex-1 px-3 py-2 bg-transparent text-hl-text outline-none font-mono text-sm"
        />
        {maxAmount && (
          <button
            onClick={() => onChange(maxAmount)}
            className="px-2 py-0.5 mr-1 text-[10px] uppercase tracking-wider text-hl-accent hover:text-hl-accent/70 transition-colors cursor-pointer"
          >
            Max
          </button>
        )}
        {tokenSymbol && (
          <span className="pr-3 text-hl-text-dim text-xs font-medium">
            {tokenSymbol}
          </span>
        )}
      </div>
    </div>
  );
}
