import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 20) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

/* ---------- UI glyphs ---------- */

export const NibIcon = ({ size, ...p }: P) => (
  <svg {...base(size ?? 18)} {...p}>
    <path d="M12 2.6 18.6 11 12 21.4 5.4 11Z" fill="currentColor" stroke="none" opacity="0.92" />
    <circle cx="12" cy="12.4" r="1.9" fill="#0a0a0a" stroke="none" />
    <path d="M12 14.4v4.4" stroke="#0a0a0a" strokeWidth="1.6" />
  </svg>
);

export const SearchIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="10.8" cy="10.8" r="6.3" />
    <path d="m20 20-4.8-4.8" />
  </svg>
);

export const ArrowIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4.5 12h15" />
    <path d="m13 5.5 6.5 6.5-6.5 6.5" />
  </svg>
);

export const CornerArrowIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M7 17 17 7" />
    <path d="M9 7h8v8" />
  </svg>
);

export const GearIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M18.5 5.5l-1.9 1.9M7.4 16.6l-1.9 1.9" />
  </svg>
);

export const CloseIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} strokeWidth={2.4}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const ShieldIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 3 5 5.8v5.4c0 4.4 2.9 7.6 7 9 4.1-1.4 7-4.6 7-9V5.8Z" />
    <path d="m9.2 11.8 2 2 3.8-4" />
  </svg>
);

export const BoltIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M13 2.5 5 13.5h5.5L10 21.5l8-11h-5.5Z" />
  </svg>
);

export const GlobeIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.6 2.3 3.9 5.1 3.9 8.5s-1.3 6.2-3.9 8.5c-2.6-2.3-3.9-5.1-3.9-8.5s1.3-6.2 3.9-8.5Z" />
  </svg>
);

export const GamepadIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M6.8 7h10.4a4.4 4.4 0 0 1 4.3 5.3l-.9 4.2a2.6 2.6 0 0 1-4.5 1.2L14.6 16H9.4l-1.5 1.7a2.6 2.6 0 0 1-4.5-1.2l-.9-4.2A4.4 4.4 0 0 1 6.8 7Z" />
    <path d="M8 10.4v3M6.5 11.9h3" />
    <circle cx="15.6" cy="10.9" r="0.4" fill="currentColor" />
    <circle cx="17.8" cy="12.9" r="0.4" fill="currentColor" />
  </svg>
);

export const RefreshIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.7 3.6v3.6h-3.6" />
  </svg>
);

export const ExpandIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9" />
    <path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9" />
    <path d="M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15" />
    <path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
  </svg>
);

export const CompressIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M9 4v3.5A1.5 1.5 0 0 1 7.5 9H4" />
    <path d="M20 9h-3.5A1.5 1.5 0 0 1 15 7.5V4" />
    <path d="M15 20v-3.5a1.5 1.5 0 0 1 1.5-1.5H20" />
    <path d="M4 15h3.5A1.5 1.5 0 0 1 9 16.5V20" />
  </svg>
);

/* ---------- Brand marks (filled, simplified) ---------- */

export const DiscordMark = ({ size, ...p }: P) => (
  <svg width={size ?? 20} height={size ?? 20} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M19.3 5.3A16.9 16.9 0 0 0 15.1 4l-.5 1a15.6 15.6 0 0 0-5.2 0L8.9 4a16.9 16.9 0 0 0-4.2 1.3C2 9.4 1.3 13.4 1.6 17.3A17 17 0 0 0 6.8 20l1.1-1.8c-.6-.2-1.2-.5-1.7-.9l.4-.3a12 12 0 0 0 10.8 0l.4.3c-.5.4-1.1.7-1.7.9L17.2 20a17 17 0 0 0 5.2-2.7c.4-4.5-.7-8.4-3.1-12ZM8.7 14.9c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.9.9 1.8 2c0 1.1-.8 2-1.8 2Zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.9.9 1.8 2c0 1.1-.8 2-1.8 2Z" />
  </svg>
);

export const YouTubeMark = ({ size, ...p }: P) => (
  <svg width={size ?? 20} height={size ?? 20} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12c0 1.6.1 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.3-1.6.4-3.2.4-4.8s-.1-3.2-.4-4.8ZM10 15.2V8.8L15.5 12Z" />
  </svg>
);

export const GitHubMark = ({ size, ...p }: P) => (
  <svg width={size ?? 20} height={size ?? 20} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.2-.4-1.2.1-2.6 0 0 .9-.3 2.8 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.6.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2Z" />
  </svg>
);

export const GoogleMark = ({ size, ...p }: P) => (
  <svg width={size ?? 20} height={size ?? 20} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4Z" opacity="0.95" />
    <path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" opacity="0.7" />
    <path d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9Z" opacity="0.5" />
    <path d="M12 6c1.5 0 2.8.5 3.8 1.5L18.7 4.6A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6Z" opacity="0.85" />
  </svg>
);

export const ChatGPTMark = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} strokeWidth={1.6}>
    <path d="M12 3.5c2.6 0 4.8 1.6 5.7 3.9 2.3.5 4 2.5 4 5 0 1.4-.6 2.7-1.5 3.6.3 2.4-1 4.7-3.3 5.6-1 .4-2.1.4-3.1.1A5.9 5.9 0 0 1 6.3 19c-2.3-.5-4-2.5-4-5 0-1.4.6-2.7 1.5-3.6C3.5 8 4.8 5.7 7.1 4.8c1.5-.6 3.2-.4 4.9-1.3Z" opacity="0.4" />
    <path d="M12 7.2v4.8m0 0 4.1 2.4m-4.1-2.4-4.1 2.4" />
  </svg>
);

export const ClaudeMark = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="m10.8 5.6-3 12.8M16.2 5.6l-3 12.8" />
    <path d="M6.5 15h7.6" />
  </svg>
);
