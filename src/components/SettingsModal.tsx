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

const ENGINE_ORDER: EngineId[] = ["ultraviolet", "baremux", "rammerhead", "direct"];

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
        <section className="sd-section">
          <div className="sd-section-label">Proxy engine</div>
          <p className="sd-section-desc">
            Transport used by the route bar and every shortcut card. Swap engines live — no reload needed.
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
          <p className="sd-section-desc">
            Rewrites this tab's title and favicon so it blends into a crowded taskbar.
          </p>
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

        {/* Toggles */}
        <section className="sd-section">
          <div className="sd-section-label">Evasion</div>
          <div className="sd-toggle-row">
            <div className="sd-toggle-meta">
              <b>
                <BoltIcon size={14} color="#ffb648" /> Panic key
              </b>
              <span>
                Tap <kbd style={{ fontFamily: "var(--font-mono)", fontSize: 10, background: "rgba(255,255,255,0.06)", border: "1px solid var(--line)", borderRadius: 5, padding: "1px 5px" }}>~</kbd>{" "}
                anywhere to bail to {PANIC_TARGETS[settings.panicTarget].label}.
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
                <GlobeIcon size={14} color="#4fd8e8" /> about:blank launch
              </b>
              <span>Every route opens inside an unmarked blank tab instead of a normal window.</span>
            </div>
            <button
              className={`sd-switch${settings.blankCloak ? " is-on" : ""}`}
              onClick={() => onPatch({ blankCloak: !settings.blankCloak })}
              role="switch"
              aria-checked={settings.blankCloak}
              aria-label="Toggle about:blank launch"
            >
              <span className="knob" />
            </button>
          </div>

          <div className="sd-toggle-row" style={{ display: settings.panicEnabled ? "flex" : "none" }}>
            <div className="sd-toggle-meta">
              <b>
                <ShieldIcon size={14} color="#3ddc97" /> Decoy destination
              </b>
              <span>Where the panic key drops you.</span>
            </div>
            <div className="sd-chip-row" style={{ justifyContent: "flex-end" }}>
              {(Object.keys(PANIC_TARGETS) as SettingsState["panicTarget"][]).map((id) => (
                <button
                  key={id}
                  className={`sd-chip${settings.panicTarget === id ? " is-on" : ""}`}
                  onClick={() => onPatch({ panicTarget: id })}
                  aria-pressed={settings.panicTarget === id}
                >
                  {PANIC_TARGETS[id].label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="sd-modal-foot">
          <span className="sd-foot-note">changes autosave · stored on-device</span>
          <button className="sd-btn sd-btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
