"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Token } from "@/lib/domain/types";
import { TOKENS } from "@/lib/domain/tokens";
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
import { useSpotPrices } from "@/lib/state/use-spot-prices";

export default function AssetRouter() {
  const [tokenA, setTokenA] = useState<Token | null>(null);
  const [tokenB, setTokenB] = useState<Token | null>(null);
  const [amount, setAmount] = useState("");

  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { login, logout, authenticated, user } = usePrivy();
  const { data: balances } = useBalances(user?.wallet?.address);
  const { data: spotPrices } = useSpotPrices();
  const { state, discoverRoute, reset } = useRouteMachine();

  const availableTokens = useMemo(() => {
    if (!spotPrices) return undefined;
    return spotPrices.map(
      (p) => TOKENS[p.pair] ?? { symbol: p.pair, name: p.pair, decimals: 4 },
    );
  }, [spotPrices]);

  const heldTokens = useMemo(() => {
    if (!balances) return undefined;
    return balances
      .filter((b) => parseFloat(b.total) > 0)
      .map((b) => TOKENS[b.coin] ?? { symbol: b.coin, name: b.coin, decimals: 4 });
  }, [balances]);

  const maxAmount = useMemo(() => {
    if (!balances || !tokenA) return undefined;
    const b = balances.find((b) => b.coin === tokenA.symbol);
    return b ? b.total : undefined;
  }, [balances, tokenA]);

  const parsedAmount = parseFloat(amount) || 0;
  const insufficientBalance =
    authenticated && tokenA && parsedAmount > 0 && parsedAmount > parseFloat(maxAmount ?? "0");

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

  function selectToken(symbol: string, target: "from" | "to") {
    const token = TOKENS[symbol] ?? { symbol, name: symbol, decimals: 4 };
    if (target === "from") setTokenA(token);
    else setTokenB(token);
    reset();
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
      <SpotTicker onSelect={(name) => selectToken(name, "to")} />

      <div className="relative z-10 max-w-[900px] mx-auto px-6 py-8 flex gap-6">
        {/* Sidebar — desktop only */}
        <aside className="hidden lg:block w-[260px] shrink-0">
          <div className="sticky top-8">
            <Panel>
              <SpotPrices onSelect={(name) => selectToken(name, "to")} />
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
                    <button
                      key={b.coin}
                      onClick={() => selectToken(b.coin, "from")}
                      className="text-xs text-hl-muted hover:text-hl-accent transition-colors cursor-pointer"
                    >
                      {b.coin}{" "}
                      <span className="text-hl-text">
                        {parseFloat(b.total).toLocaleString(undefined, {
                          maximumFractionDigits: 4,
                        })}
                      </span>
                    </button>
                  ))}
              </div>
            </Panel>
          </div>
        )}

        {/* Input Panel */}
        <Panel>
          <div className="flex flex-col gap-4">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <TokenSelect
                  label="From"
                  value={tokenA}
                  onChange={(t) => {
                    setTokenA(t);
                    reset();
                  }}
                  exclude={tokenB?.symbol}
                  tokens={heldTokens}
                />
              </div>
              <button
                onClick={handleSwapTokens}
                className="mb-0.5 px-1.5 py-3 text-hl-text-dim hover:text-hl-accent transition-colors cursor-pointer shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
              </button>
              <div className="flex-1">
                <TokenSelect
                  label="To"
                  value={tokenB}
                  onChange={(t) => {
                    setTokenB(t);
                    reset();
                  }}
                  exclude={tokenA?.symbol}
                  tokens={availableTokens}
                />
              </div>
            </div>

            <AmountInput
              value={amount}
              onChange={(v) => {
                setAmount(v);
                reset();
              }}
              tokenSymbol={tokenA?.symbol}
              maxAmount={maxAmount}
            />

            {insufficientBalance && (
              <div className="text-[11px] text-hl-warn">
                Insufficient balance
              </div>
            )}

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
