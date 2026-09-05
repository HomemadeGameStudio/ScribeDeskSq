import { useLayoutEffect, useRef, useState } from "react";
import type { Category } from "../data/shortcuts";
import { GearIcon, NibIcon } from "./icons";

type NavKey = Category | "all";

const LINKS: { key: NavKey; label: string }[] = [
  { key: "all", label: "Home" },
  { key: "games", label: "Games" },
  { key: "apps", label: "Apps" },
  { key: "ai", label: "AI" },
];

interface Props {
  category: NavKey;
  onCategory: (c: NavKey) => void;
  onSettings: () => void;
}

export default function Nav({ category, onCategory, onSettings }: Props) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false });

  useLayoutEffect(() => {
    const measure = () => {
      const el = refs.current[category];
      if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth, ready: true });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [category]);

  return (
    <nav className="sd-nav" aria-label="Primary">
      <button className="sd-logo" onClick={() => onCategory("all")} aria-label="ScribeDesk home">
        <span className="sd-logo-mark">
          <NibIcon size={16} color="#140904" />
        </span>
        <span className="sd-logo-name">
          ScribeDesk<em>.</em>
        </span>
      </button>

      <div className="sd-nav-links">
        <span
          className="sd-nav-indicator"
          style={{ left: pill.left, width: pill.width, opacity: pill.ready ? 1 : 0 }}
          aria-hidden
        />
        {LINKS.map((l) => (
          <button
            key={l.key}
            ref={(el) => {
              refs.current[l.key] = el;
            }}
            className={`sd-nav-link${category === l.key ? " is-active" : ""}`}
            onClick={() => onCategory(l.key)}
            aria-pressed={category === l.key}
          >
            {l.label}
          </button>
        ))}
      </div>

      <button className="sd-icon-btn" onClick={onSettings} aria-label="Open settings" title="Settings">
        <GearIcon size={18} />
      </button>
    </nav>
  );
}
