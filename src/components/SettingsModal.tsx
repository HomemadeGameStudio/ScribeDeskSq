import { useEffect } from "react";
import { ENGINES, type EngineId } from "../lib/proxy";
import { CLOAKS, PANIC_TARGETS, type CloakId, type SettingsState } from "../lib/settings";
import { BoltIcon, CloseIcon, GlobeIcon, ShieldIcon } from "./icons";

interface Props {
  open: boolean;
  settings: SettingsState;
  onPatch: (patch: Partial<SettingsState>) => void;
  onClose: () => void;
}

const ENGINE_ORDER: EngineId[] = ["ultraviolet", "baremux", "rammerhead"];

export default function SettingsModal({ open, settings, onPatch, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="sd-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="ScribeDesk settings"
    >
      <div className="sd-modal">
        <div className="sd-modal-head">
          <h2 className="sd-modal-title">
            <span className="tick" aria-hidden />
            Console settings
          </h2>
          <button className="sd-icon-btn" onClick={onClose} aria-label="Close settings">
            <CloseIcon size={17} />
          </button>
        </div>

        {/* Engine */}
        <section className="sd-section" style={{ borderTop: "none", paddingTop: 0 }}>
          <div className="sd-section-label">Proxy engine</div>
          <p className="sd-section-desc">
            Transport used by the route bar, shortcut cards and the game player. Swap engines live — no reload needed.
          </p>
          <div className="sd-engine-grid">
            {ENGINE_ORDER.map((id) => {
              const e = ENGINES[id];
              const on = settings.engine === id;
              return (
                <button
                  key={id}
                  className={`sd-engine-opt${on ? " is-on" : ""}`}
                  onClick={() => onPatch({ engine: id })}
                  aria-pressed={on}
                >
                  <b>
                    {on && <span className="on-dot" aria-hidden />}
                    {e.label}
                  </b>
                  <span>{e.detail}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Cloak */}
        <section className="sd-section">
          <div className="sd-section-label">Tab cloak</div>
          <p className="sd-section-desc">Rewrites this tab's title and favicon so it blends into a crowded taskbar.</p>
          <div className="sd-chip-row">
            {(Object.keys(CLOAKS) as CloakId[]).map((id) => (
              <button
                key={id}
                className={`sd-chip${settings.cloak === id ? " is-on" : ""}`}
                onClick={() => onPatch({ cloak: id })}
                aria-pressed={settings.cloak === id}
              >
                {CLOAKS[id].label}
              </button>
            ))}
          </div>
        </section>

        {/* Evasion */}
        <section className="sd-section">
          <div className="sd-section-label">Evasion</div>

          <div className="sd-toggle-row">
            <div className="sd-toggle-meta">
              <b>
                <BoltIcon size={14} color="#ffb648" /> Panic key
              </b>
              <span>
                Tap <kbd>~</kbd> anywhere to bail to {PANIC_TARGETS[settings.panicTarget].label}.
              </span>
            </div>
            <button
              className={`sd-switch${settings.panicEnabled ? " is-on" : ""}`}
              onClick={() => onPatch({ panicEnabled: !settings.panicEnabled })}
              role="switch"
              aria-checked={settings.panicEnabled}
              aria-label="Toggle panic key"
            >
              <span className="knob" />
            </button>
          </div>

          <div className="sd-toggle-row">
            <div className="sd-toggle-meta">
              <b>
                <GlobeIcon size={14} color="#35d48a" /> In-page everything
              </b>
              <span>
                The desk never spawns tabs. Sites, searches, games — even these doc links — all open
                inside the on-page proxy viewport. Closing a session kills its payload instantly.
              </span>
            </div>
          </div>

          <div className="sd-toggle-row">
            <div className="sd-toggle-meta">
              <b>
                <ShieldIcon size={14} color="#ff6a3d" /> Stealth shields
              </b>
              <span>
                Hover any card for the shield — it opens the session in-page with the tab identity
                cloaked (your preset above, or Classroom) until you close it.
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
