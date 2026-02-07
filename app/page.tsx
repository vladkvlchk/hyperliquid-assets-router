"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount, useSwitchChain } from "wagmi";
import { arbitrum } from "viem/chains";
import { Token, OrderType } from "@/lib/domain/types";
import { TOKENS, displayName } from "@/lib/domain/tokens";
import { useRouteMachine } from "@/lib/state/use-route-machine";
import { useBalances } from "@/lib/state/use-balances";
import { useSpotMeta } from "@/lib/state/use-spot-meta";
import { useAgent } from "@/lib/state/use-agent";
import { Panel, SectionLabel } from "@/components/panel";
import { TokenSelect } from "@/components/token-select";
import { AmountInput } from "@/components/amount-input";
import { RoutePreview } from "@/components/route-preview";
import { PriceEstimate } from "@/components/price-estimate";
import { WarningBanner } from "@/components/warning-banner";
import { TradeResultDisplay, TradeErrorDisplay } from "@/components/trade-result";
import { SpotPrices } from "@/components/spot-prices";
import { SpotTicker } from "@/components/spot-ticker";
import { OpenOrders } from "@/components/open-orders";
import { useSpotPrices } from "@/lib/state/use-spot-prices";
import { useOpenOrders } from "@/lib/state/use-open-orders";

