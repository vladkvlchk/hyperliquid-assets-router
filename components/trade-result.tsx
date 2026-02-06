import { TradeResult, MultiHopResult } from "@/lib/domain/types";
import { Panel } from "./panel";

interface TradeResultDisplayProps {
  result: TradeResult | MultiHopResult;
  fromSymbol: string;
  toSymbol: string;
  onReset: () => void;
}

function isMultiHopResult(result: TradeResult | MultiHopResult): result is MultiHopResult {
  return "completedHops" in result;
}

export function TradeResultDisplay({
  result,
  fromSymbol,
  toSymbol,
  onReset,
}: TradeResultDisplayProps) {
  // Multi-hop result
  if (isMultiHopResult(result)) {
    if (result.status === "completed") {
      return (
        <Panel>
          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-medium uppercase tracking-wider text-green-400">
              Multi-Hop Trade Completed
            </div>
            <div className="text-xs text-hl-text space-y-1">
              <div>
                {result.completedHops.length} hops executed successfully
              </div>
              {result.finalOutput && (
                <div>
                  Final output:{" "}
                  <span className="text-hl-muted tabular-nums">
                    {parseFloat(result.finalOutput).toFixed(4)} {toSymbol}
                  </span>
                </div>
              )}
              <div className="text-[10px] text-hl-text-dim mt-2">
                {result.completedHops.map((hop, i) => (
                  <div key={i}>
                    Hop {i + 1}: {hop.fromSymbol} → {hop.toSymbol}
                    {hop.result.totalSz && ` (${hop.result.totalSz} @ $${hop.result.avgPx})`}
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={onReset}
              className="mt-1 text-[10px] text-hl-accent hover:text-hl-accent/70 transition-colors cursor-pointer self-start"
            >
              New Trade
            </button>
          </div>
        </Panel>
      );
    }

    // Partial or error for multi-hop
    return (
      <Panel>
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-medium uppercase tracking-wider text-hl-warn">
            {result.status === "partial" ? "Partial Execution" : "Trade Failed"}
          </div>
          <div className="text-xs text-hl-text">
            {result.completedHops.length} of {result.completedHops.length + 1} hops completed
          </div>
          {result.error && (
            <div className="text-xs text-hl-error">{result.error}</div>
          )}
          <button
            onClick={onReset}
            className="mt-1 text-[10px] text-hl-accent hover:text-hl-accent/70 transition-colors cursor-pointer self-start"
          >
            New Trade
          </button>
        </div>
      </Panel>
    );
  }

  // Single-hop filled
  if (result.status === "filled") {
    return (
      <Panel>
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-medium uppercase tracking-wider text-green-400">
            Trade Executed
          </div>
          <div className="text-xs text-hl-text space-y-1">
            <div>
              Filled{" "}
              <span className="text-hl-muted tabular-nums">
                {result.totalSz}
              </span>{" "}
              at avg price{" "}
              <span className="text-hl-muted tabular-nums">
                ${result.avgPx}
              </span>
            </div>
            {result.oid && (
              <div className="text-hl-text-dim">
                Order ID: {result.oid}
              </div>
            )}
          </div>
          <button
            onClick={onReset}
            className="mt-1 text-[10px] text-hl-accent hover:text-hl-accent/70 transition-colors cursor-pointer self-start"
          >
            New Trade
          </button>
        </div>
      </Panel>
    );
  }

  if (result.status === "resting") {
    return (
      <Panel>
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-medium uppercase tracking-wider text-hl-warn">
            Order Resting
          </div>
          <div className="text-xs text-hl-text">
            IOC order was not fully filled and is resting on the book.
          </div>
          {result.oid && (
            <div className="text-[10px] text-hl-text-dim">
              Order ID: {result.oid}
            </div>
          )}
          <button
            onClick={onReset}
            className="mt-1 text-[10px] text-hl-accent hover:text-hl-accent/70 transition-colors cursor-pointer self-start"
          >
            New Trade
          </button>
        </div>
      </Panel>
    );
  }

  return null;
}

interface TradeErrorDisplayProps {
  message: string;
  onRetry?: () => void;
  onReset: () => void;
  onResetAgent?: () => void;
}

export function TradeErrorDisplay({
  message,
  onRetry,
  onReset,
  onResetAgent,
}: TradeErrorDisplayProps) {
  return (
    <Panel>
      <div className="flex flex-col gap-2">
        <div className="text-[11px] font-medium uppercase tracking-wider text-hl-error">
          Trade Failed
        </div>
        <div className="text-xs text-hl-text">{message}</div>
        {onResetAgent && (
          <div className="text-[10px] text-hl-text-dim">
            Your trading agent may be invalid. Try resetting it.
          </div>
        )}
        <div className="flex gap-3 mt-1">
          {onResetAgent && (
            <button
              onClick={onResetAgent}
              className="text-[10px] text-orange-400 hover:text-orange-300 transition-colors cursor-pointer"
            >
              Reset Agent
            </button>
          )}
          {onRetry && !onResetAgent && (
            <button
              onClick={onRetry}
              className="text-[10px] text-hl-accent hover:text-hl-accent/70 transition-colors cursor-pointer"
            >
              Retry
            </button>
          )}
          <button
            onClick={onReset}
            className="text-[10px] text-hl-text-dim hover:text-hl-muted transition-colors cursor-pointer"
          >
            Start Over
          </button>
        </div>
      </div>
    </Panel>
  );
}
