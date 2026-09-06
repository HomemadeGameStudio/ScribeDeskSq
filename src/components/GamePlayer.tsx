import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { MIRRORS, probeHead, ruffleDocument, type GameEntry, type RemoteGame } from "../lib/games";
import { resolveThrough } from "../lib/proxy";
import { CloseIcon, CompressIcon, ExpandIcon, RefreshIcon, ShieldIcon } from "./icons";

/* ============================================================
   In-page player session.
   One iframe payload at a time — clicking a different tile swaps
   the session and the frame; the page never navigates, no tab is
   ever spawned. Closing nulls the iframe src so audio/processes
   die instantly.

   Payload pipeline:
     1. entry resolution → relative file inside the port folder
     2. mirror ladder    → probe raw.githack → gitloaf →
        statically → rawcdn, mount the first CDN that answers
     3. engine wrap      → resolveThrough (embedded by default)

   The loader is dismissible: huge ports take minutes to fire
   `load`, so a click reveals the frame early to watch progress.
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
  engineId: string;
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

/** Seconds before hinting that the loader can be dismissed. */
const SLOW_HINT_S = 8;

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

export default function GamePlayer({ session, engineId, engineLabel, onDestroy, onRetry }: Props) {
  const { game, entry, error, stealth, key } = session;

  const [closing, setClosing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [slowHint, setSlowHint] = useState(false);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [mirrorIdx, setMirrorIdx] = useState(0);
  const [ladderFailed, setLadderFailed] = useState(false);
  const [ladderTick, setLadderTick] = useState(0);
  const [isFs, setIsFs] = useState(false);
  const [spin, setSpin] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  const shellRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closingRef = useRef(false);

  const unsupported = entry?.kind === "unsupported";
  const playable = !!entry && entry.kind !== "unsupported";
  const loaderGone = loaded || revealed;
  const status: Status =
    error || unsupported || ladderFailed ? "error" : !entry ? "locating" : loaded ? "live" : "loading";

  /* ---------- mirror ladder: probe CDNs, mount the first that serves ---------- */
  useEffect(() => {
    setFrameUrl(null);
    setLoaded(false);
    setRevealed(false);
    setSlowHint(false);
    setLadderFailed(false);
    setElapsed(0);
    setMirrorIdx(0);
    setClosing(false);
    closingRef.current = false;

    if (!entry || entry.kind === "unsupported") return;

    let cancelled = false;
    const path = `${game.slug}/${entry.file}`;

    (async () => {
      for (let i = 0; i < MIRRORS.length; i++) {
        if (cancelled) return;
        const ok = await probeHead(MIRRORS[i].build(path));
        if (cancelled) return;
        if (ok) {
          setMirrorIdx(i);
          setFrameUrl(resolveThrough(engineId, MIRRORS[i].build(path)));
          return;
        }
      }
      if (!cancelled) setLadderFailed(true);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, entry, ladderTick]);

  /* Heavy ports stall long before `load` fires — offer the reveal early. */
  useEffect(() => {
    if (!frameUrl || loaderGone) return;
    const id = window.setTimeout(() => setSlowHint(true), SLOW_HINT_S * 1000);
    return () => window.clearTimeout(id);
  }, [frameUrl, loaderGone, reloadKey]);

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
    setRevealed(false);
    setSlowHint(false);
    setElapsed(0);
    setReloadKey((k) => k + 1);
  }, [playable]);

  /* Manual mirror switch — mounts immediately, no probing. */
  const cycleMirror = useCallback(() => {
    if (!entry || entry.kind === "unsupported") return;
    const next = (mirrorIdx + 1) % MIRRORS.length;
    const path = `${game.slug}/${entry.file}`;
    setMirrorIdx(next);
    setFrameUrl(resolveThrough(engineId, MIRRORS[next].build(path)));
    setLoaded(false);
    setRevealed(false);
    setSlowHint(false);
    setLadderFailed(false);
    setElapsed(0);
    setReloadKey((k) => k + 1);
  }, [entry, mirrorIdx, game.slug, engineId]);

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

  const revealLoader = () => {
    if (frameUrl && !loaderGone) setRevealed(true);
  };

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
          {playable && frameUrl && (
            <iframe
              key={`${key}-${reloadKey}`}
              ref={iframeRef}
              {...(entry?.kind === "swf" ? { srcDoc: ruffleDocument(frameUrl) } : { src: frameUrl })}
              className={loaderGone ? "is-live" : ""}
              onLoad={() => setLoaded(true)}
              title={game.name}
              allow="fullscreen; gamepad; pointer-lock; autoplay; clipboard-write"
              allowFullScreen
            />
          )}

          <div
            className={`sd-player-load${loaderGone ? " is-done" : ""}${status === "error" ? " is-error" : ""}${
              frameUrl && status !== "error" ? " has-frame" : ""
            }`}
            onClick={revealLoader}
            role={frameUrl && status !== "error" ? "button" : undefined}
            aria-label={frameUrl && status !== "error" ? "Dismiss loader and reveal the game frame" : undefined}
          >
            {status === "error" ? (
              <>
                <span className="sd-player-load-title">
                  {unsupported ? "Unsupported port" : ladderFailed ? "Every mirror failed" : "Port unreachable"}
                </span>
                <span className="sd-player-load-sub">
                  {unsupported
                    ? `can't execute ${entry?.file ?? "nothing"} in-browser`
                    : ladderFailed
                      ? `no CDN would serve /${game.slug}/${entry?.file ?? "index.html"} — switch mirrors or retry`
                      : error ?? "no entry file found"}
                </span>
                {ladderFailed ? (
                  <span className="sd-err-row">
                    <button className="sd-player-retry" onClick={cycleMirror}>
                      switch mirror
                    </button>
                    <button className="sd-player-retry" onClick={() => setLadderTick((t) => t + 1)}>
                      retry ladder
                    </button>
                  </span>
                ) : (
                  !unsupported && (
                    <button className="sd-player-retry" onClick={() => onRetry(game)}>
                      retry resolve
                    </button>
                  )
                )}
              </>
            ) : (
              <>
                <span className="sd-player-ring" aria-hidden />
                <span className="sd-player-load-title">
                  {!entry ? "Locating port" : frameUrl ? "Streaming port" : "Probing mirrors"}
                </span>
                <span className="sd-player-load-sub">
                  {!entry
                    ? `sniffing /${game.slug} for playable files`
                    : `${MIRRORS[mirrorIdx].label} mirror · ${engineLabel.toLowerCase()} tunnel`}
                </span>
                {slowHint && frameUrl && (
                  <span className="sd-player-load-hint">large ports take a while — click to reveal the frame</span>
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
            disabled={!playable}
            title="Switch CDN mirror (M)"
            aria-label={`CDN mirror: ${MIRRORS[mirrorIdx].label}. Click to switch.`}
          >
            mirror · {MIRRORS[mirrorIdx].label}
          </button>
          <span className="sd-player-url" title={frameUrl ?? undefined}>
            {frameUrl ? shortUrl(frameUrl) : "resolving entry…"}
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
