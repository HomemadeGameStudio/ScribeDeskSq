import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { loadPort, mirrorLadder, MIRRORS, type PortPayload, type RemoteGame } from "../lib/games";
import { coverArt } from "../lib/gameArt";
import { CloseIcon, CompressIcon, ExpandIcon, RefreshIcon, ShieldIcon } from "./icons";

/* ============================================================
   In-page player session.
   Clicking a different tile swaps the session; the page never
   navigates and no tab is ever spawned. Closing blanks the
   iframe srcDoc so audio/processes die instantly.

   Payload pipeline (owned entirely by this component):
     1. loadPort()   → fetches the entry HTML from a CORS-open
        mirror, injects <base> + the absolute-path shim, and
        returns a mountable same-origin document
     2. mount        → srcDoc iframe; `load` fires as soon as the
        document parses, the port's own loading screen takes over
     3. mirrors      → manual cycling (chip / M key), remembered
        per game whenever one actually serves
   ============================================================ */

export interface PlayerSession {
  game: RemoteGame;
  stealth: boolean;
  key: number;
}

interface Props {
  session: PlayerSession;
  engineLabel: string;
  onDestroy: () => void;
}

type Status = "locating" | "loading" | "live" | "error";

const STATUS_LABEL: Record<Status, string> = {
  locating: "locating",
  loading: "booting",
  live: "live",
  error: "failed",
};

/** Seconds before reassuring the user that big ports pull slowly. */
const SLOW_HINT_S = 12;