export default function AssetRouter() {
  const [tokenA, setTokenA] = useState<Token | null>(null);
  const [tokenB, setTokenB] = useState<Token | null>(null);
  const [amount, setAmount] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [limitPrice, setLimitPrice] = useState("");

  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.1);
  const [videoStopped, setVideoStopped] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { login, logout, authenticated, user } = usePrivy();
  const { chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const isWrongChain = authenticated && chainId !== undefined && chainId !== arbitrum.id;
  const { data: balances } = useBalances(user?.wallet?.address);
  const { data: spotPrices } = useSpotPrices();
  const { data: spotMeta } = useSpotMeta();
  const { state, discoverRoute, executeRoute, reset } = useRouteMachine();
  const { agent, isApproving, approveError, approve, revoke } = useAgent(user?.wallet?.address);
  const { data: openOrders, invalidate: invalidateOrders } = useOpenOrders(user?.wallet?.address);

  const availableTokens = useMemo(() => {
    if (!spotPrices) return undefined;
    const tokens = spotPrices.map(
      (p) => TOKENS[p.pair] ?? { symbol: p.pair, name: p.pair, decimals: 4 },
    );
    // Always include USDC as it's a common quote token
    if (!tokens.some((t) => t.symbol === "USDC")) {
      tokens.unshift(TOKENS["USDC"] ?? { symbol: "USDC", name: "USD Coin", decimals: 6 });
    }
    return tokens;
  }, [spotPrices]);

  const heldTokens = useMemo(() => {
    if (!balances) return undefined;
    return balances
      .filter((b) => parseFloat(b.total) > 0)
      .map((b) => TOKENS[b.coin] ?? { symbol: b.coin, name: b.coin, decimals: 4 });
  }, [balances]);

  // Price lookup: coin symbol -> USD price
  const priceMap = useMemo(() => {
    if (!spotPrices) return new Map<string, number>();
    const map = new Map<string, number>();
    map.set("USDC", 1.0);
    for (const p of spotPrices) {
      map.set(p.pair, p.midPx);
    }
    return map;
  }, [spotPrices]);

  // Get USD value for a coin
  function getUsdValue(coin: string, amount: number): number | null {
    // Try direct lookup
    let price = priceMap.get(coin);
    if (price !== undefined) return amount * price;
    // Try display name alias (UETH -> ETH)
    const alias = displayName(coin);
    if (alias !== coin) {
      price = priceMap.get(alias);
      if (price !== undefined) return amount * price;
    }
    return null;
  }

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
        videoRef.current.volume = 0.1; // 10% volume
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

  function handleVolumeChange(newVolume: number) {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
      setVolume(newVolume);
      setMuted(newVolume === 0);
    }
  }

  function toggleVideo() {
    if (videoRef.current) {
      if (videoStopped) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
      setVideoStopped(!videoStopped);
    }
  }

  function handleDiscover() {
    discoverRoute(tokenA, tokenB, parsedAmount, spotMeta);
  }

  async function handleApproveAgent() {
    await approve();
  }

  function handleSwitchNetwork() {
    switchChain({ chainId: arbitrum.id });
  }

  async function handleExecute() {
    if (
      state.status !== "route_found" ||
      !spotMeta ||
      !agent
    )
      return;

    const parsedLimitPrice = parseFloat(limitPrice) || undefined;

    executeRoute(
      state.route,
      parsedAmount,
      spotMeta,
      agent.privateKey,
      orderType,
      parsedLimitPrice,
    );
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
      {/* Desktop video */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 w-full h-full object-cover z-0 blur-sm hidden sm:block"
      >
        <source src="/lighter-3.1.mp4" type="video/mp4" />
      </video>
      {/* Mobile video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 w-full h-full object-cover z-0 blur-sm sm:hidden"
      >
        <source src="/lighter-3.1-vertical.mp4" type="video/mp4" />
      </video>
      {/* Subtle dark overlay for base readability */}
      <div className="fixed inset-0 z-0 bg-black/30" />

      {/* Video controls */}
      <div className="fixed bottom-4 right-4 z-50 flex gap-1">
        <button
          onClick={toggleVideo}
          className="p-2 border border-hl-border/60 bg-hl-surface/40 text-hl-text-dim hover:text-hl-muted
                     backdrop-blur-xl transition-colors cursor-pointer"
        >
          {videoStopped ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M232,128a104,104,0,1,1-104-104A104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Zm-48,0a8,8,0,0,1-3.41,6.55l-40,28A8,8,0,0,1,112,156V100a8,8,0,0,1,12.59-6.55l40,28A8,8,0,0,1,168,128Z"></path></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216ZM112,96v64a8,8,0,0,1-16,0V96a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V96a8,8,0,0,1,16,0Z"></path></svg>
          )}
        </button>
        <div className="group relative">
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-2 hidden group-hover:block">
            <div className="p-2 border border-hl-border/60 bg-hl-surface/40 backdrop-blur-xl">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={muted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="h-16 w-1 accent-hl-accent cursor-pointer"
                style={{ writingMode: "vertical-lr", direction: "rtl" }}
              />
            </div>
          </div>
          <button
            onClick={toggleMute}
            className="p-2 border border-hl-border/60 bg-hl-surface/40 text-hl-text-dim hover:text-hl-muted
                       backdrop-blur-xl transition-colors cursor-pointer"
          >
            {muted ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M192,152V104a8,8,0,0,1,16,0v48a8,8,0,0,1-16,0Zm40-72a8,8,0,0,0-8,8v80a8,8,0,0,0,16,0V88A8,8,0,0,0,232,80ZM221.92,210.62a8,8,0,1,1-11.84,10.76L168,175.09V224a8,8,0,0,1-12.91,6.31L85.25,176H40a16,16,0,0,1-16-16V96A16,16,0,0,1,40,80H81.55L50.08,45.38A8,8,0,0,1,61.92,34.62ZM152,157.49,96.1,96H40v64H88a7.94,7.94,0,0,1,4.91,1.69L152,207.64ZM125.06,69.31l26.94-21v58.47a8,8,0,0,0,16,0V32a8,8,0,0,0-12.91-6.31l-39.85,31a8,8,0,0,0,9.82,12.63Z"></path></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M163.51,24.81a8,8,0,0,0-8.42.88L85.25,80H40A16,16,0,0,0,24,96v64a16,16,0,0,0,16,16H85.25l69.84,54.31A8,8,0,0,0,168,224V32A8,8,0,0,0,163.51,24.81ZM152,207.64,92.91,161.69A7.94,7.94,0,0,0,88,160H40V96H88a7.94,7.94,0,0,0,4.91-1.69L152,48.36ZM208,104v48a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm32-16v80a8,8,0,0,1-16,0V88a8,8,0,0,1,16,0Z"></path></svg>
            )}
          </button>
        </div>
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-hl-border/60 bg-hl-surface/30 backdrop-blur-xl px-6 py-3">
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
                  .map((b) => {
                    const total = parseFloat(b.total);
                    const usdValue = getUsdValue(b.coin, total);
                    return (
                      <button
                        key={b.coin}
                        onClick={() => selectToken(b.coin, "from")}
                        className="text-xs text-hl-muted hover:text-hl-accent transition-colors cursor-pointer"
                      >
                        {displayName(b.coin)}{" "}
                        <span className="text-hl-text">
                          {total.toLocaleString(undefined, {
                            maximumFractionDigits: 4,
                          })}
                        </span>
                        {usdValue !== null && (
                          <span className="text-hl-text-dim ml-1">
                            ${usdValue.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        )}
                      </button>
                    );
                  })}
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
          {/* Route found — show preview + execute button */}
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

              {/* Order Type Toggle — only for single-hop routes */}
              {state.route.hops.length === 1 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-hl-text-dim uppercase tracking-wider">Order Type</span>
                    <div className="flex border border-hl-border/60 rounded overflow-hidden">
                      <button
                        onClick={() => setOrderType("market")}
                        className={`px-3 py-1 text-[11px] cursor-pointer transition-colors ${
                          orderType === "market"
                            ? "bg-hl-accent/20 text-hl-accent"
                            : "text-hl-text-dim hover:text-hl-muted"
                        }`}
                      >
                        Market
                      </button>
                      <button
                        onClick={() => setOrderType("limit")}
                        className={`px-3 py-1 text-[11px] cursor-pointer transition-colors ${
                          orderType === "limit"
                            ? "bg-hl-accent/20 text-hl-accent"
                            : "text-hl-text-dim hover:text-hl-muted"
                        }`}
                      >
                        Limit
                      </button>
                    </div>
                  </div>

                  {/* Limit Price Input */}
                  {orderType === "limit" && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-hl-text-dim uppercase tracking-wider">
                        Limit Price (USD)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        placeholder="Enter limit price"
                        className="w-full px-3 py-2 text-sm bg-hl-surface/50 border border-hl-border/60
                                   text-hl-text placeholder:text-hl-text-dim/50
                                   focus:outline-none focus:border-hl-accent/50"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Execute button — wallet connected */}
              {authenticated ? (
                isWrongChain ? (
                  <button
                    onClick={handleSwitchNetwork}
                    className="w-full py-2 text-sm font-medium border border-orange-400/30 text-orange-400
                               hover:bg-orange-400/10 transition-colors cursor-pointer"
                  >
                    Switch to Arbitrum
                  </button>
                ) : !agent ? (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleApproveAgent}
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
                ) : spotMeta ? (
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={handleExecute}
                      disabled={orderType === "limit" && !limitPrice}
                      className="w-full py-2 text-sm font-medium border border-green-400/30 text-green-400
                                 hover:bg-green-400/10 transition-colors cursor-pointer
                                 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {state.route.hops.length > 1
                        ? `Execute ${state.route.hops.length}-Hop ${orderType === "limit" ? "Limit" : "Market"}`
                        : `Execute ${orderType === "limit" ? "Limit" : "Market"} Order`}
                    </button>
                    <button
                      onClick={revoke}
                      className="text-[10px] text-hl-text-dim hover:text-hl-error transition-colors cursor-pointer self-center"
                    >
                      Reset Agent
                    </button>
                  </div>
                ) : null
              ) : !authenticated ? (
                <button
                  onClick={login}
                  className="w-full py-2 text-sm font-medium border border-hl-accent/30 text-hl-accent
                             hover:bg-hl-accent/10 transition-colors cursor-pointer"
                >
                  Connect Wallet to Trade
                </button>
              ) : null}
            </>
          )}

          {/* Executing — signing + submitting */}
          {state.status === "executing" && (
            <>
              <Panel>
                <SectionLabel>Route</SectionLabel>
                <RoutePreview route={state.route} />
              </Panel>
              <Panel>
                <div className="text-xs text-hl-muted animate-pulse">
                  {state.route.hops.length > 1 && state.currentHop !== undefined
                    ? `Executing hop ${state.currentHop + 1} of ${state.route.hops.length}...`
                    : "Signing & submitting order..."}
                </div>
              </Panel>
            </>
          )}

          {/* Executed — show result */}
          {state.status === "executed" && (
            <>
              <Panel>
                <SectionLabel>Route</SectionLabel>
                <RoutePreview route={state.route} />
              </Panel>
              <TradeResultDisplay
                result={state.result}
                fromSymbol={state.route.from.symbol}
                toSymbol={state.route.to.symbol}
                onReset={reset}
              />
            </>
          )}

          {/* Execution error */}
          {state.status === "execution_error" && (
            <>
              <Panel>
                <SectionLabel>Route</SectionLabel>
                <RoutePreview route={state.route} />
              </Panel>
              <TradeErrorDisplay
                message={state.message}
                onRetry={handleExecute}
                onReset={reset}
                onResetAgent={state.message.includes("does not exist") ? revoke : undefined}
              />
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
        </div>

        {/* Open Orders */}
        {authenticated && agent && spotMeta && openOrders && openOrders.length > 0 && (
          <div className="mt-4">
            <OpenOrders
              orders={openOrders}
              agentPrivateKey={agent.privateKey}
              spotMeta={spotMeta}
              onOrderCancelled={() => {
                invalidateOrders();
                reset();
              }}
            />
          </div>
        )}

        {/* Footer info */}
        <div className="mt-8 border-t border-hl-border pt-4 text-[10px] text-hl-text-dim space-y-1">
          <div>
            Prices: Hyperliquid API &middot; Routing: BFS shortest path &middot;
            Execution: IOC market orders
          </div>
          <div>
            Trades execute on Hyperliquid mainnet.
            Multi-hop routes execute sequentially.
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}
