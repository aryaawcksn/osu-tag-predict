import { useEffect, useState } from "react";
import { BeatmapRecord } from "../types";
import { getRecommendations } from "../api";
import { BeatmapCard } from "./BeatmapCard";

interface Props {
  playstyle: string;
}

export default function RecommendationList({ playstyle }: Props) {
  const [records, setRecords] = useState<BeatmapRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minStars, setMinStars] = useState<number>(0);
  const [maxStars, setMaxStars] = useState<number>(10);
  const [applied, setApplied] = useState<[number, number]>([0, 10]);

  function handleApply() {
    setApplied([minStars, maxStars]);
  }

  useEffect(() => {
    if (!playstyle) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    setRecords([]);

    const [mn, mx] = applied;
    getRecommendations(
      playstyle,
      mn > 0 ? mn : undefined,
      mx < 10 ? mx : undefined,
    )
      .then((res) => {
        setRecords(res.recommendations);
        if (res.message) setMessage(res.message);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load recommendations");
      })
      .finally(() => setLoading(false));
  }, [playstyle, applied]);

  return (
    <div style={containerStyle}>
      <h2 style={headingStyle}>Map Recommendations</h2>
      <p style={subtextStyle}>
        Maps matching your dominant playstyle:{" "}
        <strong style={{ color: "#ff6b9d" }}>{playstyle}</strong>
      </p>

      {/* Difficulty range filter */}
      <div style={filterRowStyle}>
        <span style={filterLabelStyle}>Difficulty</span>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#a7a9be" }}>
            <span>★ {minStars.toFixed(1)}</span>
            <span>★ {maxStars.toFixed(1)}</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="range" min={0} max={10} step={0.5} value={minStars}
              onChange={e => setMinStars(Math.min(Number(e.target.value), maxStars - 0.5))}
              style={rangeStyle} />
            <input type="range" min={0} max={10} step={0.5} value={maxStars}
              onChange={e => setMaxStars(Math.max(Number(e.target.value), minStars + 0.5))}
              style={rangeStyle} />
          </div>
        </div>
        <button onClick={handleApply} style={applyBtnStyle}>Apply</button>
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
const rangeStyle: React.CSSProperties = {
  flex: 1, accentColor: "#ff6b9d", cursor: "pointer",
};
const applyBtnStyle: React.CSSProperties = {
  padding: "5px 12px", borderRadius: 6, border: "none",
  background: "#ff6b9d", color: "#fff", fontSize: 12,
  fontWeight: 600, cursor: "pointer", flexShrink: 0,
};
const errorStyle: React.CSSProperties = {
  padding: "10px 14px", background: "#2a0a14",
  border: "1px solid #7f1d1d", borderRadius: 8, color: "#fca5a5", fontSize: 13,
};
const emptyStyle: React.CSSProperties = {
  padding: "20px 16px", textAlign: "center", color: "#a7a9be",
  fontSize: 14, background: "#0f0e17", borderRadius: 8, border: "1px solid #2e2d3d",
};
