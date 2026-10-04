import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { BeatmapRecord, CurrentUser } from "../types";
import SaveToPlaylistModal from "./SaveToPlaylistModal";
import { starColor, starTextColor } from "../utils/starColor";
import { playPreview as _playPreview, pauseAudio, resumeAudio, subscribeAudio } from "../utils/audioStore";
import { BeatmapStats } from "./BeatmapStats";
import {
  IconExternalLink, IconDownload, IconBookmark, IconBookmarkX,
  IconTarget, IconBan, IconFolderMinus,
  IconPlay, IconPause,
} from "./Icons";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const STATUS_COLOR: Record<string, string> = {
  ranked: "#b8e994", approved: "#b8e994", loved: "#ff66aa",
  qualified: "#74b9ff", pending: "#fbbf24", wip: "#fbbf24", graveyard: "#636e72",
};

function fmt(n?: number | null, decimals = 1): string {
  if (n == null) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(decimals);
}

// ── Context menu ─────────────────────────────────────────────────────────────

interface ContextMenuProps {
  x: number; y: number;
  onHideBeatmap?: () => void;
  onHideBeatmapset?: () => void;
  onFindSimilar?: () => void;
  hasBeatmapset: boolean;
  onClose: () => void;
}

function ContextMenu({ x, y, onHideBeatmap, onHideBeatmapset, onFindSimilar, hasBeatmapset, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleKey); };
  }, [onClose]);

  const itemCount = [onFindSimilar, onHideBeatmap, hasBeatmapset && onHideBeatmapset].filter(Boolean).length;
  const menuW = 210;
  const clampedX = Math.min(x, window.innerWidth - menuW - 8);
  const clampedY = Math.min(y, window.innerHeight - itemCount * 38 - 8);

  return createPortal(
    <div ref={ref} onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}
      style={{ position: "fixed", left: clampedX, top: clampedY, zIndex: 99999,
        background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.6)", minWidth: menuW, overflow: "hidden" }}>
      {onFindSimilar && <CtxBtn icon={<IconTarget size={13} strokeWidth={2.5} />} label="Find Similar Beatmap" onClick={() => { onFindSimilar(); onClose(); }} />}
      {onHideBeatmap && <CtxBtn icon={<IconBan size={13} strokeWidth={2.5} />} label="Hide this beatmap" onClick={() => { onHideBeatmap(); onClose(); }} />}
      {hasBeatmapset && onHideBeatmapset && <CtxBtn icon={<IconFolderMinus size={13} strokeWidth={2.5} />} label="Hide this beatmapset" onClick={() => { onHideBeatmapset!(); onClose(); }} />}
    </div>,
    document.body,
  );
}

function CtxBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={e => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 14px",
        background: "transparent", border: "none", color: "var(--muted)", fontSize: 12,
        textAlign: "left", cursor: "pointer" }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(180,130,220,0.1)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
      {icon} {label}
    </button>
  );
}

// ── Cover with hover overlay ──────────────────────────────────────────────────

interface CoverProps {
  bgImg: string | null;
  beatmapId: string;
  beatmapsetId: string | null;
  title?: string | null;
  artist?: string | null;
  status: string | null;
  statusCol: string;
  showSave?: boolean;
  onSave?: () => void;
}

function CoverOverlay({ bgImg, status, statusCol }: Pick<CoverProps, "bgImg" | "status" | "statusCol">) {
  return (
    <div style={{ position: "relative", height: 130, overflow: "hidden", background: "var(--bg)", flexShrink: 0 }}>
      {bgImg && (
        <img src={bgImg} alt="" loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", opacity: 0.65, display: "block" }}
          onError={e => { (e.currentTarget.parentElement!.style.background = "var(--bg)"); e.currentTarget.style.display = "none"; }} />
      )}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
        background: "linear-gradient(to bottom, transparent 30%, var(--card) 100%)" }} />
      {status && (
        <span style={{ position: "absolute", top: 8, left: 8, fontSize: 9, fontWeight: 700,
          padding: "2px 7px", borderRadius: 4, border: `1px solid ${statusCol}88`,
          color: statusCol, background: "rgba(0,0,0,0.6)", fontFamily: "var(--font-m)",
          letterSpacing: "0.06em", pointerEvents: "none" }}>
          {status.toUpperCase()}
        </span>
      )}
    </div>
  );
}

