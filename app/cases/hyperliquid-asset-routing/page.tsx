import { Panel } from "@/components/panel";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <h2 className="text-xs font-medium uppercase tracking-wider text-hl-accent mb-3 border-b border-hl-border pb-2">
        {title}
      </h2>
      <div className="text-sm text-hl-muted leading-relaxed space-y-3">
        {children}
      </div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-hl-text-dim shrink-0">&ndash;</span>
      <span>{children}</span>
    </div>
  );
}

function CodeRef({ children }: { children: React.ReactNode }) {
  return (
    <code className="text-hl-accent/80 bg-hl-accent/5 px-1 text-xs">
      {children}
    </code>
  );
}

export default function CaseStudy() {
  return (
    <div className="min-h-screen bg-hl-bg">
      <header className="border-b border-hl-border px-6 py-3">
        <div className="max-w-[700px] mx-auto flex items-center justify-between">
          <a
            href="/"
            className="text-[10px] text-hl-text-dim hover:text-hl-muted transition-colors uppercase tracking-wider"
          >
            &larr; Router
          </a>
          <span className="text-sm font-medium text-hl-text">Case Study</span>
        </div>
      </header>

      <main className="max-w-[700px] mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-lg font-medium text-hl-text mb-1">
            Hyperliquid Asset Routing
          </h1>
          <p className="text-xs text-hl-text-dim">
            Engineering-focused breakdown of the routing interface architecture
          </p>
        </div>

        <Section title="Problem">
          <p>
            Spot markets on Hyperliquid expose discrete trading pairs. Users
            think in terms of &quot;convert SOL to HYPE&quot;, but the exchange
            only offers SOL/USDC and HYPE/USDC. The conversion requires two
            separate trades through a shared intermediary.
          </p>
          <p>
            This interface abstracts pair-based trading into asset-to-asset
            routing, discovering the optimal multi-hop path automatically.
          </p>
        </Section>

        <Section title="Constraints">
          <Bullet>
            Frontend-only computation — no backend routing server
          </Bullet>
          <Bullet>Must handle sparse pair graphs (not all pairs exist)</Bullet>
          <Bullet>
            Route estimation must account for orderbook depth, not just mid
            prices
          </Bullet>
          <Bullet>
            State transitions must be explicit and inspectable (no implicit
            loading states)
          </Bullet>
          <Bullet>
            UI must clearly communicate uncertainty — stale data, low liquidity,
            multi-hop risk
          </Bullet>
        </Section>

        <Section title="Non-goals">
          <Bullet>Real-time order execution or wallet integration</Bullet>
          <Bullet>
            Optimal routing (we use BFS for fewest hops, not Dijkstra for best
            price)
          </Bullet>
          <Bullet>Cross-margin or leverage considerations</Bullet>
          <Bullet>WebSocket streaming of orderbook updates</Bullet>
        </Section>

        <Section title="Architecture">
          <Panel className="mb-4">
            <pre className="text-[11px] text-hl-muted leading-relaxed whitespace-pre font-mono">
{`┌─────────────────────────────────────────┐
│  UI Layer                               │
│  page.tsx → components/*                │
│  State: useRouteMachine (useReducer)    │
├─────────────────────────────────────────┤
│  Routing Engine                         │
│  graph.ts → pathfinder.ts → estimator   │
│  BFS pathfinding + orderbook walk       │
├─────────────────────────────────────────┤
│  Domain Layer                           │
│  types.ts · tokens.ts · pairs.ts        │
├─────────────────────────────────────────┤
│  Data Layer                             │
│  mock-orderbooks.ts (swap for real API) │
└─────────────────────────────────────────┘`}
            </pre>
          </Panel>

          <Bullet>
            <strong className="text-hl-text">Domain</strong>{" "}
            <CodeRef>lib/domain/</CodeRef> — Token, SpotPair, Route, and
            OrderbookSnapshot types. Pure data definitions with no behavior.
          </Bullet>
          <Bullet>
            <strong className="text-hl-text">Routing</strong>{" "}
            <CodeRef>lib/routing/</CodeRef> — Builds a directed graph from spot
            pairs, runs BFS to find shortest path, then walks the orderbook at
            each hop to estimate output.
          </Bullet>
          <Bullet>
            <strong className="text-hl-text">State</strong>{" "}
            <CodeRef>lib/state/</CodeRef> — Deterministic state machine via
            useReducer. Five explicit states: idle, discovering, route_found,
            no_route, error. No ambient loading flags.
          </Bullet>
          <Bullet>
            <strong className="text-hl-text">Data</strong>{" "}
            <CodeRef>lib/data/</CodeRef> — Mock orderbooks with configurable
            spread, depth, and staleness. Designed to be swapped for real API
            calls without touching routing logic.
          </Bullet>
        </Section>

        <Section title="Key Decisions">
          <div className="space-y-4">
            <div>
              <p className="text-hl-text text-xs font-medium mb-1">
                BFS over Dijkstra
              </p>
              <p className="text-xs">
                BFS finds the path with fewest hops. In practice, fewer hops
                means less cumulative slippage and fewer points of failure. A
                price-weighted Dijkstra would find cheaper routes in some cases,
                but adds complexity and requires real-time spread data at graph
                construction time. BFS is the right starting point.
              </p>
            </div>

            <div>
              <p className="text-hl-text text-xs font-medium mb-1">
                Orderbook walk for estimation
              </p>
              <p className="text-xs">
                Rather than using mid-price (which ignores spread), the
                estimator walks through orderbook levels to simulate market order
                execution. This gives more honest output estimates, especially
                for larger amounts that eat through multiple levels.
              </p>
            </div>

            <div>
              <p className="text-hl-text text-xs font-medium mb-1">
                Explicit state machine over useState flags
              </p>
              <p className="text-xs">
                A common pattern is <CodeRef>isLoading + data + error</CodeRef>{" "}
                as separate useState calls. This creates impossible states (e.g.
                isLoading=true with data already set). The discriminated union
                approach makes illegal states unrepresentable.
              </p>
            </div>

            <div>
              <p className="text-hl-text text-xs font-medium mb-1">
                Warnings as first-class route output
              </p>
              <p className="text-xs">
                Warnings aren&apos;t afterthoughts — they&apos;re computed
                alongside the route and embedded in the Route type. Stale data,
                low liquidity, and long paths are surfaced to the user as part of
                the route result, not as disconnected UI state.
              </p>
            </div>
          </div>
        </Section>

        <Section title="Extension Points">
          <Bullet>
            Replace <CodeRef>mock-orderbooks.ts</CodeRef> with a WebSocket
            connection to the Hyperliquid API
          </Bullet>
          <Bullet>
            Add Dijkstra or A* with spread-weighted edges for price-optimal
            routing
          </Bullet>
          <Bullet>
            Add route comparison — show top N routes ranked by estimated output
          </Bullet>
          <Bullet>
            Integrate with Hyperliquid SDK for actual order placement
          </Bullet>
          <Bullet>
            Add rate limiting and orderbook caching with TTL-based invalidation
          </Bullet>
        </Section>

        <div className="mt-12 border-t border-hl-border pt-4 text-[10px] text-hl-text-dim">
          Built as an infrastructure case study. All data is simulated.
        </div>
      </main>
    </div>
  );
}
