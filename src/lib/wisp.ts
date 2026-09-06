/* ============================================================
   ScribeDesk — Wisp Tunnel
   ------------------------------------------------------------
   Real traffic, no theater. Every site request leaves this page
   through an encrypted tunnel:

     browser ⇄ epoxy (TLS in WASM) ⇄ wisp multiplexer
             ⇄ wss://wisp.mercurywork.shop/ ⇄ the site

   Nothing is ever pointed at a destination directly — the frame
   only ever receives documents we fetched through the tunnel.

   Subresources keep flowing after the initial document: the page
   rewrites URLs into the `/sd/<enc>/…` namespace, and a tiny
   service worker (public/sd-sw.js) relays those back to this
   module over a BroadcastChannel, so CSS / JS / fonts / XHR all
   ride the same tunnel.
   ============================================================ */

import { BareMuxConnection } from "@mercuryworkshop/bare-mux";
import EpoxyTransport from "@mercuryworkshop/epoxy-transport";

export const WISP_URL = "wss://wisp.mercurywork.shop/";

/** epoxy's TLS engine (WASM) — served with CORS by jsDelivr. */
const EPOXY_WASM = "https://cdn.jsdelivr.net/npm/@mercuryworkshop/epoxy-tls@latest/epoxy.wasm";

/* ---------- URL codec shared with the service worker ---------- */

export function encodeUrl(url: string): string {
  const b = btoa(unescape(encodeURIComponent(url)));
  return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeUrl(enc: string): string {
  let b = enc.replace(/-/g, "+").replace(/_/g, "/");
  while (b.length % 4) b += "=";
  return decodeURIComponent(escape(atob(b)));
}

export const SD_PREFIX = "/sd/";

export function proxyUrl(absUrl: string): string {
  return SD_PREFIX + encodeUrl(absUrl);
}

/* ---------- connection singleton ---------- */

interface Transport {
  request(
    remote: string | URL,
    init: { method?: string; headers?: Record<string, string>; body?: BodyInit | null }
  ): Promise<{ status: number; statusText?: string; rawHeaders?: [string, string][]; body?: unknown }>;
}

/** epoxy-transport as an importable module — bare-mux loads transports
    by URL when it has to rebuild them in another context. */
const EPOXY_MODULE = "https://cdn.jsdelivr.net/npm/@mercuryworkshop/epoxy-transport@latest/dist/index.mjs";

// bare-mux's public typings lag its runtime API, so the handshake
// below intentionally meets it at runtime and validates defensively.
type LooseConnection = {
  getTransport(): unknown;
  setTransport(...args: unknown[]): Promise<unknown> | unknown;
};

let connection: BareMuxConnection | null = null;
let connecting: Promise<Transport> | null = null;

async function getTransport(): Promise<Transport> {
  const existing = (connection?.getTransport() as Transport | null | undefined) ?? null;
  if (existing?.request) return existing;
  if (connecting) return connecting;

  connecting = (async () => {
    // No worker URL — the tunnel lives in this page; the service
    // worker relays through the bridge below instead.
    const conn = new BareMuxConnection(null as unknown as string) as unknown as LooseConnection;
    await conn.setTransport(EPOXY_MODULE, EpoxyTransport, [{ wasm: EPOXY_WASM, wisp: WISP_URL }]);

    const t = (await Promise.resolve(conn.getTransport())) as Transport | null;
    if (!t?.request) throw new Error("transport never came up");
    connection = conn as unknown as BareMuxConnection;
    return t;
  })();

  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

/* ---------- the fetch that matters ---------- */

export interface WispResponse {
  status: number;
  headers: Headers;
  body: ArrayBuffer;
  /** Where the tunnel ended up after redirects. */
  finalUrl: string;
}

function toHeaders(raw: unknown): Headers {
  const h = new Headers();
  if (Array.isArray(raw)) {
    for (const pair of raw as [string, string][]) {
      try {
        h.append(pair[0], pair[1]);
      } catch {
        /* skip malformed */
      }
    }
  }
  return h;
}

async function toArrayBuffer(body: unknown): Promise<ArrayBuffer> {
  if (body instanceof ArrayBuffer) return body;
  if (ArrayBuffer.isView(body)) {
    return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
  }
  if (typeof body === "string") {
    return new TextEncoder().encode(body).buffer as ArrayBuffer;
  }
  if (body && typeof (body as { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer === "function") {
    return (body as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer();
  }
  if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) {
    return new Response(body).arrayBuffer();
  }
  return new ArrayBuffer(0);
}

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    typeof navigator !== "undefined"
      ? navigator.userAgent
      : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export class WispError extends Error {
  code: "unreachable" | "http" | "transport";
  status?: number;
  constructor(code: WispError["code"], message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** One request through the tunnel, redirects followed by hand. */
export async function wispFetch(target: string, method = "GET"): Promise<WispResponse> {
  let url = target;

  for (let hop = 0; hop < 8; hop++) {
    let transport: Transport;
    try {
      transport = await getTransport();
    } catch {
      throw new WispError("transport", "the tunnel refused to open — epoxy or wisp is unreachable");
    }

    let res: { status: number; rawHeaders?: unknown; body?: unknown };
    try {
      res = await transport.request(url, { method, headers: BROWSER_HEADERS });
    } catch {
      throw new WispError("unreachable", `couldn't reach ${new URL(url).host} through the tunnel`);
    }

    const headers = toHeaders(res.rawHeaders);

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = headers.get("location");
      if (loc) {
        url = new URL(loc, url).href;
        continue;
      }
    }

    const body = await toArrayBuffer(res.body);
    return { status: res.status, headers, body, finalUrl: url };
  }

  throw new WispError("unreachable", "too many redirects");
}

/* ---------- service-worker bridge ----------
   sd-sw.js forwards /sd/* subresource requests here; the reply
   rides the same BroadcastChannel back. One responder (this
   page), many requests. */

const BRIDGE = "sd-sw-bridge";
let bridgeUp = false;

interface BridgeRequest {
  type: "sd-req";
  id: number;
  url: string;
  method: string;
}

export function initWispBridge(): void {
  if (bridgeUp || typeof BroadcastChannel === "undefined") return;
  bridgeUp = true;

  const channel = new BroadcastChannel(BRIDGE);
  channel.onmessage = (event: MessageEvent<BridgeRequest>) => {
    const msg = event.data;
    if (!msg || msg.type !== "sd-req") return;

    wispFetch(msg.url, msg.method || "GET")
      .then((res) => {
        channel.postMessage({
          type: "sd-res",
          id: msg.id,
          ok: true,
          status: res.status,
          headers: [...res.headers.entries()],
          body: res.body,
        });
      })
      .catch(() => {
        channel.postMessage({ type: "sd-res", id: msg.id, ok: false, status: 502, headers: [], body: new ArrayBuffer(0) });
      });
  };

  // Register the relay worker. Same-origin, our own file, tiny.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sd-sw.js").catch(() => {
      /* no SW (e.g. insecure context) — documents still load;
         some subresources will fall back to the runtime shim */
    });
  }
}