function CardActions({ beatmapId, beatmapsetId, title, artist, showSave, onSave }: Pick<CoverProps, "beatmapId" | "beatmapsetId" | "title" | "artist" | "showSave" | "onSave">) {
  const [playing, setPlaying] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  const previewUrl = beatmapsetId ? `https://b.ppy.sh/preview/${beatmapsetId}.mp3` : null;
  const webUrl = beatmapsetId
    ? `https://osu.ppy.sh/beatmapsets/${beatmapsetId}#osu/${beatmapId}`
    : `https://osu.ppy.sh/beatmaps/${beatmapId}`;
  const dlParams = new URLSearchParams();
  if (title) dlParams.set("title", title);
  if (artist) dlParams.set("artist", artist);
  const dlUrl = beatmapsetId ? `${BASE_URL}/proxy/download/${beatmapsetId}?${dlParams}` : null;

  useEffect(() => {
    return subscribeAudio((track, globalPlaying) => {
      const isOurs = !!beatmapsetId && track?.beatmapsetId === beatmapsetId;
      setPlaying(isOurs && globalPlaying);
    });
  }, [beatmapsetId]);

  const togglePlay = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!previewUrl) return;
    if (playing) {
      pauseAudio();
    } else if (stopRef.current) {
      resumeAudio();
    } else {
      stopRef.current = _playPreview(
        previewUrl,
        { title: title ?? `Beatmap #${beatmapId}`, artist: artist ?? "Unknown", beatmapsetId: beatmapsetId ?? "" },
        () => { stopRef.current = null; },
      );
    }
  }, [playing, previewUrl, title, artist, beatmapId, beatmapsetId]);

  useEffect(() => () => { stopRef.current = null; }, []);

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "6px 14px 0" }}>
      {previewUrl && (
        <button onClick={togglePlay} title={playing ? "Pause preview" : "Play preview"}
          style={{ ...iconBtnStyle, color: playing ? "#ff66aa" : "var(--muted)" }}>
          {playing ? <IconPause size={14} strokeWidth={2.5} /> : <IconPlay size={14} strokeWidth={2.5} />}
        </button>
      )}
      <a href={webUrl} target="_blank" rel="noopener noreferrer"
        onClick={e => e.stopPropagation()} title="Open on osu!"
        style={{ ...iconBtnStyle, color: "var(--muted)", textDecoration: "none" }}>
        <IconExternalLink size={14} strokeWidth={2.5} />
      </a>
      {dlUrl && (
        <a href={dlUrl} onClick={e => e.stopPropagation()} title="Download .osz"
          style={{ ...iconBtnStyle, color: "var(--muted)", textDecoration: "none" }}>
          <IconDownload size={14} strokeWidth={2.5} />
        </a>
      )}
      {showSave && (
        <button onClick={e => { e.stopPropagation(); onSave?.(); }} title="Save to playlist"
          style={{ ...iconBtnStyle, color: "var(--muted)" }}>
          <IconBookmark size={14} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

interface BeatmapCardProps {
  record: BeatmapRecord;
  highlightTags?: string[];
  currentUser?: CurrentUser | null;
  onHide?: (beatmapId: string) => void;
  onHideSet?: (beatmapsetId: string) => void;
  onFindSimilar?: (record: BeatmapRecord) => void;
}

export function BeatmapCard({ record, highlightTags, currentUser, onHide, onHideSet, onFindSimilar }: BeatmapCardProps) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [labelPage, setLabelPage] = useState(0);
  const [labelHovered, setLabelHovered] = useState(false);

  const title = record.title ?? `Beatmap #${record.beatmap_id}`;
  const stars = record.difficulty_rating;
  const starCol = starColor(stars);
  const starTxtCol = starTextColor(stars);
  const statusCol = STATUS_COLOR[record.status ?? ""] ?? "var(--muted)";

  const bgImg = record.card_url || record.cover_url ||
    (record.beatmapset_id ? `https://assets.ppy.sh/beatmaps/${record.beatmapset_id}/covers/card.jpg` : null);

  const sortedLabels = [...record.labels].sort((a, b) => b.probability - a.probability);
  const PAGE_SIZE = 3;
  const totalLabelPages = Math.ceil(sortedLabels.length / PAGE_SIZE);
  const coreLabels = sortedLabels.slice(labelPage * PAGE_SIZE, labelPage * PAGE_SIZE + PAGE_SIZE);
  const maxProb = sortedLabels[0]?.probability ?? 1;
  const hasMultiplePages = totalLabelPages > 1;

  function handleContextMenu(e: React.MouseEvent) {
    if (!onHide && !onHideSet && !onFindSimilar) return;
    e.preventDefault(); e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY });
  }

  return (
    <>
      <div onContextMenu={handleContextMenu} style={cardStyle}>
        <CoverOverlay
          bgImg={bgImg}
          status={record.status}
          statusCol={statusCol}
        />
        <CardActions
          beatmapId={record.beatmap_id}
          beatmapsetId={record.beatmapset_id}
          title={record.title}
          artist={record.artist}
          showSave={!!currentUser}
          onSave={() => setShowPlaylist(true)}
        />

        <div style={bodyStyle}>
          <div style={titleStyle}>{title}</div>
          {record.artist && <div style={artistStyle}>{record.artist}</div>}

          <div style={{ marginBottom: 8, minWidth: 0 }}>
            <BeatmapStats
              ar={record.ar} cs={record.cs} od={record.od}
              objectCount={record.object_count}
              difficultyRating={stars}
              starColor={starCol}
              version={record.version}
              bpm={record.bpm}
            />
          </div>

          {coreLabels.length > 0 && (
            <div
              onClick={e => { if (!hasMultiplePages) return; e.stopPropagation(); setLabelPage(p => (p + 1) % totalLabelPages); }}
              onMouseEnter={() => setLabelHovered(true)}
              onMouseLeave={() => { setLabelHovered(false); setLabelPage(0); }}
              style={{ display: "flex", flexDirection: "column", gap: 5, cursor: hasMultiplePages ? "pointer" : "default" }}
            >
              {coreLabels.map(l => {
                const highlighted = highlightTags?.includes(l.label);
                const barColor = highlighted ? "#ff66aa" : starCol;
                const pctColor = highlighted ? "#ff66aa" : starTxtCol;
                return (
                  <div key={l.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontFamily: "var(--font-m)", fontSize: 10,
                        color: highlighted ? "#ff66aa" : "var(--muted)" }}>{l.label}</span>
                      <span style={{ fontFamily: "var(--font-m)", fontSize: 10,
                        color: pctColor, fontWeight: 600 }}>{(l.probability * 100).toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${(l.probability / maxProb) * 100}%`, height: "100%", borderRadius: 2,
                        background: `linear-gradient(90deg, ${barColor}cc, ${barColor}55)`,
                        transition: "width 0.3s ease" }} />
                    </div>
                  </div>
                );
              })}
              {hasMultiplePages && (
                <div style={{ textAlign: "right", fontFamily: "var(--font-m)", fontSize: 9,
                  color: labelHovered ? "var(--muted)" : "var(--muted2)", transition: "color 0.15s", marginTop: 1 }}>
                  {labelPage + 1}/{totalLabelPages} · click to cycle
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} hasBeatmapset={!!record.beatmapset_id}
          onFindSimilar={onFindSimilar ? () => onFindSimilar(record) : undefined}
          onHideBeatmap={onHide ? () => onHide(record.beatmap_id) : undefined}
          onHideBeatmapset={onHideSet && record.beatmapset_id ? () => onHideSet(record.beatmapset_id!) : undefined}
          onClose={() => setMenu(null)} />
      )}

      {showPlaylist && currentUser && (
        <SaveToPlaylistModal
          beatmapId={record.beatmap_id}
          beatmapTitle={record.title ?? `Beatmap #${record.beatmap_id}`}
          onClose={() => setShowPlaylist(false)}
        />
      )}
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid rgba(180,130,220,0.18)",
  borderRadius: 12,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  cursor: "default",
};

const iconBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 4,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 4,
};

const bodyStyle: React.CSSProperties = {
  padding: "12px 14px 14px", flex: 1, display: "flex", flexDirection: "column",
  minWidth: 0, overflow: "hidden",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-d)", fontWeight: 800, fontSize: 14, color: "var(--text)",
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
  background: "var(--stat-bg)", border: "1px solid var(--stat-border)",
  color: "var(--stat-color)",
};
