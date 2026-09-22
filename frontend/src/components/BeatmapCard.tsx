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
  ranked: "#b8e994", approved: "#b8e994", loved: "#ff66aa",
  qualified: "#74b9ff", pending: "#fbbf24", wip: "#fbbf24", graveyard: "#636e72",
};

function fmt(n?: number | null, decimals = 1): string {
  if (n == null) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(decimals);
}

function starColor(stars?: number | null): string {
  if (!stars) return "var(--muted)";
  if (stars < 2)   return "#88d8b0";
  if (stars < 3)   return "#6bcfff";
  if (stars < 4.5) return "#ffd700";
  if (stars < 6)   return "#ff9a56";
  if (stars < 7.5) return "#ff66aa";
  return "#c084fc";
}

// ── Context menu ─────────────────────────────────────────────

interface ContextMenuProps {
  x: number; y: number;
  onHideBeatmap?: () => void;
  onHideBeatmapset?: () => void;
  onReportWrongTags?: () => void;
  onFindSimilar?: () => void;
  hasBeatmapset: boolean;
  onClose: () => void;
}

function ContextMenu({ x, y, onHideBeatmap, onHideBeatmapset, onReportWrongTags, onFindSimilar, hasBeatmapset, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleKey); };
  }, [onClose]);

  let itemCount = [onFindSimilar, onReportWrongTags, onHideBeatmap, hasBeatmapset && onHideBeatmapset].filter(Boolean).length;
  const menuW = 210, menuH = Math.max(44, itemCount * 38);
  const clampedX = Math.min(x, window.innerWidth - menuW - 8);
  const clampedY = Math.min(y, window.innerHeight - menuH - 8);

  return createPortal(
    <div ref={ref} onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}
      style={{ position: "fixed", left: clampedX, top: clampedY, zIndex: 99999,
        background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.6)", minWidth: menuW, overflow: "hidden" }}>
      {onFindSimilar && <CtxBtn icon="🎯" label="Find Similar Beatmap" onClick={() => { onFindSimilar(); onClose(); }} />}
      {onReportWrongTags && <CtxBtn icon="⚠️" label="This tags isn't right" onClick={() => { onReportWrongTags(); onClose(); }} />}
      {onHideBeatmap && <CtxBtn icon="🚫" label="Hide this beatmap" onClick={() => { onHideBeatmap(); onClose(); }} />}
      {hasBeatmapset && onHideBeatmapset && <CtxBtn icon="🗂" label="Hide this beatmapset" onClick={() => { onHideBeatmapset!(); onClose(); }} />}
    </div>,
    document.body,
  );
}

function CtxBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={e => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      style={{ display: "block", width: "100%", padding: "10px 14px", background: "transparent",
        border: "none", color: "var(--muted)", fontSize: 12, textAlign: "left", cursor: "pointer" }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(180,130,220,0.1)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
      {icon} {label}
    </button>
  );
}

// ── Main card ─────────────────────────────────────────────────

interface BeatmapCardProps {
  record: BeatmapRecord;
  highlightTags?: string[];
  onHide?: (beatmapId: string) => void;
  onHideSet?: (beatmapsetId: string) => void;
  onReportWrongTags?: (record: BeatmapRecord) => void;
  onFindSimilar?: (record: BeatmapRecord) => void;
}

