"use client";

import { useState, useRef, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Token } from "@/lib/domain/types";
import { useRouteMachine } from "@/lib/state/use-route-machine";
import { useBalances } from "@/lib/state/use-balances";
import { Panel, SectionLabel } from "@/components/panel";
import { TokenSelect } from "@/components/token-select";
import { AmountInput } from "@/components/amount-input";
import { RoutePreview } from "@/components/route-preview";
import { PriceEstimate } from "@/components/price-estimate";
import { WarningBanner } from "@/components/warning-banner";
import { SpotPrices } from "@/components/spot-prices";
import { SpotTicker } from "@/components/spot-ticker";

export default function AssetRouter() {
  const [tokenA, setTokenA] = useState<Token | null>(null);
  const [tokenB, setTokenB] = useState<Token | null>(null);
  const [amount, setAmount] = useState("");

  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { login, logout, authenticated, user } = usePrivy();
  const { data: balances } = useBalances(user?.wallet?.address);
  const { state, discoverRoute, reset } = useRouteMachine();

  const parsedAmount = parseFloat(amount) || 0;

  // Unmute on first user interaction — browsers require a user gesture before allowing audio
  useEffect(() => {
    function unmute() {
      if (videoRef.current && videoRef.current.muted) {
        videoRef.current.muted = false;
        setMuted(false);
      }
      window.removeEventListener("click", unmute);
      window.removeEventListener("keydown", unmute);
    }
    window.addEventListener("click", unmute, { once: true });
    window.addEventListener("keydown", unmute, { once: true });
    return () => {
      window.removeEventListener("click", unmute);
      window.removeEventListener("keydown", unmute);
    };
  }, []);

  function toggleMute() {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setMuted(videoRef.current.muted);
    }
  }

  function handleDiscover() {
    discoverRoute(tokenA, tokenB, parsedAmount);
  }

  function handleSwapTokens() {
    const prevA = tokenA;
    setTokenA(tokenB);
    setTokenB(prevA);
    reset();
  }

  return (
    <div className="theme-video relative min-h-screen">
      {/* Background video */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 w-full h-full object-cover z-0 blur-sm portrait:rotate-90 portrait:scale-[1.8]"
      >
        <source src="/lighter-3.1.mp4" type="video/mp4" />
      </video>
      {/* Overlay so UI stays readable */}
      <div className="fixed inset-0 z-0" />

      {/* Mute toggle */}
      <button
        onClick={toggleMute}
        className="fixed bottom-4 right-4 z-50 px-2 py-1 text-[10px] uppercase tracking-wider
                   border border-hl-border bg-hl-bg/70 text-hl-text-dim hover:text-hl-muted
                   backdrop-blur-sm transition-colors cursor-pointer"
      >
        {muted ? "unmute" : "mute"}
      </button>

      {/* Header */}
      <header className="relative z-10 border-b border-hl-border px-6 py-3">
        <div className="max-w-[900px] mx-auto flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-hl-text">
              Asset Router
            </span>
            <span className="text-[10px] text-hl-text-dim">
              hyperliquid spot
            </span>
          </div>
          {authenticated ? (
            <button
              onClick={logout}
              className="text-[10px] text-hl-text-dim hover:text-hl-muted transition-colors uppercase tracking-wider cursor-pointer"
            >
              {user?.wallet?.address
                ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}`
                : "Disconnect"}
            </button>
          ) : (
            <button
              onClick={login}
              className="text-[10px] text-hl-accent hover:text-hl-accent/70 transition-colors uppercase tracking-wider cursor-pointer"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Live price ticker */}
      <SpotTicker />

      <div className="relative z-10 max-w-[900px] mx-auto px-6 py-8 flex gap-6">
        {/* Sidebar — desktop only */}
        <aside className="hidden lg:block w-[260px] shrink-0">
          <div className="sticky top-8">
            <Panel>
              <SpotPrices />
            </Panel>
          </div>
        </aside>

      <main className="min-w-0 flex-1 max-w-[600px]">
        {/* Balances */}
        {authenticated && balances && balances.length > 0 && (
          <div className="mb-4">
            <Panel>
              <SectionLabel>Balances</SectionLabel>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                {balances
                  .filter((b) => parseFloat(b.total) > 0)
                  .map((b) => (
                    <span key={b.coin} className="text-xs text-hl-muted">
                      {b.coin}{" "}
                      <span className="text-hl-text">
                        {parseFloat(b.total).toLocaleString(undefined, {
                          maximumFractionDigits: 4,
                        })}
                      </span>
                    </span>
                  ))}
              </div>
            </Panel>
          </div>
        )}

        {/* Input Panel */}
        <Panel>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <TokenSelect
                label="From"
                value={tokenA}
                onChange={(t) => {
                  setTokenA(t);
                  reset();
                }}
                exclude={tokenB?.symbol}
              />
              <TokenSelect
                label="To"
                value={tokenB}
                onChange={(t) => {
                  setTokenB(t);
                  reset();
                }}
                exclude={tokenA?.symbol}
              />
            </div>

            {/* Swap direction button */}
            {tokenA && tokenB && (
              <button
                onClick={handleSwapTokens}
                className="self-center text-[10px] text-hl-text-dim hover:text-hl-muted transition-colors uppercase tracking-wider cursor-pointer"
              >
                [swap direction]
              </button>
            )}

            <AmountInput
              value={amount}
              onChange={(v) => {
                setAmount(v);
                reset();
              }}
              tokenSymbol={tokenA?.symbol}
            />

            <button
              onClick={handleDiscover}
              disabled={
                !tokenA ||
                !tokenB ||
                parsedAmount <= 0 ||
                state.status === "discovering"
              }
              className="w-full py-2 text-sm font-medium border border-hl-accent/30 text-hl-accent
                         hover:bg-hl-accent/10 transition-colors
                         disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              {state.status === "discovering"
                ? "Discovering..."
                : "Find Route"}
            </button>
          </div>
        </Panel>

        {/* Results */}
        <div className="mt-4 flex flex-col gap-3">
          {/* Route found */}
          {state.status === "route_found" && (
            <>
              <Panel>
                <SectionLabel>Route</SectionLabel>
                <RoutePreview route={state.route} />
              </Panel>

              <PriceEstimate
                route={state.route}
                inputAmount={parsedAmount}
              />

              <WarningBanner warnings={state.route.warnings} />
            </>
          )}

          {/* No route */}
          {state.status === "no_route" && (
            <Panel>
              <div className="text-xs text-hl-error">
                No route found from {state.from.symbol} to {state.to.symbol}.
                <span className="text-hl-text-dim ml-1">
                  No available pair path exists within 3 hops.
                </span>
              </div>
            </Panel>
          )}

          {/* Error */}
          {state.status === "error" && (
            <Panel>
              <div className="text-xs text-hl-error">{state.message}</div>
            </Panel>
          )}

          {/* Idle hint */}
          {state.status === "idle" && tokenA && tokenB && parsedAmount > 0 && (
            <div className="text-[10px] text-hl-text-dim text-center py-2">
              Press &quot;Find Route&quot; to discover the optimal path
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-8 border-t border-hl-border pt-4 text-[10px] text-hl-text-dim space-y-1">
          <div>
            Data: mock orderbooks &middot; Routing: BFS shortest path &middot;
            Estimation: orderbook walk
          </div>
          <div>
            All prices are simulated. This is not connected to the Hyperliquid
            exchange.
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}
