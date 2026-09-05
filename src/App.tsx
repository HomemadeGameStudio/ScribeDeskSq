import { useEffect, useRef, useState } from "react";
import Nav from "./components/Nav";
import SearchBar, { type RoutingState } from "./components/SearchBar";
import ShortcutGrid from "./components/ShortcutGrid";
import GamesLibrary from "./components/GamesLibrary";
import GamePlayer, { type PlayerSession } from "./components/GamePlayer";
import Footer from "./components/Footer";
import SettingsModal from "./components/SettingsModal";
import {
  attachBridge,
  ENGINES,
  HANDSHAKE_STAGES,
  normalizeInput,
  openCloaked,
  resolveThrough,
  simulateTunnel,
} from "./lib/proxy";
import {
  applyCloak,
  loadSettings,
  PANIC_TARGETS,
  saveSettings,
  type SettingsState,
} from "./lib/settings";
import { describeGame, resolveGameEntry, type RemoteGame } from "./lib/games";
import type { Shortcut } from "./data/shortcuts";

type CategoryFilter = "all" | "apps" | "ai" | "games";

interface Toast {
  msg: string;
  key: number;
  leaving?: boolean;
}

const WORDMARK = "ScribeDesk";

function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function App() {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<SettingsState>(loadSettings);
  const [routing, setRouting] = useState<RoutingState | null>(null);
  const [routingId, setRoutingId] = useState<string | null>(null);
  const [player, setPlayer] = useState<PlayerSession | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [ping, setPing] = useState(24);
  const [clock, setClock] = useState(() => new Date());

  const searchRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const playerRef = useRef(player);
  playerRef.current = player;

  /* ---------- persistence + cloak side effects ---------- */

  useEffect(() => {
    saveSettings(settings);
    applyCloak(settings.cloak);
  }, [settings]);

  /* ---------- telemetry: simulated ping + clock ---------- */

  useEffect(() => {
    const id = setInterval(() => {
      setPing((p) => {
        const spike = Math.random() < 0.06 ? 22 : 0;
        const next = p + Math.round(Math.random() * 14 - 6) + spike;
        return Math.min(64, Math.max(16, next));
      });
    }, 2200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  /* ---------- toast ---------- */

  const toastTimers = useRef<number[]>([]);
  const showToast = (msg: string) => {
    toastTimers.current.forEach(clearTimeout);
    toastTimers.current = [];
    setToast({ msg, key: Date.now() });
    toastTimers.current.push(
      window.setTimeout(() => setToast((t) => (t ? { ...t, leaving: true } : t)), 2500),
      window.setTimeout(() => setToast(null), 2850)
    );
  };

  /* ---------- routing pipeline (tab tunnels) ----------
     Every destination flows through `resolveThrough` — the desk
     never opens a raw URL. */

  const finishRoute = async (label: string, url: string) => {
    await simulateTunnel((stage) => setRouting({ label, stage }));

    const s = settingsRef.current;
    const proxied = resolveThrough(s.engine, url);
    if (s.blankCloak) {
      openCloaked(proxied, label);
    } else {
      window.open(proxied, "_blank", "noopener");
    }
    showToast(`tunnel open → ${label} · ${ENGINES[s.engine].label.toLowerCase()}`);
    setRouting(null);
    setRoutingId(null);
  };

  const handleRoute = async (raw: string, source?: Shortcut) => {
    if (routing) return;
    const intent = normalizeInput(source ? source.url : raw);
    const label = source ? source.name : intent.display;
    setRouting({ label, stage: HANDSHAKE_STAGES[0] });
    setRoutingId(source?.id ?? null);
    await finishRoute(label, intent.url);
  };

  const handleCloak = (s: Shortcut) => {
    const proxied = resolveThrough(settingsRef.current.engine, s.url);
    openCloaked(proxied, s.name);
    showToast(`cloaked tab → ${s.name} (about:blank)`);
  };

  /* ---------- in-page player sessions ----------
     Clicking a game tile swaps the session payload; the page
     never navigates. The iframe src is always engine-wrapped. */

  const resolveInto = (game: RemoteGame) => {
    resolveGameEntry(game)
      .then((entry) => {
        const proxied = resolveThrough(settingsRef.current.engine, entry);
        setPlayer((p) =>
          p && p.game.slug === game.slug && !p.url && !p.error ? { ...p, url: proxied } : p
        );
      })
      .catch(() => {
        setPlayer((p) =>
          p && p.game.slug === game.slug && !p.url ? { ...p, error: `no index.html under /${game.slug}` } : p
        );
      });
  };

  const openPlayer = (game: RemoteGame) => {
    setPlayer({ game, url: null, error: null, key: Date.now() });
    resolveInto(game);
  };

  const retryPlayer = (game: RemoteGame) => {
    setPlayer((p) => (p ? { ...p, url: null, error: null, key: Date.now() } : p));
    resolveInto(game);
  };

  const destroyPlayer = () => setPlayer(null);

  const cloakGame = async (game: RemoteGame) => {
    try {
      const entry = await resolveGameEntry(game);
      const proxied = resolveThrough(settingsRef.current.engine, entry);
      openCloaked(proxied, game.name);
      showToast(`cloaked tab → ${game.name} (about:blank)`);
    } catch {
      showToast(`port missing → /${game.slug} has no index.html`);
    }
  };

  const panic = () => {
    window.location.href = PANIC_TARGETS[settingsRef.current.panicTarget].url;
  };

  /* ---------- global hooks: bridge + hotkeys ---------- */

  useEffect(() => {
    attachBridge(
      (url) => void handleRoute(url),
      (slug) => openPlayer(describeGame(slug))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

      if ((e.key === "`" || e.code === "Backquote") && !typing && settingsRef.current.panicEnabled) {
        e.preventDefault();
        panic();
        return;
      }
      if (((e.key === "/" && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) && !playerRef.current) {
        e.preventDefault();
        setSettingsOpen(false);
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- render ---------- */

  const hour = clock.getHours();
  const pingOk = ping < 45;

  return (
    <div className="sd-shell">
      <div className="ambient" aria-hidden>
        <div className="ambient-spot" />
        <div className="ambient-rules" />
        <div className="ambient-grain" />
        <div className="ambient-vignette" />
      </div>

      <Nav category={category} onCategory={setCategory} onSettings={() => setSettingsOpen(true)} />

      <main className="sd-main">
        <header className="sd-hero">
          <div className="sd-overline">
            Web proxy console · build <b>3.0.0</b>
          </div>
          <h1 className="sd-wordmark" aria-label="ScribeDesk">
            {WORDMARK.split("").map((ch, i) => (
              <span key={i} className="ch" style={{ animationDelay: `${0.22 + i * 0.045}s` }} aria-hidden>
                {ch}
              </span>
            ))}
            <span
              className="ch ch-dot"
              style={{ animationDelay: `${0.22 + WORDMARK.length * 0.045}s` }}
              aria-hidden
            >
              .
            </span>
          </h1>
          <p className="sd-tagline">
            Route anything. <strong>Trace nothing.</strong> Games load right here — the page never leaves.
          </p>

          <SearchBar
            engineLabel={ENGINES[settings.engine].label}
            routing={routing}
            onRoute={(raw) => void handleRoute(raw)}
            onEngineClick={() => setSettingsOpen(true)}
            inputRef={searchRef}
          />

          <div className="sd-hints" aria-hidden>
            <span>
              <kbd>/</kbd> focus route bar
            </span>
            <span>
              <kbd>↵</kbd> open tunnel
            </span>
            <span>
              <kbd>esc</kbd> kill player
            </span>
            {settings.panicEnabled && (
              <span>
                <kbd>~</kbd> panic bail
              </span>
            )}
          </div>
        </header>

        {category === "games" ? (
          <GamesLibrary onLaunch={openPlayer} onCloak={(g) => void cloakGame(g)} />
        ) : (
          <ShortcutGrid
            category={category}
            routingId={routingId}
            onOpen={(s) => void handleRoute(s.url, s)}
            onCloak={handleCloak}
          />
        )}
      </main>

      <Footer
        greeting={greetingFor(hour)}
        ping={ping}
        pingOk={pingOk}
        clock={clock.toLocaleTimeString("en-US", { hour12: false })}
        panicEnabled={settings.panicEnabled}
        onPanic={panic}
      />

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onPatch={(patch) => setSettings((s) => ({ ...s, ...patch }))}
        onClose={() => setSettingsOpen(false)}
      />

      {player && (
        <GamePlayer
          session={player}
          engineLabel={ENGINES[settings.engine].label}
          onDestroy={destroyPlayer}
          onRetry={retryPlayer}
        />
      )}

      {toast && (
        <div className={`sd-toast${toast.leaving ? " is-leaving" : ""}`} role="status" key={toast.key}>
          <span className="t-dot" aria-hidden />
          {toast.msg}
        </div>
      )}
    </div>
  );
}
