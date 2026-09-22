import { useEffect, useState } from "react";
import { BeatmapRecord } from "../types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

interface BeatmapsetGroup {
  beatmapset_id: string;
  title: string | null;
  artist: string | null;
  cover_url: string | null;
  card_url: string | null;
  status: string | null;
  ranked_date: string | null;
  difficulties: BeatmapRecord[];
}

interface ThisWeekResponse {
  week_start: string;
  week_end: string;
  beatmapsets: BeatmapsetGroup[];
  is_fallback?: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  ranked: "#b8e994", approved: "#b8e994", loved: "#ff6b9d",
  qualified: "#74b9ff", pending: "#fbbf24",
};

function fmt(n?: number | null, d = 1) {
  if (n == null) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(d);
}

function fmtDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear())
    return `${months[s.getMonth()]} ${s.getDate()} – ${e.getDate()}, ${e.getFullYear()}`;
  return `${months[s.getMonth()]} ${s.getDate()} – ${months[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
}

function starColor(stars?: number | null): string {
  if (!stars) return "#a7a9be";
  if (stars < 2)   return "#88d8b0";
  if (stars < 3)   return "#6bcfff";
  if (stars < 4.5) return "#ffd700";
  if (stars < 6)   return "#ff9a56";
  if (stars < 7.5) return "#ff6b9d";
  return "#c084fc";
}

// ── Main section ────────────────────────────────────────────────

export default function BeatmapsThisWeek() {
  const [data, setData] = useState<ThisWeekResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE_URL}/beatmaps/this-week`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!data || data.beatmapsets.length === 0) return null;

  return (
    <section style={sectionStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>
            {data.is_fallback ? "Recent Beatmaps" : "Beatmap This Week"}
          </h2>
          <p style={subtitleStyle}>
            {fmtDateRange(data.week_start, data.week_end)}
            {" · "}
            <span style={{ color: "#fffffe" }}>
              {data.beatmapsets.length} beatmapset{data.beatmapsets.length !== 1 ? "s" : ""} found
            </span>
          </p>
        </div>
      </div>

      <div style={gridStyle}>
        {data.beatmapsets.map(set => (
          <BeatmapsetCard key={set.beatmapset_id} set={set} />
        ))}
      </div>
    </section>
  );
}

// ── Card ────────────────────────────────────────────────────────

