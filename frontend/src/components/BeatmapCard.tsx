import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BeatmapRecord } from "../types";

function useIsMobile(breakpoint = 520) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);
  return isMobile;
}

const STATUS_COLOR: Record<string, string> = {
  ranked: "#b8e994", approved: "#b8e994", loved: "#ff6b9d",
  qualified: "#74b9ff", pending: "#fbbf24", wip: "#fbbf24", graveyard: "#636e72",
};

function fmt(n?: number | null, decimals = 1): string {
  if (n == null) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(decimals);
}

interface ContextMenuProps {
  x: number;
  y: number;
  onHideBeatmap?: () => void;
  onHideBeatmapset?: () => void;
  onReportWrongTags?: () => void;
  hasBeatmapset: boolean;
  onClose: () => void;
}

function ContextMenu({
  x,
  y,
  onHideBeatmap,
  onHideBeatmapset,
  onReportWrongTags,
  hasBeatmapset,
  onClose,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  let itemCount = 0;
  if (onReportWrongTags) itemCount++;
  if (onHideBeatmap) itemCount++;
  if (hasBeatmapset && onHideBeatmapset) itemCount++;

  // Clamp to viewport
  const menuW = 210;
  const menuH = Math.max(44, itemCount * 38);
  const clampedX = Math.min(x, window.innerWidth - menuW - 8);
  const clampedY = Math.min(y, window.innerHeight - menuH - 8);

  return createPortal(
    <div
      ref={ref}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      style={{
        position: "fixed", left: clampedX, top: clampedY, zIndex: 99999,
        background: "#1a1929", border: "1px solid #2e2d3d", borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.6)", minWidth: menuW, overflow: "hidden",
      }}
    >
      {onReportWrongTags && (
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); onReportWrongTags(); onClose(); }}
          style={menuItemStyle}
          onMouseEnter={e => (e.currentTarget.style.background = "#2e2d3d")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          ⚠️ This tags isn't right
        </button>
      )}
      {onHideBeatmap && (
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); onHideBeatmap(); onClose(); }}
          style={menuItemStyle}
          onMouseEnter={e => (e.currentTarget.style.background = "#2e2d3d")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          🚫 Hide this beatmap
        </button>
      )}
      {hasBeatmapset && onHideBeatmapset && (
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); onHideBeatmapset(); onClose(); }}
          style={menuItemStyle}
          onMouseEnter={e => (e.currentTarget.style.background = "#2e2d3d")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          🗂 Hide this beatmapset
        </button>
      )}
    </div>,
    document.body,
  );
}

const menuItemStyle: React.CSSProperties = {
  display: "block", width: "100%", padding: "10px 14px",
  background: "transparent", border: "none", color: "#c8cad8",
  fontSize: 12, textAlign: "left", cursor: "pointer",
};

interface BeatmapCardProps {
  record: BeatmapRecord;
  highlightTags?: string[];
  onHide?: (beatmapId: string) => void;
  onHideSet?: (beatmapsetId: string) => void;
  onReportWrongTags?: (record: BeatmapRecord) => void;
}

