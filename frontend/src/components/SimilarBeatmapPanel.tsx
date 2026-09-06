import { useEffect, useState } from "react";
import { BeatmapRecord, LabelResult } from "../types";
import { getBeatmapsByRelevance } from "../api";
import { BeatmapCard } from "./BeatmapCard";

interface Props {
  sourceBeatmap: BeatmapRecord;
  onClose: () => void;
  onFindSimilar: (record: BeatmapRecord) => void;
}

export default function SimilarBeatmapPanel({ sourceBeatmap, onClose, onFindSimilar }: Props) {
  const [records, setRecords] = useState<BeatmapRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Difficulty filter
  const defaultStars = sourceBeatmap.difficulty_rating ?? 5;
  const [targetStars, setTargetStars] = useState(defaultStars);
  const [appliedStars, setAppliedStars] = useState<number | null>(null);

  const labels: LabelResult[] = sourceBeatmap.labels ?? [];
  const topLabels = [...labels].sort((a, b) => b.probability - a.probability).slice(0, 4);
  const sourceTitle = sourceBeatmap.title
    ? `${sourceBeatmap.title}${sourceBeatmap.version ? ` [${sourceBeatmap.version}]` : ""}`
    : `Beatmap #${sourceBeatmap.beatmap_id}`;

  async function doFetch(off: number, replace: boolean, stars: number | null) {
    if (replace) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    const minS = stars != null ? stars - 0.5 : undefined;
    const maxS = stars != null ? stars + 0.5 : undefined;
    try {
      const res = await getBeatmapsByRelevance(labels, off, minS, maxS);
      if (replace) setRecords(res.beatmaps);
      else setRecords(prev => [...prev, ...res.beatmaps]);
      setHasMore(res.has_more);
      setOffset(off + res.beatmaps.length);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    setOffset(0);
    doFetch(0, true, appliedStars);
  }, [sourceBeatmap.beatmap_id, appliedStars]);

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fffffe" }}>
            Similar to <span style={{ color: "#ff6b9d" }}>{sourceTitle}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
            {topLabels.map(({ label, probability }) => (
              <span key={label} style={chipStyle}>
                {label} {(probability * 100).toFixed(0)}%
              </span>
            ))}
          </div>
        </div>
        <button onClick={onClose} style={closeBtnStyle} title="Close">✕</button>
      </div>

      {/* Difficulty filter */}
      <div style={filterRowStyle}>
        <span style={{ fontSize: 11, color: "#a7a9be", flexShrink: 0 }}>Difficulty</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#a7a9be", marginBottom: 3 }}>
            <span>★ 0.1</span>
            <span style={{ color: "#ff6b9d", fontWeight: 600 }}>
              ★ {targetStars.toFixed(1)}
              {appliedStars === null
                ? <span style={{ color: "#636e72", fontWeight: 400, marginLeft: 4 }}>(Any)</span>
                : <span style={{ color: "#b8e994", fontWeight: 400, marginLeft: 4 }}>(Applied)</span>
              }
            </span>
            <span>★ 15.0</span>
          </div>
          <input type="range" min={0.1} max={15.0} step={0.1} value={targetStars}
            onChange={e => setTargetStars(Number(e.target.value))}
            style={{ width: "100%", accentColor: "#ff6b9d", cursor: "pointer" }} />
        </div>
        <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
          <button onClick={() => setAppliedStars(targetStars)}
            style={{ padding: "3px 8px", borderRadius: 5, border: "none", background: "#ff6b9d", color: "#fff", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
            Apply
          </button>
          {appliedStars != null && (
            <button onClick={() => setAppliedStars(null)}
              style={{ padding: "3px 7px", borderRadius: 5, border: "1px solid #2e2d3d", background: "transparent", color: "#a7a9be", fontSize: 10, cursor: "pointer" }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {loading && (
        <p style={{ color: "#a7a9be", fontSize: 13, textAlign: "center", padding: "14px 0" }}>
          Finding similar beatmaps…
        </p>
      )}
      {error && <div style={errorStyle}>{error}</div>}
      {!loading && !error && records.length === 0 && (
        <div style={emptyStyle}>No similar beatmaps found.</div>
      )}
      {!loading && records.length > 0 && (
        <>
          <p style={{ fontSize: 11, color: "#636e72", marginBottom: 8 }}>
            {records.length}{hasMore ? "+" : ""} hasil · sorted by relevance
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {records.map(bm => (
              <BeatmapCard
                key={bm.beatmap_id}
                record={bm}
                highlightTags={topLabels.map(l => l.label)}
                onFindSimilar={onFindSimilar}
              />
            ))}
          </div>
          {hasMore && (
            <button onClick={() => doFetch(offset, false, appliedStars)} disabled={loadingMore} style={loadMoreStyle}>
              {loadingMore ? "Loading…" : "↓ Load more"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  marginTop: 10, padding: "14px 16px",
  background: "#13121f", border: "1px solid rgba(255,107,157,0.3)", borderRadius: 10,
};
const headerStyle: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10,
  paddingBottom: 10, borderBottom: "1px solid #2e2d3d",
};
const chipStyle: React.CSSProperties = {
  padding: "2px 8px", borderRadius: 4, fontSize: 11,
  background: "rgba(255,107,157,0.18)", border: "1px solid rgba(255,107,157,0.6)",
  color: "#ff6b9d", fontWeight: 600,
};
const closeBtnStyle: React.CSSProperties = {
  background: "transparent", border: "none", color: "#636e72",
  fontSize: 14, cursor: "pointer", padding: "2px 6px", flexShrink: 0,
};
const filterRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  background: "#0f0e17", border: "1px solid #2e2d3d",
  borderRadius: 7, padding: "8px 12px", marginBottom: 10,
};
const errorStyle: React.CSSProperties = {
  padding: "10px 14px", background: "#2a0a14",
  border: "1px solid #7f1d1d", borderRadius: 8, color: "#fca5a5", fontSize: 13,
};
const emptyStyle: React.CSSProperties = {
  padding: "16px", textAlign: "center", color: "#a7a9be",
  fontSize: 13, background: "#0f0e17", borderRadius: 8, border: "1px solid #2e2d3d",
};
const loadMoreStyle: React.CSSProperties = {
  display: "block", width: "100%", marginTop: 10,
  padding: "8px 0", borderRadius: 8, border: "1px solid #2e2d3d",
  background: "transparent", color: "#a7a9be", fontSize: 13, cursor: "pointer",
  textAlign: "center",
};
