import { ENGINES, type EngineId } from "./proxy";

export type CloakId = "none" | "classroom" | "canvas" | "clever" | "khan";

export interface SettingsState {
  engine: EngineId;
  cloak: CloakId;
  panicEnabled: boolean;
  panicTarget: "classroom" | "drive" | "gmail";
}

export const DEFAULT_SETTINGS: SettingsState = {
  engine: "embedded",
  cloak: "none",
  panicEnabled: true,
  panicTarget: "classroom",
};

export const CLOAKS: Record<CloakId, { label: string; title: string; domain: string }> = {
  none: { label: "No cloak", title: "ScribeDesk — Web Proxy Console", domain: "" },
  classroom: { label: "Google Classroom", title: "Classes", domain: "classroom.google.com" },
  canvas: { label: "Canvas LMS", title: "Dashboard", domain: "canvas.instructure.com" },
  clever: { label: "Clever", title: "Clever | Portal", domain: "clever.com" },
  khan: { label: "Khan Academy", title: "Khan Academy | Lessons", domain: "khanacademy.org" },
};

export const PANIC_TARGETS: Record<SettingsState["panicTarget"], { label: string; url: string }> = {
  classroom: { label: "Google Classroom", url: "https://classroom.google.com/" },
  drive: { label: "Google Drive", url: "https://drive.google.com/" },
  gmail: { label: "Gmail", url: "https://mail.google.com/" },
};

const KEY = "scribedesk:settings:v3";

export function loadSettings(): SettingsState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const merged = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<SettingsState>) };
    if (!(merged.engine in ENGINES)) merged.engine = DEFAULT_SETTINGS.engine;
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: SettingsState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — settings stay in-memory */
  }
}

/** Apply the tab cloak: rewrite document title + favicon. */
export function applyCloak(cloak: CloakId): void {
  const c = CLOAKS[cloak];
  document.title = c.title;

  let link = document.querySelector<HTMLLinkElement>("link[data-cloak-icon]");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.setAttribute("data-cloak-icon", "1");
    document.head.appendChild(link);
  }
  link.href = c.domain
    ? `https://www.google.com/s2/favicons?domain=${c.domain}&sz=64`
    : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='15' fill='%23ff6a3d'/%3E%3Cpath d='M32 11 L45 33 32 53 19 33 Z' fill='%230a0a0a'/%3E%3C/svg%3E";
}
