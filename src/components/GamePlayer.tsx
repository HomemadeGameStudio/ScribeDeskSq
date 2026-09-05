import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ruffleDocument, type GameEntry, type RemoteGame } from "../lib/games";
import { CloseIcon, CompressIcon, ExpandIcon, RefreshIcon, ShieldIcon } from "./icons";

/* ============================================================
   In-page player session.
   One iframe payload at a time — clicking a different tile swaps
   the session object and the `src`/`srcDoc`; the page never
   navigates and no tab is ever spawned. Closing nulls the iframe
   src (kills audio/processes) and unmounts the frame.

   Supports every resolvable payload type:
     html → direct frame · swf → Ruffle shim · other → surfaced
   ============================================================ */

export interface PlayerSession {
  game: RemoteGame;
  /** Resolved payload. `null` while the port is being located. */
  entry: GameEntry | null;
  error: string | null;
  stealth: boolean;
  key: number;
}

interface Props {
  session: PlayerSession;
  engineLabel: string;
  onDestroy: () => void;
  onRetry: (game: RemoteGame) => void;
}

type Status = "locating" | "loading" | "live" | "error";

const STATUS_LABEL: Record<Status, string> = {
  locating: "locating",
  loading: "connecting",
  live: "live",
  error: "failed",
};

function fmt(elapsed: number): string {
  const m = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const s = (elapsed % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 26 ? `${u.pathname.slice(0, 26)}…` : u.pathname;
    return `${u.host}${path}`;
  } catch {
    return url;
  }
}

export default function GamePlayer({ session, engineLabel, onDestroy, onRetry }: Props) {
  const { game, entry, error, stealth, key } = session;

  const [closing, setClosing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [spin, setSpin] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  const shellRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closingRef = useRef(false);

  const unsupported = entry?.kind === "unsupported";
  const status: Status = error || unsupported ? "error" : !entry ? "locating" : loaded ? "live" : "loading";
  const playable = !!entry && entry.kind !== "unsupported";

  /* Fresh session (or newly resolved entry) → reset the frame state. */
  useEffect(() => {
    setLoaded(false);
    setElapsed(0);
    setClosing(false);
    closingRef.current = false;
  }, [key, entry?.url]);

  /* Session clock while live. */
  useEffect(() => {
    if (status !== "live") return;
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, [status, key, reloadKey]);

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
    if (!playable) return;
    setSpin(true);
    window.setTimeout(() => setSpin(false), 650);
    setLoaded(false);
    setElapsed(0);
    setReloadKey((k) => k + 1);
  }, [playable]);

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
        if (document.fullscreenElement) return; // let the browser exit fs first
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
          </span>

          <span className="sd-player-id">
            <span className="sd-player-title">{game.name}</span>
            <span className="sd-player-sub">
              web port · /{game.slug}
              {entry && playable && <> · {entry.file}</>}
              {entry?.kind === "swf" && <> · flash</>}
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
            <button
              className="sd-p-btn"
              onClick={reload}
              disabled={!playable}
              aria-label="Reload frame"
              title="Reload (R)"
            >
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
          {playable && entry && (
            <iframe
              key={`${key}-${reloadKey}`}
              ref={iframeRef}
              {...(entry.kind === "swf"
                ? { srcDoc: ruffleDocument(entry.url) }
                : { src: entry.url })}
              className={loaded ? "is-live" : ""}
              onLoad={() => setLoaded(true)}
              title={game.name}
              allow="fullscreen; gamepad; pointer-lock; autoplay; clipboard-write"
              allowFullScreen
            />
          )}

          <div className={`sd-player-load${status === "live" ? " is-done" : ""}${status === "error" ? " is-error" : ""}`}>
            {status === "error" ? (
              <>
                <span className="sd-player-load-title">Port unreachable</span>
                <span className="sd-player-load-sub">
                  {unsupported
                    ? `can't execute ${entry?.file ?? "nothing"} in-browser`
                    : error ?? "no entry file found"}
                </span>
                {!unsupported && (
                  <button className="sd-player-retry" onClick={() => onRetry(game)}>
                    retry resolve
                  </button>
                )}
              </>
            ) : (
              <>
                <span className="sd-player-ring" aria-hidden />
                <span className="sd-player-load-title">
                  {status === "locating" ? "Locating port" : "Establishing session"}
                </span>
                <span className="sd-player-load-sub">
                  {status === "locating"
                    ? `sniffing /${game.slug} for playable files`
                    : `${engineLabel.toLowerCase()} tunnel · ${
                        entry?.kind === "swf" ? "ruffle flash shim" : "rawcdn mirror"
                      }`}
                </span>
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
          <span className="sd-player-url" title={entry?.url}>
            {entry && playable ? shortUrl(entry.url) : "resolving entry…"}
          </span>
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
