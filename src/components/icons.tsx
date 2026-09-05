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
  <svg {...base(size)} {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const ShieldIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 3 5 5.8v5.4c0 4.5 3 7.6 7 9.2 4-1.6 7-4.7 7-9.2V5.8Z" />
    <path d="m9 11.6 2.1 2.2L15.4 9.4" />
  </svg>
);

export const BoltIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M13 2.5 5 13.5h5.4L10.6 21.5 19 10.2h-5.6Z" />
  </svg>
);

export const GlobeIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M3.4 12h17.2M12 3.4c2.6 2.3 3.9 5.2 3.9 8.6s-1.3 6.3-3.9 8.6c-2.6-2.3-3.9-5.2-3.9-8.6s1.3-6.3 3.9-8.6Z" />
  </svg>
);

/* ---------- Brand marks (geometric, self-drawn) ---------- */

export const DiscordMark = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} strokeWidth={1.7}>
    <path d="M8.4 5.2c2.3-.7 4.9-.7 7.2 0l1.2-1.6 1.7 3.1c.9 2.3 1.3 4.8 1.1 7.4l-2.9 1.9-1.2-2a9.6 9.6 0 0 1-7 0l-1.2 2-2.9-1.9a17.5 17.5 0 0 1 1.1-7.4l1.7-3.1Z" />
    <circle cx="9.4" cy="11.6" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="14.6" cy="11.6" r="1.15" fill="currentColor" stroke="none" />
    <path d="M8.6 18.2 7.4 20.4M15.4 18.2l1.2 2.2" />
  </svg>
);

export const YouTubeMark = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} strokeWidth={1.7}>
    <rect x="2.8" y="6" width="18.4" height="12.6" rx="4" />
    <path d="M10.2 9.4v5.8l5-2.9Z" fill="currentColor" stroke="none" />
  </svg>
);

export const GitHubMark = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} strokeWidth={1.7}>
    <circle cx="6.5" cy="5.5" r="2.3" />
    <circle cx="17.5" cy="5.5" r="2.3" />
    <circle cx="12" cy="18.5" r="2.3" />
    <path d="M6.5 7.8v2.4a3 3 0 0 0 3 3h5a3 3 0 0 0 3-3V7.8M12 13.2v3" />
  </svg>
);

export const GoogleMark = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} strokeWidth={2.1}>
    <path d="M19.3 12a7.3 7.3 0 1 1-2.1-5.1" />
    <path d="M19.3 12h-7" />
  </svg>
);

export const ChatGPTMark = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} strokeWidth={1.9}>
    <path d="M12 4.2v4.2M12 15.6v4.2M5.2 8.1l3.7 2.1M15.1 13.8l3.7 2.1M5.2 15.9l3.7-2.1M15.1 10.2l3.7-2.1" />
  </svg>
);

export const ClaudeMark = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} strokeWidth={1.9}>
    <path d="M12 3.4v4.2M12 16.4v4.2M3.4 12h4.2M16.4 12h4.2M6 6l2.9 2.9M15.1 15.1 18 18M18 6l-2.9 2.9M8.9 15.1 6 18" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const NowggMark = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} strokeWidth={1.7}>
    <path d="M7.3 7h9.4a4 4 0 0 1 3.9 3.2l.8 4.6a2.6 2.6 0 0 1-4.6 1.9L15.3 15H8.7l-1.5 1.7a2.6 2.6 0 0 1-4.6-1.9l.8-4.6A4 4 0 0 1 7.3 7Z" />
    <path d="M8 10.2v3M6.5 11.7h3" />
    <circle cx="16" cy="10.6" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="18" cy="12.6" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

export const DiceMark = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} strokeWidth={1.7}>
    <rect x="4" y="4" width="16" height="16" rx="4.4" />
    <circle cx="9" cy="9" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="15" cy="15" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="15" cy="9" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="9" cy="15" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
  </svg>
);
