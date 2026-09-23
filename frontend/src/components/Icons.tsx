// Minimalist inline SVG icons — Lucide style, stroke-based, no fill, white/currentColor

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

const base = (size: number, sw: number, children: React.ReactNode, style?: React.CSSProperties) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round"
    style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}
  >
    {children}
  </svg>
);

/** External link / osu! web */
export function IconExternalLink({ size = 14, strokeWidth = 2.5, style }: IconProps) {
  return base(size, strokeWidth, <>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </>, style);
}

/** Download arrow */
export function IconDownload({ size = 14, strokeWidth = 2.5, style }: IconProps) {
  return base(size, strokeWidth, <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </>, style);
}

/** Bookmark / save */
export function IconBookmark({ size = 14, strokeWidth = 2.5, style }: IconProps) {
  return base(size, strokeWidth, <>
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </>, style);
}

/** Target / find similar */
export function IconTarget({ size = 14, strokeWidth = 2.5, style }: IconProps) {
  return base(size, strokeWidth, <>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </>, style);
}

/** X / hide */
export function IconBan({ size = 14, strokeWidth = 2.5, style }: IconProps) {
  return base(size, strokeWidth, <>
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </>, style);
}

/** Folder / hide set */
export function IconFolderMinus({ size = 14, strokeWidth = 2.5, style }: IconProps) {
  return base(size, strokeWidth, <>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    <line x1="9" y1="14" x2="15" y2="14" />
  </>, style);
}

/** Play triangle */
export function IconPlay({ size = 18, strokeWidth = 2.5, style }: IconProps) {
  return base(size, strokeWidth, <>
    <polygon points="5 3 19 12 5 21 5 3" />
  </>, style);
}

/** Pause */
export function IconPause({ size = 18, strokeWidth = 2.5, style }: IconProps) {
  return base(size, strokeWidth, <>
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </>, style);
}

/** Globe (public) */
export function IconGlobe({ size = 12, strokeWidth = 2, style }: IconProps) {
  return base(size, strokeWidth, <>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </>, style);
}

/** Lock (private) */
export function IconLock({ size = 12, strokeWidth = 2, style }: IconProps) {
  return base(size, strokeWidth, <>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </>, style);
}

/** Check */
export function IconCheck({ size = 14, strokeWidth = 2.5, style }: IconProps) {
  return base(size, strokeWidth, <>
    <polyline points="20 6 9 17 4 12" />
  </>, style);
}

/** Music note */
export function IconMusic({ size = 14, strokeWidth = 2, style }: IconProps) {
  return base(size, strokeWidth, <>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </>, style);
}
