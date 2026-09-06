import { useCallback, useEffect, useRef, useState } from "react";
import { ENGINES, isDeployed, resolveThrough, type EngineId } from "../lib/proxy";
import {
  CloseIcon,
  CompressIcon,
  CopyIcon,
  ExpandIcon,
  RefreshIcon,
  ShieldIcon,
} from "./icons";

/* ============================================================
   In-page proxy browser. Every site, search, and link on the
   desk renders here — the desk itself never leaves, and no tab
   is ever spawned.

   Failure handling: the overlay runs a verdict system.
     unreachable — the destination never answered the probe
     misrouted   — the host served the desk itself (SPA fallback)
     timeout     — the frame stalled past the budget
     refused     — diagnosed frame refusal (X-Frame-Options/CSP)
   Any verdict swaps the viewport for an error page with a
   proxy-method switcher. Closing nulls the payload instantly.
   ============================================================ */

export interface BrowserSession {
  label: string;
  /** Raw destination (shown truncated in the address pill). */
  url: string;
  stealth: boolean;
  key: number;
}

interface Props {
  session: BrowserSession;
  engineId: EngineId;
  onSwitchEngine: (id: EngineId) => void;
  onDestroy: () => void;
}

type Verdict = "unreachable" | "misrouted" | "timeout" | "refused";

const VERDICT_COPY: Record<Verdict, { title: string; sub: (host: string) => string }> = {
  unreachable: {
    title: "Connection refused",
    sub: (h) => `${h} never answered the handshake from this network.`,
  },
  misrouted: {
    title: "Transport misrouted",
    sub: (h) => `the host served ScribeDesk itself instead of ${h} — the route fell back to the app shell.`,
  },
  timeout: {
    title: "Tunnel timed out",
    sub: (h) => `${h} stalled before the frame could establish a session.`,
  },
  refused: {
    title: "Frame rejected",
    sub: (h) => `${h} sends X-Frame-Options / CSP frame-ancestors headers that refuse embedded framing on this origin.`,
  },
};

const ENGINE_ORDER: EngineId[] = ["ultraviolet", "baremux", "rammerhead"];

function engineTag(id: EngineId): { text: string; live: boolean } {
  return isDeployed(id) ? { text: "live", live: true } : { text: "awaiting deploy", live: false };
}

function shortUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const path = u.pathname.length > 30 ? `${u.pathname.slice(0, 30)}…` : u.pathname;
    const query = u.search ? u.search.slice(0, 18) : "";
    return `${u.host}${path === "/" ? "" : path}${query}`;
  } catch {
    return raw;
  }
}

