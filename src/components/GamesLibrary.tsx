import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { fetchGames, REPO_URL, type RemoteGame } from "../lib/games";
import { GamepadIcon, RefreshIcon, ShieldIcon } from "./icons";

interface Props {
  onLaunch: (game: RemoteGame) => void;
  onCloak: (game: RemoteGame) => void;
}

type Phase = "loading" | "ready" | "error";

export default function GamesLibrary({ onLaunch, onCloak }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [games, setGames] = useState<RemoteGame[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  const sync = useCallback(async () => {
    setPhase("loading");
    try {
      const res = await fetchGames();
      setGames(res.games);
      setFromCache(res.cached);
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void sync();
  }, [sync]);

  const launch = (g: RemoteGame) => {
    if (busySlug) return;
    setBusySlug(g.slug);
    onLaunch(g);
  };

  /* The parent owns the session; once the player is destroyed the
     tile frees up again. We watch for that via a custom event. */
  useEffect(() => {
    const clear = () => setBusySlug(null);
    window.addEventListener("sd:player-closed", clear);
    return () => window.removeEventListener("sd:player-closed", clear);
  }, []);

  return (
    <section className="sd-shelf" aria-label="Game shelf">
      <div className="sd-shelf-head">
        <div className="sd-shelf-id">
          <span className="sd-shelf-glyph" aria-hidden>
            <GamepadIcon size={17} />
          </span>
          <span>
            <h2 className="sd-shelf-title">Game shelf</h2>
          </span>
        </div>

        <div className="sd-shelf-meta">
          {phase === "ready" && (
            <>
              <span>{games.length} ports</span>
              {fromCache && <span className="sd-chip-state is-cached">cached</span>}
              <a className="src-link" href={REPO_URL} target="_blank" rel="noreferrer">
                src
              </a>
            </>
          )}
          {phase === "loading" && <span>syncing repo…</span>}
          <button
            className="sd-sync-btn"
            onClick={() => void sync()}
            disabled={phase === "loading"}
            aria-label="Re-sync game list from GitHub"
            title="Re-sync from GitHub"
          >
            <RefreshIcon size={14} />
          </button>
        </div>
      </div>

      {phase === "loading" && (
        <div className="sd-shelf-skel" aria-hidden>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="sd-skel-tile" style={{ animationDelay: `${i * 90}ms` }} />
          ))}
        </div>
      )}

      {phase === "error" && (
        <div className="sd-shelf-error" role="alert">
          <b>Shelf unreachable</b>
          <span>github api refused the listing · check your connection</span>
          <button className="sd-retry-btn" onClick={() => void sync()}>
            retry sync
          </button>
        </div>
      )}

      {phase === "ready" && (
        <div className="sd-game-grid">
          {games.map((g, i) => (
            <button
              key={g.slug}
              className={`sd-game-tile${busySlug === g.slug ? " is-busy" : ""}`}
              style={{ "--hue": g.hue, "--hue2": (g.hue + 46) % 360, animationDelay: `${Math.min(i, 11) * 45}ms` } as CSSProperties}
              onClick={() => launch(g)}
              aria-label={`Launch ${g.name} in the in-page player`}
            >
              <span className="sd-tile-top">
                <span className="sd-tile-mono" aria-hidden>
                  {g.name.charAt(0)}
                </span>
                <span className="sd-tile-tag">web port</span>
              </span>

              <span className="sd-tile-bottom">
                <span>
                  <span className="sd-tile-name">{g.name}</span>
                  <span className="sd-tile-slug">/{g.slug}</span>
                </span>
                <span className="sd-tile-play" aria-hidden>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5.5v13l11-6.5Z" />
                  </svg>
                </span>
              </span>

              <span
                className="sd-tile-cloak"
                role="button"
                tabIndex={0}
                title={`Open ${g.name} in a cloaked about:blank tab`}
                aria-label={`Open ${g.name} cloaked`}
                onClick={(e) => {
                  e.stopPropagation();
                  onCloak(g);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onCloak(g);
                  }
                }}
              >
                <ShieldIcon size={13} />
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