export function BeatmapCard({ record, highlightTags, onHide, onHideSet, onReportWrongTags }: BeatmapCardProps) {

  const href = `https://osu.ppy.sh/beatmaps/${record.beatmap_id}`;
  const title = record.title ?? `Beatmap #${record.beatmap_id}`;
  const stars = record.difficulty_rating != null ? record.difficulty_rating.toFixed(2) : null;
  const statusColor = STATUS_COLOR[record.status ?? ""] ?? "#a7a9be";
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const isMobile = useIsMobile();

  const squareImgUrl =
    record.list_url ||
    record.card_url ||
    record.cover_url ||
    (record.beatmapset_id
      ? `https://assets.ppy.sh/beatmaps/${record.beatmapset_id}/covers/list.jpg`
      : null);

  const bgImgUrl =
    record.card_url ||
    record.cover_url ||
    record.list_url ||
    (record.beatmapset_id
      ? `https://assets.ppy.sh/beatmaps/${record.beatmapset_id}/covers/card.jpg`
      : null);

  const stats: [string, string][] = [
    ["BPM", fmt(record.bpm, 0)],
    ["AR", fmt(record.ar)],
    ["CS", fmt(record.cs)],
    ["OD", fmt(record.od)],
    ["Objects", fmt(record.object_count, 0)],
  ];

  // Core gameplay = Top 4 tags by probability
  // Non-core gameplay (rank 5+) = Only displayed at the bottom if matched in highlightTags
  const sortedLabels = [...record.labels].sort((a, b) => b.probability - a.probability);
  const coreLabels = sortedLabels.slice(0, 4);
  const matchedNonCoreLabels = sortedLabels.slice(4).filter(l => highlightTags?.includes(l.label));
  const displayedLabels = [...coreLabels, ...matchedNonCoreLabels];

  function handleContextMenu(e: React.MouseEvent) {
    if (!onHide && !onHideSet && !onReportWrongTags) return;
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY });
  }

  const hoverEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderColor = "rgba(255,107,157,0.45)";
    e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.4)";
    e.currentTarget.style.transform = "translateY(-1px)";
  };
  const hoverLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderColor = "#2e2d3d";
    e.currentTarget.style.boxShadow = "none";
    e.currentTarget.style.transform = "none";
  };

  const contextMenuNode = menu && (
    <ContextMenu
      x={menu.x}
      y={menu.y}
      hasBeatmapset={!!record.beatmapset_id}
      onHideBeatmap={onHide ? () => onHide(record.beatmap_id) : undefined}
      onHideBeatmapset={onHideSet && record.beatmapset_id ? () => onHideSet(record.beatmapset_id!) : undefined}
      onReportWrongTags={onReportWrongTags ? () => onReportWrongTags(record) : undefined}
      onClose={() => setMenu(null)}
    />
  );

  // ── MOBILE LAYOUT ──────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block" }} onContextMenu={handleContextMenu}>
          <div style={mobileCardStyle} onMouseEnter={hoverEnter} onMouseLeave={hoverLeave}>

            {/* Top section: blurred bg + centered cover image */}
            <div style={mobileTopSectionStyle}>
              {/* Background (blurred, low opacity) */}
              {bgImgUrl && (
                <img src={bgImgUrl} alt="" style={mobileBgImgStyle} loading="lazy" />
              )}
              {/* Black gradient from left/right edges toward center */}
              <div style={mobileSideGradientStyle} />

              {/* Centered square cover */}
              <div style={mobileCoverWrapperStyle}>
                {squareImgUrl ? (
                  <img
                    src={squareImgUrl}
                    alt=""
                    style={mobileCoverImgStyle}
                    loading="lazy"
                    onError={e => { (e.currentTarget as HTMLElement).style.display = "none"; }}
                  />
                ) : (
                  <div style={fallbackIconStyle}>🎵</div>
                )}
              </div>
            </div>

            {/* Middle section: beatmap info */}
            <div style={mobileInfoSectionStyle}>
              <div style={titleStyle}>{title}</div>
              {record.artist && (
                <div style={{ ...artistStyle, marginTop: 2 }}>
                  by {record.artist}
                  {record.version && (
                    <span style={{ color: "#ff6b9d", marginLeft: 6 }}>[{record.version}]</span>
                  )}
                </div>
              )}
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
                {stars && (
                  <span style={{ ...badgeStyle, color: "#ffd700", borderColor: "rgba(255,215,0,0.5)", background: "rgba(0,0,0,0.4)" }}>
                    ★ {stars}
                  </span>
                )}
                {record.status && (
                  <span style={{ ...badgeStyle, color: statusColor, borderColor: `${statusColor}88`, background: "rgba(0,0,0,0.4)" }}>
                    {record.status}
                  </span>
                )}
              </div>
            </div>

            {/* Bottom section: stats + tags */}
            <div style={mobileMetaSectionStyle}>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                {stats.map(([k, v]) => (
                  <span key={k} style={statBadgeStyle}>{k} {v}</span>
                ))}
              </div>
              {displayedLabels.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                  {displayedLabels.map(({ label, probability }) => (
                    <span key={label} style={tagStyle(probability, highlightTags?.includes(label))}>
                      {label} {(probability * 100).toFixed(0)}%
                    </span>
                  ))}
                </div>
              )}
            </div>

          </div>
        </a>
        {contextMenuNode}
      </>
    );
  }

  // ── DESKTOP LAYOUT (unchanged) ─────────────────────────────────
  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: "none", display: "block" }}
        onContextMenu={handleContextMenu}
      >
        <div style={cardStyle} onMouseEnter={hoverEnter} onMouseLeave={hoverLeave}>
          {/* Left: Square Cover Thumbnail */}
          <div style={squareCoverWrapperStyle}>
            {squareImgUrl ? (
              <img
                src={squareImgUrl}
                alt=""
                style={squareCoverImgStyle}
                loading="lazy"
                onError={e => { (e.currentTarget as HTMLElement).style.display = "none"; }}
              />
            ) : (
              <div style={fallbackIconStyle}>🎵</div>
            )}
          </div>

          {/* Right: Background banner with gradient opacity overlay and info */}
          <div style={rightContainerStyle}>
            {bgImgUrl && (
              <img src={bgImgUrl} alt="" style={coverImgStyle} loading="lazy" />
            )}
            <div style={overlayStyle} />

            <div style={contentStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={titleStyle}>{title}</div>
                {record.artist && (
                  <div style={artistStyle}>
                    by {record.artist}
                    {record.version && (
                      <span style={{ color: "#ff6b9d", marginLeft: 6 }}>[{record.version}]</span>
                    )}
                  </div>
                )}
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 7, alignItems: "center" }}>
                  {stars && (
                    <span style={{ ...badgeStyle, color: "#ffd700", borderColor: "rgba(255,215,0,0.5)", background: "rgba(0,0,0,0.6)" }}>
                      ★ {stars}
                    </span>
                  )}
                  {record.status && (
                    <span style={{ ...badgeStyle, color: statusColor, borderColor: `${statusColor}88`, background: "rgba(0,0,0,0.6)" }}>
                      {record.status}
                    </span>
                  )}
                  {stats.map(([k, v]) => (
                    <span key={k} style={statBadgeStyle}>{k} {v}</span>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
                {displayedLabels.map(({ label, probability }) => (
                  <span key={label} style={tagStyle(probability, highlightTags?.includes(label))}>
                    {label} {(probability * 100).toFixed(0)}%
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </a>
      {contextMenuNode}
    </>
  );
}


const cardStyle: React.CSSProperties = {
  position: "relative",
  borderRadius: 10,
  overflow: "hidden",
  background: "#1a1929",
  border: "1px solid #2e2d3d",
  minHeight: 85,
  display: "flex",
  alignItems: "stretch",
  transition: "border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease",
};

const squareCoverWrapperStyle: React.CSSProperties = {
  width: 85,
  minWidth: 85,
  maxWidth: 85,
  background: "#100f1c",
  position: "relative",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  borderRight: "1px solid rgba(46,45,61,0.85)",
};

const squareCoverImgStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  objectPosition: "center",
  display: "block",
};

const fallbackIconStyle: React.CSSProperties = {
  fontSize: 24,
  opacity: 0.35,
  userSelect: "none",
};

const rightContainerStyle: React.CSSProperties = {
  position: "relative",
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  overflow: "hidden",
};

const coverImgStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
  objectPosition: "center",
};

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "linear-gradient(90deg, rgba(10,9,18,0.94) 20%, rgba(10,9,18,0.76) 70%, rgba(10,9,18,0.55) 100%)",
};

const contentStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "11px 16px",
  zIndex: 1,
};