export default function BrowserOverlay({ session, engineId, onSwitchEngine, onDestroy }: Props) {
  const { label, url, stealth, key } = session;

  const proxied = resolveThrough(engineId, url);
  const engineLabel = ENGINES[engineId].label;
  const deployed = isDeployed(engineId);

  const [closing, setClosing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [isFs, setIsFs] = useState(false);
  const [spin, setSpin] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const overlayRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closingRef = useRef(false);
  const loadedRef = useRef(false);

  /* Fresh session / engine / reload → reset every signal. */
  useEffect(() => {
    setLoaded(false);
    setUnverified(false);
    setVerdict(null);
    setElapsed(0);
    setClosing(false);
    setCopied(false);
    loadedRef.current = false;
    closingRef.current = false;
  }, [key, engineId, reloadKey]);

  /* Session clock (drives the live timer + the diagnose strip). */
  useEffect(() => {
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, [key, engineId, reloadKey]);

  /* Reachability probe — no-cors HEAD. Anything that resolves
     means the host answered; a throw means it never did. */
  useEffect(() => {
    let stale = false;
    const ctl = new AbortController();
    const t = window.setTimeout(() => ctl.abort(), 6500);
    fetch(url, { method: "HEAD", mode: "no-cors", signal: ctl.signal })
      .then((res) => {
        if (!stale && res.type === "error" && !loadedRef.current && !closingRef.current) {
          setVerdict("unreachable");
        }
      })
      .catch(() => {
        if (!stale && !loadedRef.current && !closingRef.current) setVerdict("unreachable");
      });
    return () => {
      stale = true;
      window.clearTimeout(t);
      ctl.abort();
    };
  }, [key, engineId, reloadKey, url]);

  /* Stall budget — if nothing loads within 12s, call it. */
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!loadedRef.current && !closingRef.current) {
        setVerdict((v) => (v === null && !loadedRef.current ? "timeout" : v));
      }
    }, 12000);
    return () => window.clearTimeout(t);
  }, [key, engineId, reloadKey]);

  /* Scroll lock + focus management. */
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    document.documentElement.classList.add("sd-lock");
    closeRef.current?.focus();
    return () => {
      document.documentElement.classList.remove("sd-lock");
      prev?.focus?.();
    };
  }, []);

  /* ---------- instant dismissal ---------- */
  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);

    const frame = iframeRef.current;
    if (frame) frame.src = "about:blank"; // kill payload mid-animation
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);

    window.setTimeout(onDestroy, 210);
  }, [onDestroy]);

  /* Fullscreen the overlay root — not the shell beneath the blur
     layer (Chromium paints that black) — then fall back down. */
  const toggleFs = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
      return;
    }
    overlayRef.current
      ?.requestFullscreen?.()
      .catch(() =>
        document.documentElement.requestFullscreen?.().catch(() => undefined)
      );
  }, []);

  const reload = useCallback(() => {
    setSpin(true);
    window.setTimeout(() => setSpin(false), 650);
    setLoaded(false);
    setUnverified(false);
    setVerdict(null);
    setElapsed(0);
    setReloadKey((k) => k + 1);
  }, []);

  const copyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(proxied);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked — no drama */
    }
  }, [proxied]);

  const switchEngine = (id: EngineId) => {
    if (id === engineId) return;
    setSpin(true);
    window.setTimeout(() => setSpin(false), 500);
    onSwitchEngine(id); // settings update → engineId prop changes → reset effect fires
  };

  /* Frame diagnostics. Cross-origin throws on location access —
     the healthy case. Same-origin means the host served the app
     itself (SPA fallback): surface that instead of nesting it. */
  const onFrameLoad = useCallback(() => {
    if (closingRef.current) return;
    const frame = iframeRef.current;
    if (frame) {
      try {
        const href = frame.contentWindow?.location?.href ?? "";
        if (href.startsWith(location.origin)) {
          setVerdict("misrouted");
          return;
        }
      } catch {
        /* cross-origin → destination answered; we just can't peek */
        setUnverified(true);
      }
    }
    loadedRef.current = true;
    setLoaded(true);
  }, []);

  /* Fullscreen tracking. */
  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  /* Keys: Esc close · F fullscreen · R reload */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        if (document.fullscreenElement) return;
        e.preventDefault();
        close();
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFs();
      } else if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        reload();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, toggleFs, reload]);

  const mins = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const secs = (elapsed % 60).toString().padStart(2, "0");

  const showStrip = !verdict && !closing && elapsed >= 5 && (loaded ? unverified : true);
  const copy = verdict ? VERDICT_COPY[verdict] : null;

  return (
    <div
      ref={overlayRef}
      className={`sd-player-overlay${closing ? " is-closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${label} — in-page browser`}
    >
      <div className="sd-player sd-browser" ref={shellRef}>
        {/* ---------- chrome bar ---------- */}
        <header className="sd-player-head">
          <span className="sd-browser-dots" aria-hidden>
            <i /><i /><i />
          </span>

          <button
            className={`sd-addr${copied ? " is-copied" : ""}`}
            onClick={() => void copyAddress()}
            title="Copy proxied address"
            aria-label={`Proxied address for ${label}. Click to copy.`}
          >
            <span className="dot" aria-hidden />
            <span className="url">{copied ? "copied to clipboard" : shortUrl(url)}</span>
            <span className="copy" aria-hidden>
              <CopyIcon size={13} />
            </span>
          </button>

          <span
            className={`sd-player-status is-${verdict ? "error" : loaded ? "live" : "loading"}`}
            role="status"
          >
            <span className="sd-player-dot" aria-hidden />
            {verdict ? "failed" : loaded ? "live" : deployed ? "tunneling" : "loading"}
            {loaded && !verdict && <span className="sd-player-timer">{mins}:{secs}</span>}
          </span>

          {stealth && (
            <span className="sd-stealth-chip" title="Stealth session — tab identity cloaked">
              <ShieldIcon size={12} />
              stealth
            </span>
          )}

          <span className="sd-player-actions">
            <button
              className="sd-p-btn"
              onClick={toggleFs}
              aria-label={isFs ? "Exit fullscreen" : "Enter fullscreen"}
              title={isFs ? "Exit fullscreen (F)" : "Fullscreen (F)"}
            >
              {isFs ? <CompressIcon size={16} /> : <ExpandIcon size={16} />}
            </button>
            <button className="sd-p-btn" onClick={reload} aria-label="Reload frame" title="Reload (R)">
              <span className={`sd-p-spin${spin ? " is-spinning" : ""}`}>
                <RefreshIcon size={16} />
              </span>
            </button>
            <button className="sd-p-close" ref={closeRef} onClick={close} aria-label="Close browser" title="Close (Esc)">
              <CloseIcon size={15} />
            </button>
          </span>

          <span className={`sd-player-progress${!loaded && !verdict ? " is-on" : ""}`} aria-hidden />
        </header>

        {/* ---------- viewport ---------- */}
        <div className="sd-player-view">
          {!verdict && (
            <iframe
              key={`${key}-${engineId}-${reloadKey}`}
              ref={iframeRef}
              src={proxied}
              className={loaded ? "is-live" : ""}
              onLoad={onFrameLoad}
              title={label}
              allow="fullscreen; gamepad; pointer-lock; autoplay; clipboard-write; camera; microphone; geolocation"
              allowFullScreen
            />
          )}

          {/* ---------- error page ---------- */}
          {verdict && copy && (
            <div className="sd-err" role="alert">
              <span className="sd-err-badge" aria-hidden>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3.6 22 20H2Z" />
                  <path d="M12 10v4.4" />
                  <circle cx="12" cy="17.1" r="0.5" fill="currentColor" />
                </svg>
              </span>
              <h3>{copy.title}</h3>
              <p>{copy.sub(shortUrl(url))}</p>

              <div className="sd-err-switch">switch proxy method</div>
              <div className="sd-err-engines">
                {ENGINE_ORDER.map((id) => {
                  const active = id === engineId;
                  const tag = engineTag(id);
                  return (
                    <button
                      key={id}
                      className="sd-err-engine"
                      disabled={active}
                      onClick={() => switchEngine(id)}
                      title={active ? "Currently armed" : `Route through ${ENGINES[id].label}`}
                    >
                      <b>
                        {ENGINES[id].label}
                        {active && <span className="active-flag">armed</span>}
                      </b>
                      <span className={`sd-engine-state${tag.live ? " is-live" : ""}`}>{tag.text}</span>
                    </button>
                  );
                })}
              </div>

              <div className="sd-err-actions">
                <button className="sd-err-btn primary" onClick={reload}>
                  retry · {engineLabel.toLowerCase()}
                </button>
                <button className="sd-err-btn" onClick={close}>
                  close browser
                </button>
              </div>
            </div>
          )}

          {/* ---------- load panel ---------- */}
          {!verdict && (
            <div className={`sd-player-load${loaded ? " is-done" : ""}`}>
              <span className="sd-player-ring" aria-hidden />
              <span className="sd-player-load-title">
                {deployed ? "Establishing tunnel" : "Framing destination"}
              </span>
              <span className="sd-player-load-sub">
                {engineLabel.toLowerCase()} · {shortUrl(url)}
              </span>
            </div>
          )}

          {/* ---------- stalled diagnose strip ---------- */}
          {showStrip && (
            <button
              className="sd-strip-btn"
              onClick={() => setVerdict("refused")}
              title="Destination not rendering? Open the error page"
            >
              <span className="tag">stalled</span>
              not visible? the destination may refuse framing — diagnose
            </button>
          )}
        </div>

        {/* ---------- status strip ---------- */}
        <footer className="sd-player-foot">
          <span className="sd-player-engine">
            <span className="dot" aria-hidden />
            {engineLabel}
          </span>
          <span className="sd-player-url" title={url}>
            {url}
          </span>
          {!isDeployed(engineId) && (
            <span className="sd-browser-note">
              slot not deployed — routing via the direct in-page frame
            </span>
          )}
          <span className="sd-player-hints">
            <span><kbd>esc</kbd>close</span>
            <span><kbd>F</kbd>fullscreen</span>
            <span><kbd>R</kbd>reload</span>
          </span>
        </footer>
      </div>
    </div>
  );
}
