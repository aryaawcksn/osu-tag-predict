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
  ranked: "#b8e994", approved: "#b8e994", loved: "#ff66aa",
  qualified: "#74b9ff", pending: "#fbbf24",
};

function fmt(n?: number | null, d = 1) {
  if (n == null) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(d);
}

function fmtDateRange(start: string, end: string) {
  const s = new Date(start), e = new Date(end);
  const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear())
    return `${M[s.getMonth()]} ${s.getDate()} – ${e.getDate()}, ${e.getFullYear()}`;
  return `${M[s.getMonth()]} ${s.getDate()} – ${M[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
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

// ── Main section ─────────────────────────────────────────────

export default function BeatmapsThisWeek() {
  const [data, setData] = useState<ThisWeekResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE_URL}/beatmaps/this-week`)
      .then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading || !data || data.beatmapsets.length === 0) return null;

  return (
    <section style={{ marginTop: 32 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
            <h2 style={{ fontFamily: "var(--font-d)", fontSize: 18, fontWeight: 800, color: "#fff", margin: 0 }}>
              {data.is_fallback ? "Recent Beatmaps" : "Beatmap This Week"}
            </h2>
            {!data.is_fallback && (
              <span style={{ background: "linear-gradient(135deg, #ff66aa, #cc3377)", borderRadius: 5,
                padding: "2px 8px", fontFamily: "var(--font-d)", fontWeight: 800, fontSize: 10,
                color: "#fff", letterSpacing: "0.1em" }}>✦ LIVE</span>
            )}
          </div>
          <p style={{ fontSize: 12, color: "var(--muted2)" }}>
            {fmtDateRange(data.week_start, data.week_end)} · {data.beatmapsets.length} beatmapsets
          </p>
        </div>
      </div>

      {/* 4-col grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {data.beatmapsets.map(set => <BeatmapsetCard key={set.beatmapset_id} set={set} />)}
      </div>
    </section>
  );
}

// ── Card ─────────────────────────────────────────────────────

function BeatmapsetCard({ set }: { set: BeatmapsetGroup }) {
  const diffs = set.difficulties ?? [];
  const midIdx = Math.max(0, Math.floor((diffs.length - 1) / 2));
  const [selectedIdx, setSelectedIdx] = useState(midIdx);
  const diff = diffs[selectedIdx] ?? diffs[0];

  const imgUrl = set.card_url || set.cover_url ||
    `https://assets.ppy.sh/beatmaps/${set.beatmapset_id}/covers/card.jpg`;
  const statusCol = STATUS_COLOR[set.status ?? ""] ?? "var(--muted)";
  const starCol = starColor(diff?.difficulty_rating);

  const topLabels = [...(diff?.labels ?? [])]
    .sort((a, b) => b.probability - a.probability).slice(0, 3);
  const maxProb = topLabels[0]?.probability ?? 1;

  return (
    <a href={`https://osu.ppy.sh/beatmaps/${diff?.beatmap_id ?? ""}`}
      target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block" }}>
      <div
        style={cardStyle}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = "rgba(255,102,170,0.45)";
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.45)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = "rgba(180,130,220,0.18)";
          e.currentTarget.style.transform = "none";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {/* Cover */}
        <div style={{ position: "relative", height: 100, overflow: "hidden", background: "var(--bg)", flexShrink: 0 }}>
          <img src={imgUrl} alt="" loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.65 }}
            onError={e => { (e.currentTarget.parentElement!.style.background = "var(--bg)"); e.currentTarget.style.display = "none"; }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 25%, var(--card) 100%)" }} />
          {set.status && (
            <span style={{ position: "absolute", top: 8, right: 8, fontSize: 9, fontWeight: 700,
              padding: "2px 7px", borderRadius: 4, border: `1px solid ${statusCol}88`,
              color: statusCol, background: "rgba(0,0,0,0.55)", fontFamily: "var(--font-m)",
              letterSpacing: "0.06em" }}>
              {set.status.toUpperCase()}
            </span>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: "12px 14px 0", flex: 1 }}>
          <div style={{ fontFamily: "var(--font-d)", fontWeight: 800, fontSize: 14, color: "#fff",
            lineHeight: 1.25, marginBottom: 2,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {set.title ?? `Beatmapset #${set.beatmapset_id}`}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {set.artist ?? "Unknown"}
          </div>
          <div style={{ fontFamily: "var(--font-m)", fontSize: 10, color: "var(--muted2)", marginBottom: 8 }}>
            {diff?.bpm != null && <span>{fmt(diff.bpm, 0)} BPM</span>}
          </div>

          {/* Active diff star + stats */}
          {diff && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6, flexWrap: "wrap" }}>
                {/* Diff dot + name */}
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: starCol,
                  display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 12, color: starCol }}>
                  {diff.version ?? "—"}
                </span>
                <span style={{ fontFamily: "var(--font-m)", fontSize: 11, color: "#ffd700",
                  background: "rgba(255,204,0,0.1)", border: "1px solid rgba(255,204,0,0.25)",
                  borderRadius: 4, padding: "1px 6px" }}>
                  ★ {fmt(diff.difficulty_rating)}
                </span>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                {diff.ar != null && <span style={statBadge}>AR{fmt(diff.ar)}</span>}
                {diff.cs != null && <span style={statBadge}>CS{fmt(diff.cs)}</span>}
                {diff.od != null && <span style={statBadge}>OD{fmt(diff.od)}</span>}
                {diff.object_count != null && <span style={statBadge}>{fmt(diff.object_count, 0)} obj</span>}
              </div>
            </>
          )}

          {/* Tag bars */}
          {topLabels.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
              {topLabels.map(l => (
                <div key={l.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontFamily: "var(--font-m)", fontSize: 10, color: "var(--muted)" }}>{l.label}</span>
                    <span style={{ fontFamily: "var(--font-m)", fontSize: 10, color: starCol, fontWeight: 600 }}>
                      {(l.probability * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${(l.probability / maxProb) * 100}%`, height: "100%", borderRadius: 2,
                      background: `linear-gradient(90deg, ${starCol}cc, ${starCol}55)`,
                      transition: "width 0.35s ease" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Difficulty picker */}
        {diffs.length > 1 && (
          <div style={{ borderTop: "1px solid rgba(180,130,220,0.1)", padding: "8px 10px",
            display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 4,
            background: "rgba(0,0,0,0.2)" }}
            onClick={e => e.preventDefault()}>
            {diffs.map((d, i) => {
              const col = starColor(d.difficulty_rating);
              const active = i === selectedIdx;
              return (
                <button key={d.beatmap_id} title={`${d.version ?? "?"} ★${fmt(d.difficulty_rating)}`}
                  onClick={e => { e.preventDefault(); e.stopPropagation(); setSelectedIdx(i); }}
                  style={{ display: "flex", alignItems: "center", gap: 4,
                    padding: "3px 8px", borderRadius: 5,
                    border: `1px solid ${active ? col : "transparent"}`,
                    background: active ? `${col}1a` : "transparent",
                    cursor: "pointer", transition: "all 0.12s ease" }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = `${col}0d`; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: col,
                    display: "inline-block", boxShadow: active ? `0 0 4px ${col}` : "none" }} />
                  <span style={{ fontFamily: "var(--font-d)", fontSize: 11,
                    fontWeight: active ? 700 : 500,
                    color: active ? col : "var(--muted2)", whiteSpace: "nowrap" }}>
                    {d.version ?? `#${d.beatmap_id}`}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </a>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid rgba(180,130,220,0.18)",
  borderRadius: 12, overflow: "hidden",
  display: "flex", flexDirection: "column",
  transition: "border-color 0.2s, transform 0.15s, box-shadow 0.2s",
};

const statBadge: React.CSSProperties = {
  fontFamily: "var(--font-m)", fontSize: 10,
  padding: "2px 6px", borderRadius: 4,
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
  color: "#c0c0d0",
};
