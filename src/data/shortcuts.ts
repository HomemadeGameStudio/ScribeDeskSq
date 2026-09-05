import type { ComponentType, SVGProps } from "react";
import {
  DiscordMark,
  YouTubeMark,
  GitHubMark,
  GoogleMark,
  ChatGPTMark,
  ClaudeMark,
} from "../components/icons";

export type Category = "apps" | "ai" | "games";

export interface Shortcut {
  id: string;
  name: string;
  host: string;
  url: string;
  category: Category;
  /** Brand gradient stops + hover glow, tuned to sit on #0a0a0a */
  from: string;
  to: string;
  glow: string;
  Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
}

export const SHORTCUTS: Shortcut[] = [
  {
    id: "discord",
    name: "Discord",
    host: "discord.com",
    url: "https://discord.com/app",
    category: "apps",
    from: "#5865F2",
    to: "#3a43c0",
    glow: "rgba(88, 101, 242, 0.55)",
    Icon: DiscordMark,
  },
  {
    id: "youtube",
    name: "YouTube",
    host: "youtube.com",
    url: "https://www.youtube.com/",
    category: "apps",
    from: "#f4453b",
    to: "#b8121f",
    glow: "rgba(244, 69, 59, 0.5)",
    Icon: YouTubeMark,
  },
  {
    id: "github",
    name: "GitHub",
    host: "github.com",
    url: "https://github.com/",
    category: "apps",
    from: "#3d444d",
    to: "#171b21",
    glow: "rgba(140, 150, 165, 0.4)",
    Icon: GitHubMark,
  },
  {
    id: "google",
    name: "Google",
    host: "google.com",
    url: "https://www.google.com/webhp?igu=1",
    category: "apps",
    from: "#4d8ef7",
    to: "#2857c4",
    glow: "rgba(77, 142, 247, 0.5)",
    Icon: GoogleMark,
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    host: "chatgpt.com",
    url: "https://chatgpt.com/",
    category: "ai",
    from: "#12a37f",
    to: "#0a6e55",
    glow: "rgba(18, 163, 127, 0.5)",
    Icon: ChatGPTMark,
  },
  {
    id: "claude",
    name: "Claude",
    host: "claude.ai",
    url: "https://claude.ai/",
    category: "ai",
    from: "#d97757",
    to: "#a34e33",
    glow: "rgba(217, 119, 87, 0.5)",
    Icon: ClaudeMark,
  },
];

export const CATEGORY_LABEL: Record<Category | "all", string> = {
  all: "All channels",
  apps: "Apps",
  ai: "AI channels",
  games: "Game shelf",
};