function BeatmapsetCard({ set }: { set: BeatmapsetGroup }) {
  const [selectedIdx, setSelectedIdx] = useState(set.difficulties.length - 1); // default hardest

  const diff = set.difficulties[selectedIdx] ?? set.difficulties[0];
  const imgUrl =
    set.card_url || set.cover_url ||
    `https://assets.ppy.sh/beatmaps/${set.beatmapset_id}/covers/card.jpg`;
  const statusColor = STATUS_COLOR[set.status ?? ""] ?? "#a7a9be";

  // Top 4 tags of selected diff, sorted by probability desc
  const topLabels = [...(diff?.labels ?? [])]
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 4);

  const maxProb = topLabels[0]?.probability ?? 1;

  const hoverEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderColor = "rgba(255,107,157,0.5)";
    e.currentTarget.style.transform = "translateY(-2px)";
    e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.5)";
  };
  const hoverLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderColor = "#2e2d3d";
    e.currentTarget.style.transform = "none";
    e.currentTarget.style.boxShadow = "none";
  };

  return (
    <div style={cardStyle} onMouseEnter={hoverEnter} onMouseLeave={hoverLeave}>
      {/* Cover — clicking goes to beatmapset page */}
      <a
        href={`https://osu.ppy.sh/beatmaps/${diff?.beatmap_id ?? ""}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: "none", display: "block" }}
      >
        <div style={imgWrapStyle}>
          <img
            src={imgUrl} alt="" style={imgStyle} loading="lazy"
            onError={e => {
              (e.currentTarget.parentElement!.style.background = "#100f1c");
              e.currentTarget.style.display = "none";
            }}
          />
          <div style={imgOverlayStyle} />
          {set.status && (
            <span style={{ ...statusBadgeStyle, color: statusColor, borderColor: `${statusColor}88` }}>
              {set.status.toUpperCase()}
            </span>
          )}
        </div>
      </a>

      {/* Body */}
      <div style={bodyStyle}>
        {/* Title + artist */}
        <div style={songTitleStyle}>{set.title ?? `Beatmapset #${set.beatmapset_id}`}</div>
        <div style={artistLineStyle}>
          by {set.artist ?? "Unknown"}
          {diff?.bpm != null && (
            <span style={{ color: "#636e72", marginLeft: 6 }}>{fmt(diff.bpm, 0)} BPM</span>
          )}
        </div>

        {/* Stats for selected diff */}
        {diff && (
          <div style={statsRowStyle}>
            {diff.difficulty_rating != null && (
              <span style={statChip(starColor(diff.difficulty_rating), "rgba(255,215,0,0.1)")}>
                ★ {fmt(diff.difficulty_rating)}
              </span>
            )}
            {diff.ar != null && <span style={statChip("#a7a9be", "rgba(167,169,190,0.08)")}>AR{fmt(diff.ar)}</span>}
            {diff.cs != null && <span style={statChip("#a7a9be", "rgba(167,169,190,0.08)")}>CS{fmt(diff.cs)}</span>}
            {diff.od != null && <span style={statChip("#a7a9be", "rgba(167,169,190,0.08)")}>OD{fmt(diff.od)}</span>}
            {diff.object_count != null && (
              <span style={statChip("#a7a9be", "rgba(167,169,190,0.08)")}>{fmt(diff.object_count, 0)} obj</span>
            )}
          </div>
        )}

        {/* Top 4 tags with progress bars */}
        {topLabels.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
            {topLabels.map(l => (
              <div key={l.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 10, color: "#c8cad8" }}>{l.label}</span>
                  <span style={{ fontSize: 10, color: "#ff6b9d", fontWeight: 600 }}>
                    {(l.probability * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={barTrackStyle}>
                  <div style={{
                    ...barFillStyle,
                    width: `${(l.probability / maxProb) * 100}%`,
                    opacity: 0.7 + 0.3 * (l.probability / maxProb),
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Difficulty picker */}
        {set.difficulties.length > 1 && (
          <div style={diffPickerStyle}>
            {set.difficulties.map((d, i) => {
              const col = starColor(d.difficulty_rating);
              const active = i === selectedIdx;
              return (
                <button
                  key={d.beatmap_id}
                  onClick={() => setSelectedIdx(i)}
                  title={`${d.version ?? "?"} ★${fmt(d.difficulty_rating)}`}
                  style={{
                    padding: "3px 9px", borderRadius: 10, fontSize: 10,
                    border: `1px solid ${active ? col : col + "55"}`,
                    background: active ? `${col}28` : `${col}0d`,
                    color: active ? col : col + "aa",
                    cursor: "pointer", fontWeight: active ? 700 : 400,
                    transition: "all 0.12s ease",
                    whiteSpace: "nowrap" as const,
                  }}
                >
                  {d.version ?? `#${d.beatmap_id}`}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = { marginTop: 32 };

const headerStyle: React.CSSProperties = {
  display: "flex", justifyContent: "space-between",
  alignItems: "flex-end", marginBottom: 16,
};

const titleStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, color: "#fffffe", margin: 0,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 12, color: "#636e72", marginTop: 4,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
  gap: 14,
};

const cardStyle: React.CSSProperties = {
  background: "#1a1929", border: "1px solid #2e2d3d",
  borderRadius: 12, overflow: "hidden",
  transition: "border-color 0.2s, transform 0.15s, box-shadow 0.2s",
};

const imgWrapStyle: React.CSSProperties = {
  position: "relative", height: 140, overflow: "hidden", background: "#100f1c",
};

const imgStyle: React.CSSProperties = {
  width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block",
};

const imgOverlayStyle: React.CSSProperties = {
  position: "absolute", inset: 0,
  background: "linear-gradient(to bottom, transparent 40%, rgba(10,9,18,0.85) 100%)",
};

const statusBadgeStyle: React.CSSProperties = {
  position: "absolute", top: 8, left: 8,
  fontSize: 9, fontWeight: 700, padding: "2px 7px",
  borderRadius: 4, border: "1px solid", letterSpacing: "0.05em",
  background: "rgba(0,0,0,0.6)",
};

const bodyStyle: React.CSSProperties = { padding: "12px 14px 14px" };

const songTitleStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 700, color: "#fffffe",
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};

const artistLineStyle: React.CSSProperties = {
  fontSize: 12, color: "#c8cad8", marginTop: 2,
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};

const statsRowStyle: React.CSSProperties = {
  display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8, alignItems: "center",
};

function statChip(color: string, bg: string): React.CSSProperties {
  return {
    fontSize: 10, padding: "2px 6px", borderRadius: 4,
    background: bg, border: `1px solid ${color}33`, color,
  };
}

const barTrackStyle: React.CSSProperties = {
  height: 3, background: "rgba(255,107,157,0.12)",
  borderRadius: 2, overflow: "hidden",
};

const barFillStyle: React.CSSProperties = {
  height: "100%", background: "#ff6b9d", borderRadius: 2,
  transition: "width 0.3s ease",
};

const diffPickerStyle: React.CSSProperties = {
  display: "flex", gap: 5, flexWrap: "wrap", marginTop: 12,
  paddingTop: 10, borderTop: "1px solid rgba(46,45,61,0.6)",
};
