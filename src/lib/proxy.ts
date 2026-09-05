/* ============================================================
   ScribeDesk — Proxy Bridge
   ------------------------------------------------------------
   Single routing seam between the UI (search bar + app cards)
   and a backend proxy transport. To wire a real engine, replace
   the `wrap` implementation of the engine below — everything
   else (UI, telemetry, cloaking) keeps working untouched.

   Example — Ultraviolet:
     import { UltravioletCodec } from "@titaniumnetwork-dev/ultraviolet";
     wrap: (url) => `${location.origin}/service/${UltravioletCodec.xor.encode(url)}`

   Example — Bare-Mux:
     import { BareMuxConnection } from "@mercuryworkshop/bare-mux";
     wrap: (url) => new BareMuxConnection().openChannel(url)
   ============================================================ */

export type EngineId = "ultraviolet" | "baremux" | "rammerhead" | "direct";

export interface ProxyEngine {
  id: EngineId;
  label: string;
  detail: string;
  /** Transform a fully-qualified URL into the proxied URL. */
  wrap: (url: string) => string;
}

const passthrough = (url: string) => url;

export const ENGINES: Record<EngineId, ProxyEngine> = {
  ultraviolet: {
    id: "ultraviolet",
    label: "Ultraviolet",
    detail: "service-worker interceptor · recommended",
    wrap: passthrough, // HOOK: point at your UV /service/ prefix
  },
  baremux: {
    id: "baremux",
    label: "Bare-Mux",
    detail: "websocket multiplexer · low overhead",
    wrap: passthrough, // HOOK: open a BareMux channel here
  },
  rammerhead: {
    id: "rammerhead",
    label: "Rammerhead",
    detail: "session-persistent · good for games",
    wrap: passthrough, // HOOK: bind a Rammerhead session
  },
  direct: {
    id: "direct",
    label: "Direct",
    detail: "no tunnel · plain outbound request",
    wrap: passthrough,
  },
};

const customEngines = new Map<string, ProxyEngine>();

/** Runtime registration — third-party code can inject engines without rebuilding. */
export function registerEngine(engine: ProxyEngine): void {
  customEngines.set(engine.id, engine);
}

export function getEngine(id: string): ProxyEngine {
  return customEngines.get(id) ?? ENGINES[id as EngineId] ?? ENGINES.direct;
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
    display: `google.com/search`,
  };
}

/** Resolve an intent through the selected engine's transport. */
export function resolveThrough(engineId: string, url: string): string {
  return getEngine(engineId).wrap(url);
}

/* ---------- about:blank tab cloak ---------- */

export function openCloaked(url: string, title = "ScribeDesk"): Window | null {
  const win = window.open("about:blank", "_blank");
  if (!win) return null;
  const doc = win.document;
  doc.open();
  doc.write(`<!doctype html>
<html><head><title>${title}</title>
<link rel="icon" href="data:,">
<style>html,body{margin:0;height:100%;background:#0a0a0a}iframe{border:0;width:100%;height:100%;display:block}</style>
</head><body><iframe src="${url}" allow="fullscreen; autoplay; clipboard-write; gamepad"></iframe></body></html>`);
  doc.close();
  return win;
}

/* ---------- Simulated tunnel handshake ----------
   Gives the console perceptible routing feedback. When a live
   engine is wired above, stages can map to real handshake events. */

export const HANDSHAKE_STAGES = ["resolving host", "interchanging headers", "tunnel established"] as const;

export async function simulateTunnel(
  onStage: (stage: string, index: number) => void
): Promise<void> {
  const beats = [340, 720, 420];
  for (let i = 0; i < HANDSHAKE_STAGES.length; i++) {
    onStage(HANDSHAKE_STAGES[i], i);
    await new Promise((r) => setTimeout(r, beats[i]));
  }
}

/* ---------- Global hook surface ----------
   Exposed so external scripts / extensions can drive the desk:
     window.__scribedesk.registerEngine({ id, label, detail, wrap })
     window.__scribedesk.route("https://example.com")
*/

export interface ScribeDeskBridge {
  registerEngine: typeof registerEngine;
  route: (url: string) => void;
  engines: Record<EngineId, ProxyEngine>;
  version: string;
}

export function attachBridge(route: (url: string) => void): ScribeDeskBridge {
  const bridge: ScribeDeskBridge = { registerEngine, route, engines: ENGINES, version: "2.4.1" };
  (window as unknown as { __scribedesk: ScribeDeskBridge }).__scribedesk = bridge;
  return bridge;
}