export function BeatmapCard({ record, highlightTags, onHide, onHideSet, onReportWrongTags, onFindSimilar }: BeatmapCardProps) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const isMobile = useIsMobile();

  const href = `https://osu.ppy.sh/beatmaps/${record.beatmap_id}`;
  const title = record.title ?? `Beatmap #${record.beatmap_id}`;
  const stars = record.difficulty_rating;
  const starCol = starColor(stars);
  const statusCol = STATUS_COLOR[record.status ?? ""] ?? "var(--muted)";

  const bgImg = record.card_url || record.cover_url ||
    (record.beatmapset_id ? `https://assets.ppy.sh/beatmaps/${record.beatmapset_id}/covers/card.jpg` : null);

  const sortedLabels = [...record.labels].sort((a, b) => b.probability - a.probability);
  const coreLabels = sortedLabels.slice(0, 3);
  const maxProb = coreLabels[0]?.probability ?? 1;

  function handleContextMenu(e: React.MouseEvent) {
    if (!onHide && !onHideSet && !onReportWrongTags && !onFindSimilar) return;
    e.preventDefault(); e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY });
  }

  const cardHoverEnter = (el: HTMLDivElement) => {
    el.style.borderColor = "rgba(255,102,170,0.45)";
    el.style.transform = "translateY(-2px)";
    el.style.boxShadow = "0 8px 24px rgba(0,0,0,0.45)";
  };
  const cardHoverLeave = (el: HTMLDivElement) => {
    el.style.borderColor = "rgba(180,130,220,0.18)";
    el.style.transform = "none";
    el.style.boxShadow = "none";
  };

  const contextNode = menu && (
    <ContextMenu x={menu.x} y={menu.y} hasBeatmapset={!!record.beatmapset_id}
      onFindSimilar={onFindSimilar ? () => onFindSimilar(record) : undefined}
      onHideBeatmap={onHide ? () => onHide(record.beatmap_id) : undefined}
      onHideBeatmapset={onHideSet && record.beatmapset_id ? () => onHideSet(record.beatmapset_id!) : undefined}
      onReportWrongTags={onReportWrongTags ? () => onReportWrongTags(record) : undefined}
      onClose={() => setMenu(null)} />
  );

  // ── Vertical card (Figma-style) — default for grid layouts ───
  return (
    <>
      <a href={href} target="_blank" rel="noopener noreferrer"
        style={{ textDecoration: "none", display: "block" }}
        onContextMenu={handleContextMenu}>
        <div
          onMouseEnter={e => cardHoverEnter(e.currentTarget)}
          onMouseLeave={e => cardHoverLeave(e.currentTarget)}
          style={cardStyle}>
          {/* Cover image */}
          <div style={coverWrapStyle}>
            {bgImg && <img src={bgImg} alt="" style={coverImgStyle} loading="lazy"
              onError={e => { (e.currentTarget.parentElement!.style.background = "var(--bg)"); e.currentTarget.style.display = "none"; }} />}
            <div style={coverOverlayStyle} />
            {/* Status badge */}
            {record.status && (
              <span style={{ ...statusBadgeStyle, color: statusCol, borderColor: `${statusCol}88` }}>
                {record.status.toUpperCase()}
              </span>
            )}
          </div>

          {/* Body */}
          <div style={bodyStyle}>
            {/* Title */}
            <div style={titleStyle}>{title}</div>
            {/* Artist */}
            {record.artist && <div style={artistStyle}>{record.artist}</div>}
            {/* Diff + mapper */}
            <div style={mapperStyle}>
              {record.version && <span style={{ color: "var(--muted)" }}>[{record.version}]</span>}
              {record.bpm != null && <span style={{ color: "var(--muted2)" }}> · {fmt(record.bpm, 0)} BPM</span>}
            </div>

            {/* Diff header: star + diff name */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              {stars != null && (
                <span style={{ ...starBadgeStyle, color: starCol, borderColor: `${starCol}44`, background: `${starCol}14` }}>
                  ★ {stars.toFixed(2)}
                </span>
              )}
              {record.ar != null && <span style={statBadge}>AR{fmt(record.ar)}</span>}
              {record.cs != null && <span style={statBadge}>CS{fmt(record.cs)}</span>}
              {record.od != null && <span style={statBadge}>OD{fmt(record.od)}</span>}
              {record.object_count != null && <span style={statBadge}>{fmt(record.object_count, 0)} obj</span>}
            </div>

            {/* Tag progress bars */}
            {coreLabels.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {coreLabels.map(l => {
                  const highlighted = highlightTags?.includes(l.label);
                  const barColor = highlighted ? "#ff66aa" : starCol;
                  return (
                    <div key={l.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <span style={{ fontFamily: "var(--font-m)", fontSize: 10,
                          color: highlighted ? "#ff66aa" : "var(--muted)" }}>{l.label}</span>
                        <span style={{ fontFamily: "var(--font-m)", fontSize: 10,
                          color: barColor, fontWeight: 600 }}>{(l.probability * 100).toFixed(0)}%</span>
                      </div>
                      <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${(l.probability / maxProb) * 100}%`, height: "100%", borderRadius: 2,
                          background: `linear-gradient(90deg, ${barColor}cc, ${barColor}55)`,
                          transition: "width 0.3s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </a>
      {contextNode}
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid rgba(180,130,220,0.18)",
  borderRadius: 12,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  transition: "border-color 0.2s, transform 0.15s, box-shadow 0.2s",
  minWidth: 0,
};

const coverWrapStyle: React.CSSProperties = {
  position: "relative", height: 100, overflow: "hidden",
  background: "var(--bg)", flexShrink: 0,
};

const coverImgStyle: React.CSSProperties = {
  width: "100%", height: "100%", objectFit: "cover",
  objectPosition: "center", opacity: 0.65, display: "block",
};

const coverOverlayStyle: React.CSSProperties = {
  position: "absolute", inset: 0,
  background: "linear-gradient(to bottom, transparent 25%, var(--card) 100%)",
};

const statusBadgeStyle: React.CSSProperties = {
  position: "absolute", top: 8, right: 8,
  fontSize: 9, fontWeight: 700, padding: "2px 7px",
  borderRadius: 4, border: "1px solid", letterSpacing: "0.06em",
  background: "rgba(0,0,0,0.55)", fontFamily: "var(--font-m)",
};

const bodyStyle: React.CSSProperties = {
  padding: "12px 14px 14px", flex: 1, display: "flex", flexDirection: "column",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-d)", fontWeight: 800, fontSize: 14, color: "#fff",
  lineHeight: 1.25, marginBottom: 2,
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};

const artistStyle: React.CSSProperties = {
  fontSize: 12, color: "var(--muted)", marginBottom: 2,
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};

const mapperStyle: React.CSSProperties = {
  fontFamily: "var(--font-m)", fontSize: 10, marginBottom: 8,
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};

const starBadgeStyle: React.CSSProperties = {
  fontFamily: "var(--font-m)", fontSize: 11, fontWeight: 700,
  padding: "2px 7px", borderRadius: 4, border: "1px solid",
};

const statBadge: React.CSSProperties = {
  fontFamily: "var(--font-m)", fontSize: 10,
  padding: "2px 6px", borderRadius: 4,
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
  color: "#c0c0d0",
};
