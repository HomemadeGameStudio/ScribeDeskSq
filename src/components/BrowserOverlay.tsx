import { useCallback, useEffect, useRef, useState } from "react";
import { CloseIcon, CompressIcon, CopyIcon, ExpandIcon, RefreshIcon, ShieldIcon } from "./icons";

/* ============================================================
   In-page proxy browser. Every site, search, and link on the
   desk renders here — the desk itself never leaves, and no tab
   is ever spawned. Closing nulls the iframe src so the payload
   dies instantly (audio, sockets, scripts).
   ============================================================ */

export interface BrowserSession {
  label: string;
  /** Raw destination (shown truncated in the address pill). */
  url: string;
  /** Engine-wrapped URL loaded into the frame. */
  proxied: string;
  stealth: boolean;
  key: number;
}

interface Props {
  session: BrowserSession;
  engineLabel: string;
  /** Whether the active engine has a real transport (or is the embedded frame). */
  deployed: boolean;
  onDestroy: () => void;
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

export default function BrowserOverlay({ session, engineLabel, deployed, onDestroy }: Props) {
  const { label, url, proxied, stealth, key } = session;

  const [closing, setClosing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [spin, setSpin] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const shellRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closingRef = useRef(false);

  /* Fresh session → reset frame state. */
  useEffect(() => {
    setLoaded(false);
    setElapsed(0);
    setClosing(false);
    setCopied(false);
    closingRef.current = false;
  }, [key, proxied]);

  /* Session clock while live. */
  useEffect(() => {
    if (!loaded) return;
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, [loaded, key, reloadKey]);

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

  const toggleFs = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    } else {
      shellRef.current?.requestFullscreen?.().catch(() => undefined);
    }
  }, []);

  const reload = useCallback(() => {
    setSpin(true);
    window.setTimeout(() => setSpin(false), 650);
    setLoaded(false);
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

  return (
    <div
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

          <span className={`sd-player-status is-${loaded ? "live" : "loading"}`} role="status">
            <span className="sd-player-dot" aria-hidden />
            {loaded ? "live" : deployed ? "tunneling" : "loading"}
            {loaded && <span className="sd-player-timer">{mins}:{secs}</span>}
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

          <span className={`sd-player-progress${loaded ? "" : " is-on"}`} aria-hidden />
        </header>

        {/* ---------- viewport ---------- */}
        <div className="sd-player-view">
          <iframe
            key={`${key}-${reloadKey}`}
            ref={iframeRef}
            src={proxied}
            className={loaded ? "is-live" : ""}
            onLoad={() => setLoaded(true)}
            title={label}
            allow="fullscreen; gamepad; pointer-lock; autoplay; clipboard-write; camera; microphone; geolocation"
            allowFullScreen
          />

          <div className={`sd-player-load${loaded ? " is-done" : ""}`}>
            <span className="sd-player-ring" aria-hidden />
            <span className="sd-player-load-title">
              {deployed ? "Establishing tunnel" : "Framing destination"}
            </span>
            <span className="sd-player-load-sub">
              {engineLabel.toLowerCase()} · {shortUrl(url)}
            </span>
          </div>
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
          {!deployed && (
            <span className="sd-browser-note">
              embedded frame — sites that refuse framing need a live engine
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
