/* ============================================================
   ScribeDesk — Proxy Bridge
   ------------------------------------------------------------
   Single routing seam between the UI (route bar, app cards,
   game tiles, player viewport, in-page browser) and a backend
   proxy transport.

   EVERY navigation on the desk flows through `resolveThrough`.
   Nothing ever opens in a tab.

   Transports:
     embedded    — ships working. Frames the destination directly
                   inside the on-page viewport. Handles every
                   iframe-friendly target (game ports, docs, igu
                   Google). Sites that send X-Frame-Options need
                   a deployed engine to route around it.
     ultraviolet — slot. Deploy UV on this origin, then activate:
                     registerEngine({ id: "ultraviolet",
                       wrap: (u) => `/service/uv/${encode(u)}` })
     baremux     — slot. Open a BareMux channel in `wrap`.
     rammerhead  — slot. Bind a Rammerhead session in `wrap`.

   Undeployed slots fall back to `embedded` — the desk never
   routes into a dead path.
   ============================================================ */

export type EngineId = "embedded" | "ultraviolet" | "baremux" | "rammerhead";

export interface ProxyEngine {
  id: EngineId;
  label: string;
  detail: string;
  /**
   * Transform a fully-qualified destination URL into the proxied URL.
   * `null` = integration slot awaiting deployment (falls back to
   * the embedded transport until `registerEngine` provides a wrap).
   */
  wrap: ((url: string) => string) | null;
}

export const ENGINES: Record<EngineId, ProxyEngine> = {
  embedded: {
    id: "embedded",
    label: "Embedded",
    detail: "in-page frame · ships working",
    wrap: (url) => url,
  },
  ultraviolet: {
    id: "ultraviolet",
    label: "Ultraviolet",
    detail: "slot · service-worker interceptor",
    wrap: null,
  },
  baremux: {
    id: "baremux",
    label: "Bare-Mux",
    detail: "slot · websocket multiplexer",
    wrap: null,
  },
  rammerhead: {
    id: "rammerhead",
    label: "Rammerhead",
    detail: "slot · session-persistent",
    wrap: null,
  },
};

const customEngines = new Map<string, ProxyEngine>();

/** Runtime registration — deploys an engine (or overrides any slot) without rebuilding. */
export function registerEngine(engine: ProxyEngine): void {
  customEngines.set(engine.id, engine);
}

export function getEngine(id: string): ProxyEngine {
  return customEngines.get(id) ?? ENGINES[id as EngineId] ?? ENGINES.embedded;
}

/** A slot is live once it has a real `wrap` (built-in or registered). */
export function isDeployed(id: string): boolean {
  return (customEngines.get(id)?.wrap ?? ENGINES[id as EngineId]?.wrap ?? null) !== null;
}

/* ---------- Input normalization ---------- */

export type RouteIntent = { kind: "url" | "search"; url: string; display: string };

const DOMAIN_RE = /^[\w-]+(\.[\w-]+)+(\/[^\s]*)?$/i;

export function normalizeInput(raw: string): RouteIntent {
  const input = raw.trim();
  if (!input)
    return { kind: "search", url: "https://www.google.com/webhp?igu=1", display: "google.com" };

  if (/^https?:\/\//i.test(input)) {
    const u = new URL(input);
    return { kind: "url", url: u.href, display: u.hostname.replace(/^www\./, "") };
  }
  if (DOMAIN_RE.test(input)) {
    return { kind: "url", url: `https://${input}`, display: input.replace(/^www\./, "").split("/")[0] };
  }
  return {
    kind: "search",
    // igu=1 lets Google render inside an in-page frame.
    url: `https://www.google.com/search?igu=1&q=${encodeURIComponent(input)}`,
    display: "google.com/search",
  };
}

/**
 * The one true gateway: rewrite `url` through the selected engine.
 * Never bypassed, never opens a tab. Undeployed slots resolve via
 * the embedded transport so the frame always lands somewhere real.
 */
export function resolveThrough(engineId: string, url: string): string {
  const engine = getEngine(engineId);
  return engine.wrap ? engine.wrap(url) : url;
}

/* ---------- In-page policy ----------
   ScribeDesk never spawns tabs. Every destination — sites,
   searches, games, even doc links — renders inside an in-page
   proxy viewport. Cloaking is a document-level title/favicon
   rewrite, applied to this page while a session is open. */

/* ---------- Simulated tunnel handshake ----------
   Perceptible routing feedback for the console. When a live
   engine is wired above, stages can map to real handshake events. */

export const HANDSHAKE_STAGES = ["resolving host", "interchanging headers", "tunnel established"] as const;

export async function simulateTunnel(onStage: (stage: string, index: number) => void): Promise<void> {
  const beats = [320, 680, 380];
  for (let i = 0; i < HANDSHAKE_STAGES.length; i++) {
    onStage(HANDSHAKE_STAGES[i], i);
    await new Promise((r) => setTimeout(r, beats[i]));
  }
}

/* ---------- Global hook surface ----------
   window.__scribedesk.registerEngine({ id, label, detail, prefix, wrap })
   window.__scribedesk.route("https://example.com")
   window.__scribedesk.play(slug) — reserved for the in-page player
*/

export interface ScribeDeskBridge {
  registerEngine: typeof registerEngine;
  route: (url: string) => void;
  play: (slug: string) => void;
  engines: Record<EngineId, ProxyEngine>;
  version: string;
}

export function attachBridge(route: (url: string) => void, play: (slug: string) => void): ScribeDeskBridge {
  const bridge: ScribeDeskBridge = { registerEngine, route, play, engines: ENGINES, version: "3.0.0" };
  (window as unknown as { __scribedesk: ScribeDeskBridge }).__scribedesk = bridge;
  return bridge;
}
