import type { CSSProperties } from "react";
import { CATEGORY_LABEL, SHORTCUTS, type Category, type Shortcut } from "../data/shortcuts";
import { CornerArrowIcon, ShieldIcon } from "./icons";

interface Props {
  category: Category | "all";
  routingId: string | null;
  onOpen: (s: Shortcut) => void;
  onStealth: (s: Shortcut) => void;
}

const TAG: Record<Category, string> = { apps: "APP", ai: "AI", games: "GAME" };

export default function ShortcutGrid({ category, routingId, onOpen, onStealth }: Props) {
  const items = category === "all" ? SHORTCUTS : SHORTCUTS.filter((s) => s.category === category);

  return (
    <section className="sd-grid-wrap" aria-label="Shortcuts">
      <div className="sd-grid-head">
        <h2 className="sd-grid-title">{CATEGORY_LABEL[category]}</h2>
        <span className="sd-grid-count">{items.length} pinned · all proxied</span>
      </div>

      <div className="sd-grid" key={category}>
        {items.map((s, i) => (
          <button
            key={s.id}
            className={`sd-card${routingId === s.id ? " is-routing" : ""}`}
            style={
              {
                background: `linear-gradient(135deg, ${s.from}, ${s.to})`,
                "--glow": s.glow,
                animationDelay: `${i * 55}ms`,
              } as CSSProperties
            }
            onClick={() => onOpen(s)}
            aria-label={`Route to ${s.name} through the proxy`}
          >
            <span className="sd-card-top">
              <span className="sd-card-icon">
                <s.Icon size={21} />
              </span>
              <span className="sd-card-tag">{TAG[s.category]}</span>
            </span>

            <span className="sd-card-bottom">
              <span>
                <span className="sd-card-name">{s.name}</span>
                <span className="sd-card-host">{s.host}</span>
              </span>
              <span className="sd-card-go" aria-hidden>
                <CornerArrowIcon size={14} />
              </span>
            </span>

            <span
              className="sd-card-cloak"
              role="button"
              tabIndex={0}
              title={`Stealth open ${s.name} — in-page with tab identity cloaked`}
              aria-label={`Stealth open ${s.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onStealth(s);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onStealth(s);
                }
              }}
            >
              <ShieldIcon size={13} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
