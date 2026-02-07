"use client";

import { Route, OrderType } from "@/lib/domain/types";

interface ExecuteButtonProps {
  authenticated: boolean;
  isWrongChain: boolean;
  hasAgent: boolean;
  hasSpotMeta: boolean;
  isApproving: boolean;
  approveError: string | null;
  orderType: OrderType;
  limitPrice: string;
  route: Route;
  onLogin: () => void;
  onSwitchNetwork: () => void;
  onApproveAgent: () => void;
  onExecute: () => void;
  onRevokeAgent: () => void;
}

export function ExecuteButton({
  authenticated,
  isWrongChain,
  hasAgent,
  hasSpotMeta,
  isApproving,
  approveError,
  orderType,
  limitPrice,
  route,
  onLogin,
  onSwitchNetwork,
  onApproveAgent,
  onExecute,
  onRevokeAgent,
}: ExecuteButtonProps) {
  if (!authenticated) {
    return (
      <button
        onClick={onLogin}
        className="w-full py-2 text-sm font-medium border border-hl-accent/30 text-hl-accent
                   hover:bg-hl-accent/10 transition-colors cursor-pointer"
      >
        Connect Wallet to Trade
      </button>
    );
  }

  if (isWrongChain) {
    return (
      <button
        onClick={onSwitchNetwork}
        className="w-full py-2 text-sm font-medium border border-orange-400/30 text-orange-400
                   hover:bg-orange-400/10 transition-colors cursor-pointer"
      >
        Switch to Arbitrum
      </button>
    );
  }

  if (!hasAgent) {
    return (
      <div className="flex flex-col gap-2">
        <button
          onClick={onApproveAgent}
          disabled={isApproving}
          className="w-full py-2 text-sm font-medium border border-hl-accent/30 text-hl-accent
                     hover:bg-hl-accent/10 transition-colors cursor-pointer
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isApproving ? "Approving..." : "Approve Trading Agent"}
        </button>
        <div className="text-[10px] text-hl-text-dim text-center">
          One-time wallet signature to authorize trading
        </div>
        {approveError && (
          <div className="text-[10px] text-hl-error text-center">
            {approveError}
          </div>
        )}
      </div>
    );
  }

  if (!hasSpotMeta) {
    return null;
  }

  const orderLabel = orderType === "limit" ? "Limit" : "Market";
  const buttonText =
    route.hops.length > 1
      ? `Execute ${route.hops.length}-Hop ${orderLabel}`
      : `Execute ${orderLabel} Order`;

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={onExecute}
        disabled={orderType === "limit" && !limitPrice}
        className="w-full py-2 text-sm font-medium border border-green-400/30 text-green-400
                   hover:bg-green-400/10 transition-colors cursor-pointer
                   disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {buttonText}
      </button>
      <button
        onClick={onRevokeAgent}
        className="text-[10px] text-hl-text-dim hover:text-hl-error transition-colors cursor-pointer self-center"
      >
        Reset Agent
      </button>
    </div>
  );
}
