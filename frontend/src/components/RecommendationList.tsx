import { useEffect, useState } from "react";
import { BeatmapRecord } from "../types";
import { getRecommendations } from "../api";
import { BeatmapCard } from "./BeatmapCard";

interface Props {
  playstyle: string;
  avgDifficulty?: number;
}

const STATUSES = ["ranked", "loved", "approved", "qualified", "pending", "graveyard", "wip"];

export default function RecommendationList({ playstyle, avgDifficulty }: Props) {
  const [records, setRecords] = useState<BeatmapRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetStars, setTargetStars] = useState<number>(avgDifficulty ?? 5);
  const [appliedStars, setAppliedStars] = useState<number | null>(avgDifficulty ?? null);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    if (!playstyle) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    setRecords([]);

    // If filter applied, search ±0.5 around target; backend expands if needed
    const minS = appliedStars != null ? appliedStars - 0.5 : undefined;
    const maxS = appliedStars != null ? appliedStars + 0.5 : undefined;

    getRecommendations(playstyle, minS, maxS, status || undefined)
      .then((res) => {
        setRecords(res.recommendations);
        if (res.message) setMessage(res.message);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load recommendations");
      })
      .finally(() => setLoading(false));
  }, [playstyle, appliedStars, status]);

  return (
    <div style={containerStyle}>
      <h2 style={headingStyle}>Map Recommendations</h2>
      <p style={subtextStyle}>
        Maps matching your dominant playstyle:{" "}
        <strong style={{ color: "#ff6b9d" }}>{playstyle}</strong>
      </p>

      {/* Filters row */}
      <div style={filterRowStyle}>
        <span style={filterLabelStyle}>Difficulty</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#a7a9be", marginBottom: 4 }}>
            <span>★ 1</span>
            <span style={{ color: "#ff6b9d", fontWeight: 600 }}>
              {appliedStars != null ? `★ ${appliedStars.toFixed(1)}` : "Any"}
            </span>
            <span>★ 10</span>
          </div>
          <input
            type="range" min={1} max={10} step={0.5}
            value={targetStars}
            onChange={e => setTargetStars(Number(e.target.value))}
            style={{ width: "100%", accentColor: "#ff6b9d", cursor: "pointer" }}
          />
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={() => setAppliedStars(targetStars)} style={applyBtnStyle}>Apply</button>
          {appliedStars != null && (
            <button onClick={() => setAppliedStars(null)} style={clearBtnStyle}>✕</button>
          )}
        </div>
      </div>

      {/* Status filter */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatus(status === s ? "" : s)} style={statusBtnStyle(status === s, s)}>
            {s}
          </button>
        ))}
      </div>

      {loading && (
        <p style={{ color: "#a7a9be", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
          Loading recommendations…
        </p>
      )}
      {error && <div style={errorStyle}>{error}</div>}
      {!loading && !error && records.length === 0 && (
        <div style={emptyStyle}>
          {message ?? `No recommendations for "${playstyle}" yet. Try predicting more beatmaps first.`}
        </div>
      )}
      {records.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
          {records.map((bm) => <BeatmapCard key={bm.beatmap_id} record={bm} />)}
        </div>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  background: "#1a1929", border: "1px solid #2e2d3d",
  borderRadius: 12, padding: 24, marginTop: 24,
};
const headingStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, color: "#fffffe", marginBottom: 6,
};
const subtextStyle: React.CSSProperties = {
  color: "#a7a9be", fontSize: 13, marginBottom: 16,
};
const filterRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12,
  background: "#0f0e17", border: "1px solid #2e2d3d",
  borderRadius: 8, padding: "10px 14px", marginBottom: 16,
};
const filterLabelStyle: React.CSSProperties = {
  fontSize: 12, color: "#a7a9be", flexShrink: 0,
};
const applyBtnStyle: React.CSSProperties = {
  padding: "4px 10px", borderRadius: 6, border: "none",
  background: "#ff6b9d", color: "#fff", fontSize: 11,
  fontWeight: 600, cursor: "pointer",
};
const clearBtnStyle: React.CSSProperties = {
  padding: "4px 8px", borderRadius: 6,
  border: "1px solid #2e2d3d", background: "transparent",
  color: "#a7a9be", fontSize: 11, cursor: "pointer",
};
const errorStyle: React.CSSProperties = {
  padding: "10px 14px", background: "#2a0a14",
  border: "1px solid #7f1d1d", borderRadius: 8, color: "#fca5a5", fontSize: 13,
};
const emptyStyle: React.CSSProperties = {
  padding: "20px 16px", textAlign: "center", color: "#a7a9be",
  fontSize: 14, background: "#0f0e17", borderRadius: 8, border: "1px solid #2e2d3d",
};

const STATUS_COLORS: Record<string, string> = {
  ranked: "#b8e994", loved: "#ff6b9d", approved: "#b8e994",
  qualified: "#74b9ff", pending: "#fbbf24", graveyard: "#636e72", wip: "#fbbf24",
};

function statusBtnStyle(active: boolean, s: string): React.CSSProperties {
  const c = STATUS_COLORS[s] ?? "#a7a9be";
  return {
    padding: "4px 10px", borderRadius: 20, fontSize: 11,
    cursor: "pointer", border: "1px solid",
    background: active ? `${c}22` : "transparent",
    color: active ? c : "#636e72",
    borderColor: active ? c : "#2e2d3d",
    textTransform: "capitalize",
  };
}
