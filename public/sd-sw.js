/* ============================================================
   ScribeDesk subresource relay
   ------------------------------------------------------------
   Proxied documents (same-origin srcDoc frames) reference their
   assets as  /sd/<encoded-url>/…   — this worker catches those
   fetches and round-trips them to the page, which owns the live
   wisp tunnel. The worker itself has zero dependencies and
   never touches the network on its own.
   ============================================================ */

const PREFIX = "/sd/";
const BRIDGE = "sd-sw-bridge";

let seq = 0;
const pending = new Map();
const channel = new BroadcastChannel(BRIDGE);

channel.onmessage = (event) => {
  const msg = event.data;
  if (!msg || msg.type !== "sd-res") return;
  const job = pending.get(msg.id);
  if (!job) return;
  pending.delete(msg.id);
  job(msg);
};

/* url-safe base64 → original URL (mirrors src/lib/wisp.ts) */
function decodeUrl(enc) {
  let b = enc.replace(/-/g, "+").replace(/_/g, "/");
  while (b.length % 4) b += "=";
  return decodeURIComponent(escape(atob(b)));
}

function targetFor(pathname, search) {
  const rest = pathname.slice(PREFIX.length);
  const slash = rest.indexOf("/");
  const enc = slash === -1 ? rest : rest.slice(0, slash);
  const extra = slash === -1 ? "" : rest.slice(slash + 1);
  const base = decodeUrl(enc);

  if (extra === "") return base + search;
  // relative extras resolve against the encoded page URL
  return new URL(extra + search, base).href;
}

function relay(request, target) {
  const id = ++seq;
  const headers = [];
  for (const [k, v] of request.headers.entries()) {
    const lk = k.toLowerCase();
    if (lk === "host" || lk === "connection" || lk === "content-length") continue;
    headers.push([k, v]);
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve(null);
    }, 20000);

    pending.set(id, (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });

    channel.postMessage({
      type: "sd-req",
      id,
      url: target,
      method: request.method,
      headers,
    });
  });
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(PREFIX)) return;
  if (event.request.method !== "GET" && event.request.method !== "HEAD") return;

  let target;
  try {
    target = targetFor(url.pathname, url.search);
  } catch {
    event.respondWith(new Response("bad proxy url", { status: 400 }));
    return;
  }

  event.respondWith(
    (async () => {
      const msg = await relay(event.request, target);
      if (!msg || !msg.ok) {
        return new Response("tunnel unreachable", { status: 502 });
      }
      const headers = new Headers();
      for (const [k, v] of msg.headers || []) {
        const lk = k.toLowerCase();
        // hop-by-hop + framing headers would poison the response
        if (
          lk === "content-encoding" ||
          lk === "transfer-encoding" ||
          lk === "content-length" ||
          lk === "connection" ||
          lk === "content-security-policy" ||
          lk === "content-security-policy-report-only" ||
          lk === "x-frame-options" ||
          lk === "cross-origin-embedder-policy" ||
          lk === "cross-origin-opener-policy"
        ) {
          continue;
        }
        try {
          headers.append(k, v);
        } catch {
          /* skip */
        }
      }
      return new Response(msg.body, { status: msg.status || 200, headers });
    })()
  );
});
