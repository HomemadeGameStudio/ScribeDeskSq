import { useEffect, useRef, useState } from "react";
import Nav from "./components/Nav";
import SearchBar, { type RoutingState } from "./components/SearchBar";
import ShortcutGrid from "./components/ShortcutGrid";
import GamesLibrary from "./components/GamesLibrary";
import GamePlayer, { type PlayerSession } from "./components/GamePlayer";
import BrowserOverlay, { type BrowserSession } from "./components/BrowserOverlay";
import Footer from "./components/Footer";
import SettingsModal from "./components/SettingsModal";
import {
  attachBridge,
  ENGINES,
  HANDSHAKE_STAGES,
  isDeployed,
  normalizeInput,
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
  const [browser, setBrowser] = useState<BrowserSession | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [ping, setPing] = useState(24);
  const [clock, setClock] = useState(() => new Date());

  const searchRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const playerRef = useRef(player);
  playerRef.current = player;
  const browserRef = useRef(browser);
  browserRef.current = browser;
  const stealthRef = useRef(false);

  /* ---------- persistence + cloak side effects ---------- */

  useEffect(() => {
    saveSettings(settings);
    if (!stealthRef.current) applyCloak(settings.cloak);
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

  /* ---------- stealth cloaking ----------
     While a stealth session is open, the tab identity is rewritten
     to the configured cloak (Classroom by default) and restored
     the moment the session is destroyed. */

  const beginStealth = (stealth: boolean) => {
    if (!stealth) return;
    stealthRef.current = true;
    const s = settingsRef.current;
    applyCloak(s.cloak !== "none" ? s.cloak : "classroom");
  };

  const endStealth = () => {
    if (!stealthRef.current) return;
    stealthRef.current = false;
    applyCloak(settingsRef.current.cloak);
  };

  /* ---------- in-page routing pipeline ----------
     Every destination is engine-wrapped and rendered inside the
     on-page proxy viewport. No window.open. No tabs. Ever. */

  const finishRoute = async (url: string, label: string, stealth: boolean) => {
    await simulateTunnel((stage) => setRouting({ label, stage }));

    const s = settingsRef.current;
    const proxied = resolveThrough(s.engine, url);
    beginStealth(stealth);
    setBrowser({ label, url, proxied, stealth, key: Date.now() });
    showToast(`in-page → ${label} · ${ENGINES[s.engine].label.toLowerCase()}`);
    setRouting(null);
    setRoutingId(null);
  };

  const handleRoute = async (raw: string, source?: Shortcut) => {
    if (routing) return;
    const intent = normalizeInput(source ? source.url : raw);
    const label = source ? source.name : intent.display;
    setRouting({ label, stage: HANDSHAKE_STAGES[0] });
    setRoutingId(source?.id ?? null);
    await finishRoute(intent.url, label, false);
  };

  const handleStealth = async (s: Shortcut) => {
    if (routing) return;
    setRouting({ label: s.name, stage: HANDSHAKE_STAGES[0] });
    setRoutingId(s.id);
    await finishRoute(s.url, s.name, true);
  };

  const destroyBrowser = () => {
    setBrowser(null);
    endStealth();
  };

  /* ---------- in-page player sessions ---------- */

  const resolveInto = (game: RemoteGame) => {
    resolveGameEntry(game)
      .then((entry) => {
        const proxied = { ...entry, url: resolveThrough(settingsRef.current.engine, entry.url) };
        setPlayer((p) =>
          p && p.game.slug === game.slug && !p.entry && !p.error ? { ...p, entry: proxied } : p
        );
      })
      .catch((err: unknown) => {
        setPlayer((p) =>
          p && p.game.slug === game.slug && !p.entry
            ? { ...p, error: err instanceof Error ? err.message : "resolve failed" }
            : p
        );
      });
  };

  const openPlayer = (game: RemoteGame, stealth = false) => {
    beginStealth(stealth);
    setPlayer({ game, entry: null, error: null, stealth, key: Date.now() });
    resolveInto(game);
  };

  const retryPlayer = (game: RemoteGame) => {
    setPlayer((p) => (p ? { ...p, entry: null, error: null, key: Date.now() } : p));
    resolveInto(game);
  };

  const destroyPlayer = () => {
    setPlayer(null);
    endStealth();
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
      const sessionOpen = !!playerRef.current || !!browserRef.current;
      if (((e.key === "/" && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) && !sessionOpen) {
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
            Web proxy console · build <b>3.1.0</b>
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
            Route anything. <strong>Trace nothing.</strong> Every site and game renders right here —
            the desk never spawns a tab.
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
              <kbd>↵</kbd> open in-page
            </span>
            <span>
              <kbd>esc</kbd> kill session
            </span>
            {settings.panicEnabled && (
              <span>
                <kbd>~</kbd> panic bail
              </span>
            )}
          </div>
        </header>

        {category === "games" ? (
          <GamesLibrary
            onLaunch={openPlayer}
            onBrowse={(url) => void finishRoute(url, new URL(url).hostname, false)}
          />
        ) : (
          <ShortcutGrid
            category={category}
            routingId={routingId}
            onOpen={(s) => void handleRoute(s.url, s)}
            onStealth={(s) => void handleStealth(s)}
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
        onBrowse={(url) => void finishRoute(url, new URL(url).hostname, false)}
      />

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onPatch={(patch) => {
          setSettings((s) => ({ ...s, ...patch }));
          if (patch.engine && !isDeployed(patch.engine)) {
            showToast(`${ENGINES[patch.engine].label} armed · embedded frame until deployed`);
          } else if (patch.engine) {
            showToast(`${ENGINES[patch.engine].label} engaged`);
          }
        }}
        onClose={() => setSettingsOpen(false)}
      />

      {browser && (
        <BrowserOverlay
          session={browser}
          engineLabel={ENGINES[settings.engine].label}
          deployed={isDeployed(settings.engine)}
          onDestroy={destroyBrowser}
        />
      )}

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
