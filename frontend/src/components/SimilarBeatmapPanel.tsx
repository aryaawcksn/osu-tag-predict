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
          <div style={{ fontFamily: "var(--font-d)", fontSize: 13, fontWeight: 700, color: "#fff" }}>
            Similar to <span style={{ color: "var(--pink)" }}>{sourceTitle}</span>
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
        <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>Difficulty</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted)", marginBottom: 3 }}>
            <span>★ 0.1</span>
            <span style={{ color: "var(--pink)", fontWeight: 600 }}>
              ★ {targetStars.toFixed(1)}
              {appliedStars === null
                ? <span style={{ color: "var(--muted2)", fontWeight: 400, marginLeft: 4 }}>(Any)</span>
                : <span style={{ color: "#b8e994", fontWeight: 400, marginLeft: 4 }}>(Applied)</span>
              }
            </span>
            <span>★ 15.0</span>
          </div>
          <input type="range" min={0.1} max={15.0} step={0.1} value={targetStars}
            onChange={e => setTargetStars(Number(e.target.value))}
            style={{ width: "100%", cursor: "pointer" }} />
        </div>
        <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
          <button onClick={() => setAppliedStars(targetStars)} style={applyBtnStyle}>Apply</button>
          {appliedStars != null && (
            <button onClick={() => setAppliedStars(null)} style={clearBtnStyle}>✕</button>
          )}
        </div>
      </div>

      {loading && (
        <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "14px 0" }}>
          Finding similar beatmaps…
        </p>
      )}
      {error && <div style={errorStyle}>{error}</div>}
      {!loading && !error && records.length === 0 && (
        <div style={emptyStyle}>No similar beatmaps found.</div>
      )}
      {!loading && records.length > 0 && (
        <>
          <p style={{ fontSize: 11, color: "var(--muted2)", marginBottom: 8 }}>
            {records.length}{hasMore ? "+" : ""} results · sorted by relevance
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {records.map(bm => (
              <BeatmapCard key={bm.beatmap_id} record={bm}
                highlightTags={topLabels.map(l => l.label)} onFindSimilar={onFindSimilar} />
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
  background: "var(--card)", border: "1px solid rgba(255,102,170,0.25)", borderRadius: 10,
};
const headerStyle: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10,
  paddingBottom: 10, borderBottom: "1px solid var(--border)",
};
const chipStyle: React.CSSProperties = {
  padding: "2px 8px", borderRadius: 4, fontSize: 11, fontFamily: "var(--font-m)",
  background: "rgba(255,102,170,0.14)", border: "1px solid rgba(255,102,170,0.5)",
  color: "var(--pink)", fontWeight: 600,
};
const closeBtnStyle: React.CSSProperties = {
  background: "transparent", border: "none", color: "var(--muted2)",
  fontSize: 14, cursor: "pointer", padding: "2px 6px", flexShrink: 0,
};
const filterRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  background: "var(--card2)", border: "1px solid var(--border)",
  borderRadius: 7, padding: "8px 12px", marginBottom: 10,
};
const applyBtnStyle: React.CSSProperties = {
  padding: "3px 8px", borderRadius: 5, border: "none",
  background: "linear-gradient(135deg, var(--pink), var(--pink-dim))",
  color: "#fff", fontSize: 10, fontFamily: "var(--font-d)", fontWeight: 700, cursor: "pointer",
};
const clearBtnStyle: React.CSSProperties = {
  padding: "3px 7px", borderRadius: 5, border: "1px solid var(--border)",
  background: "transparent", color: "var(--muted)", fontSize: 10, cursor: "pointer",
};
const errorStyle: React.CSSProperties = {
  padding: "10px 14px", background: "#1e0a10",
  border: "1px solid #7f1d1d", borderRadius: 8, color: "#fca5a5", fontSize: 13,
};
const emptyStyle: React.CSSProperties = {
  padding: "16px", textAlign: "center", color: "var(--muted)",
  fontSize: 13, background: "var(--card2)", borderRadius: 8, border: "1px solid var(--border)",
};
const loadMoreStyle: React.CSSProperties = {
  display: "block", width: "100%", marginTop: 10,
  padding: "8px 0", borderRadius: 8, border: "1px solid var(--border)",
  background: "transparent", color: "var(--muted)", fontSize: 13, cursor: "pointer",
  textAlign: "center",
};
