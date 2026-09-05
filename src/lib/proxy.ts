/* ============================================================
   ScribeDesk — Proxy Bridge
   ------------------------------------------------------------
   Single routing seam between the UI (route bar, app cards,
   game tiles, player viewport) and a backend proxy transport.

   EVERY navigation on the desk flows through `resolveThrough`,
   which rewrites the destination via the active engine's prefix.
   Raw destinations are never opened.

   Wiring a real deployment = change one prefix (or `wrap`):
     Ultraviolet → "/service/uv/"   (UV's default __uv prefix)
     Bare-Mux    → "/baremux/"      (channel-served transport)
     Rammerhead  → "/rammerhead/"   (session-persistent)
   ============================================================ */

export type EngineId = "ultraviolet" | "baremux" | "rammerhead";

export interface ProxyEngine {
  id: EngineId;
  label: string;
  detail: string;
  prefix: string;
  /**
   * Transform a fully-qualified destination URL into the proxied URL.
   * Swap the body to plug in a real codec, e.g.:
   *   wrap: (url) => `${location.origin}/service/${UltravioletCodec.xor.encode(url)}`
   */
  wrap: (url: string) => string;
}

const viaPrefix = (prefix: string) => (url: string) => `${prefix}${url}`;

export const ENGINES: Record<EngineId, ProxyEngine> = {
  ultraviolet: {
    id: "ultraviolet",
    label: "Ultraviolet",
    detail: "service-worker interceptor · recommended",
    prefix: "/service/uv/",
    wrap: viaPrefix("/service/uv/"),
  },
  baremux: {
    id: "baremux",
    label: "Bare-Mux",
    detail: "websocket multiplexer · low overhead",
    prefix: "/baremux/",
    wrap: viaPrefix("/baremux/"),
  },
  rammerhead: {
    id: "rammerhead",
    label: "Rammerhead",
    detail: "session-persistent · good for games",
    prefix: "/rammerhead/",
    wrap: viaPrefix("/rammerhead/"),
  },
};

const customEngines = new Map<string, ProxyEngine>();

/** Runtime registration — external scripts can inject engines without rebuilding. */
export function registerEngine(engine: ProxyEngine): void {
  customEngines.set(engine.id, engine);
}

export function getEngine(id: string): ProxyEngine {
  return customEngines.get(id) ?? ENGINES[id as EngineId] ?? ENGINES.ultraviolet;
}

/* ---------- Input normalization ---------- */

export type RouteIntent = { kind: "url" | "search"; url: string; display: string };

const DOMAIN_RE = /^[\w-]+(\.[\w-]+)+(\/[^\s]*)?$/i;

export function normalizeInput(raw: string): RouteIntent {
  const input = raw.trim();
  if (!input) return { kind: "search", url: "https://www.google.com/", display: "google.com" };

  if (/^https?:\/\//i.test(input)) {
    const u = new URL(input);
    return { kind: "url", url: u.href, display: u.hostname.replace(/^www\./, "") };
  }
  if (DOMAIN_RE.test(input)) {
    return { kind: "url", url: `https://${input}`, display: input.replace(/^www\./, "").split("/")[0] };
  }
  return {
    kind: "search",
    url: `https://www.google.com/search?q=${encodeURIComponent(input)}`,
    display: "google.com/search",
  };
}

/** The one true gateway: rewrite `url` through the selected engine. Never bypass. */
export function resolveThrough(engineId: string, url: string): string {
  return getEngine(engineId).wrap(url);
}

/* ---------- about:blank tab cloak ---------- */

export function openCloaked(proxiedUrl: string, title = "ScribeDesk"): Window | null {
  const win = window.open("about:blank", "_blank");
  if (!win) return null;
  const doc = win.document;
  doc.open();
  doc.write(`<!doctype html>
<html><head><title>${title}</title>
<link rel="icon" href=",">
<style>html,body{margin:0;height:100%;background:#0a0a0a}iframe{border:0;width:100%;height:100%;display:block}</style>
</head><body><iframe src="${proxiedUrl}" allow="fullscreen; autoplay; clipboard-write; gamepad"></iframe></body></html>`);
  doc.close();
  return win;
}

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