const titleStyle: React.CSSProperties = {
  color: "#fffffe",
  fontWeight: 700,
  fontSize: 14,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const artistStyle: React.CSSProperties = {
  color: "#c8cad8",
  fontSize: 12,
  marginTop: 2,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const badgeStyle: React.CSSProperties = {
  fontSize: 10,
  padding: "2px 6px",
  borderRadius: 4,
  border: "1px solid",
  textTransform: "capitalize",
  whiteSpace: "nowrap",
};

const statBadgeStyle: React.CSSProperties = {
  ...badgeStyle,
  color: "#c8cad8",
  borderColor: "rgba(46,45,61,0.8)",
  background: "rgba(0,0,0,0.55)",
};

function tagStyle(probability: number, highlighted = false): React.CSSProperties {
  void probability;
  return {
    fontSize: 10,
    padding: "2px 7px",
    borderRadius: 4,
    background: highlighted ? "rgba(255,107,157,0.25)" : "rgba(0,0,0,0.65)",
    border: highlighted ? "1px solid rgba(255,107,157,0.8)" : "1px solid rgba(255,107,157,0.5)",
    color: "#ff6b9d",
    whiteSpace: "nowrap",
    fontWeight: highlighted ? 700 : 400,
  };
}

// ── Mobile styles ──────────────────────────────────────────────

const mobileCardStyle: React.CSSProperties = {
  position: "relative",
  borderRadius: 10,
  overflow: "hidden",
  background: "#1a1929",
  border: "1px solid #2e2d3d",
  display: "flex",
  flexDirection: "column",
  transition: "border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease",
};

const mobileTopSectionStyle: React.CSSProperties = {
  position: "relative",
  height: 130,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};

const mobileBgImgStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
  objectPosition: "center",
  filter: "blur(6px) brightness(0.55)",
  transform: "scale(1.08)", // avoid blur edges
  opacity: 0.6,
};

const mobileSideGradientStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  // Black from left edge → transparent → black from right edge
  background: "linear-gradient(90deg, rgba(10,9,18,0.92) 0%, transparent 30%, transparent 70%, rgba(10,9,18,0.92) 100%)",
  zIndex: 1,
};

const mobileCoverWrapperStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 2,
  width: 90,
  height: 90,
  borderRadius: 8,
  overflow: "hidden",
  boxShadow: "0 4px 16px rgba(0,0,0,0.7)",
  flexShrink: 0,
  background: "#100f1c",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const mobileCoverImgStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  objectPosition: "center",
  display: "block",
};

const mobileInfoSectionStyle: React.CSSProperties = {
  padding: "10px 14px 8px",
  borderTop: "1px solid rgba(46,45,61,0.6)",
  background: "rgba(16,15,28,0.85)",
};

const mobileMetaSectionStyle: React.CSSProperties = {
  padding: "8px 14px 10px",
  borderTop: "1px solid rgba(46,45,61,0.5)",
  background: "rgba(12,11,22,0.9)",
};