function fmt(elapsed: number): string {
  const m = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const s = (elapsed % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function GamePlayer({ session, engineLabel, onDestroy }: Props) {
  const { game, stealth, key } = session;

  const [payload, setPayload] = useState<PortPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mirrorId, setMirrorId] = useState<string>(mirrorLadder(game.slug)[0]);
  const [onlyMirror, setOnlyMirror] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const [closing, setClosing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [slowHint, setSlowHint] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [spin, setSpin] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const shellRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closingRef = useRef(false);

  const status: Status = error ? "error" : !payload ? "locating" : loaded ? "live" : "loading";
  const mirrorLabel = MIRRORS.find((m) => m.id === mirrorId)?.label ?? mirrorId;

  const art = coverArt(game.slug);
  const [artOk, setArtOk] = useState(true);
  useEffect(() => setArtOk(true), [game.slug]);

  /* ---------- load the port ---------- */
  useEffect(() => {
    setPayload(null);
    setError(null);
    setLoaded(false);
    setSlowHint(false);
    setElapsed(0);
    setClosing(false);
    closingRef.current = false;

    let cancelled = false;
    loadPort(game, onlyMirror ? { only: onlyMirror } : undefined)
      .then((p) => {
        if (!cancelled) {
          setPayload(p);
          setMirrorId(p.mirrorId);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "port failed to load");
      });

    return () => {
      cancelled = true;
    };
  }, [game, key, tick, onlyMirror]);

  /* Big ports pull hundreds of MB — reassure after a while. */
  useEffect(() => {
    if (status !== "locating") return;
    const id = window.setTimeout(() => setSlowHint(true), SLOW_HINT_S * 1000);
    return () => window.clearTimeout(id);
  }, [status, tick, key]);

  /* Session clock while live. */
  useEffect(() => {
    if (status !== "live") return;
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  /* Scroll lock + focus the close button; restore on unmount. */
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

    // Kill the payload immediately so audio/processes stop mid-animation.
    const frame = iframeRef.current;
    if (frame) frame.src = "about:blank";
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);

    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("sd:player-closed"));
      onDestroy();
    }, 210);
  }, [onDestroy]);

  const toggleFs = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    } else {
      shellRef.current?.requestFullscreen?.().catch(() => {
        iframeRef.current?.requestFullscreen?.().catch(() => undefined);
      });
    }
  }, []);

  const reload = useCallback(() => {
    setSpin(true);
    window.setTimeout(() => setSpin(false), 650);
    setTick((t) => t + 1);
  }, []);

  /* Manual mirror switch — retry through one specific mirror. */
  const cycleMirror = useCallback(() => {
    const order = mirrorLadder(game.slug);
    const next = order[(order.indexOf(mirrorId) + 1) % order.length];
    setOnlyMirror(next);
    setTick((t) => t + 1);
  }, [game.slug, mirrorId]);

  const retryAllMirrors = useCallback(() => {
    setOnlyMirror(null);
    setTick((t) => t + 1);
  }, []);

  /* Fullscreen tracking. */
  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  /* Keys: Esc close · F fullscreen · R reload · M mirror */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        if (document.fullscreenElement) return; // let the browser exit fs first
        e.preventDefault();
        close();
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFs();
      } else if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        reload();
      } else if (e.key.toLowerCase() === "m") {
        e.preventDefault();
        cycleMirror();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, toggleFs, reload, cycleMirror]);

  return (
    <div
      className={`sd-player-overlay${closing ? " is-closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${game.name} player`}
    >
      <div className="sd-player" ref={shellRef}>
        {/* ---------- header bar ---------- */}
        <header className="sd-player-head">
          <span
            className="sd-player-mono"
            style={
              {
                "--hue": game.hue,
                background: `linear-gradient(135deg, hsl(${game.hue} 72% 52%), hsl(${(game.hue + 46) % 360} 66% 34%))`,
              } as CSSProperties
            }
            aria-hidden
          >
            {game.name.charAt(0)}
            {art && artOk && (
              <img
                className="sd-mono-img"
                src={art}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setArtOk(false)}
              />
            )}
          </span>

          <span className="sd-player-id">
            <span className="sd-player-title">{game.name}</span>
            <span className="sd-player-sub">
              web port · /{game.slug}
              {payload && <> · {payload.file}</>}
              {payload?.kind === "swf" && <> · flash</>}
            </span>
          </span>

          <span className={`sd-player-status is-${status}`} role="status">
            <span className="sd-player-dot" aria-hidden />
            {STATUS_LABEL[status]}
            {status === "live" && <span className="sd-player-timer">{fmt(elapsed)}</span>}
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
            <button className="sd-p-btn" onClick={reload} aria-label="Reload port" title="Reload (R)">
              <span className={`sd-p-spin${spin ? " is-spinning" : ""}`}>
                <RefreshIcon size={16} />
              </span>
            </button>
            <button className="sd-p-close" ref={closeRef} onClick={close} aria-label="Close player" title="Close (Esc)">
              <CloseIcon size={15} />
            </button>
          </span>

          <span className={`sd-player-progress${status === "locating" || status === "loading" ? " is-on" : ""}`} aria-hidden />
        </header>

        {/* ---------- viewport ---------- */}
        <div className="sd-player-view">
          {payload && (
            <iframe
              key={`${key}-${tick}`}
              ref={iframeRef}
              srcDoc={payload.doc}
              className={loaded ? "is-live" : ""}
              onLoad={() => setLoaded(true)}
              title={game.name}
              allow="fullscreen; gamepad; pointer-lock; autoplay; clipboard-write"
              allowFullScreen
            />
          )}

          <div className={`sd-player-load${loaded ? " is-done" : ""}${status === "error" ? " is-error" : ""}`}>
            {status === "error" ? (
              <>
                <span className="sd-player-load-title">Port unreachable</span>
                <span className="sd-player-load-sub">{error ?? "the mirrors refused this port"}</span>
                <span className="sd-err-row">
                  <button className="sd-player-retry" onClick={cycleMirror}>
                    switch mirror
                  </button>
                  <button className="sd-player-retry" onClick={retryAllMirrors}>
                    try all mirrors
                  </button>
                </span>
              </>
            ) : (
              <>
                <span className="sd-player-ring" aria-hidden />
                <span className="sd-player-load-title">
                  {payload ? "Booting port" : "Pulling port files"}
                </span>
                <span className="sd-player-load-sub">
                  {mirrorLabel} mirror · {engineLabel.toLowerCase()} armed
                </span>
                {slowHint && (
                  <span className="sd-player-load-hint">
                    big ports pull hundreds of MB — the mirror is still working
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* ---------- status strip ---------- */}
        <footer className="sd-player-foot">
          <span className="sd-player-engine">
            <span className="dot" aria-hidden />
            {engineLabel}
          </span>
          <button
            className="sd-mirror-chip"
            onClick={cycleMirror}
            title="Switch CDN mirror (M)"
            aria-label={`CDN mirror: ${mirrorLabel}. Click to switch.`}
          >
            mirror · {mirrorLabel}
          </button>
          <span className="sd-player-url" title={payload?.file}>
            {payload ? `/${game.slug}/${payload.file}` : "resolving entry…"}
          </span>
          <span className="sd-player-hints">
            <span><kbd>esc</kbd>close</span>
            <span><kbd>F</kbd>fullscreen</span>
            <span><kbd>R</kbd>reload</span>
            <span><kbd>M</kbd>mirror</span>
          </span>
        </footer>
      </div>
    </div>
  );
}
