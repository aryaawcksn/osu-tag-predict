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
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const labels: LabelResult[] = sourceBeatmap.labels ?? [];
  const topLabels = [...labels].sort((a, b) => b.probability - a.probability).slice(0, 4);
  const sourceTitle = sourceBeatmap.title
    ? `${sourceBeatmap.title}${sourceBeatmap.version ? ` [${sourceBeatmap.version}]` : ""}`
    : `Beatmap #${sourceBeatmap.beatmap_id}`;

  useEffect(() => {
    async function fetch() {
      try {
        const res = await getBeatmapsByRelevance(labels);
        setRecords(res.beatmaps);
        setHasMore(res.has_more);
        setOffset(res.beatmaps.length);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed");
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [sourceBeatmap.beatmap_id]);

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      const res = await getBeatmapsByRelevance(labels, offset);
      setRecords(prev => [...prev, ...res.beatmaps]);
      setHasMore(res.has_more);
      setOffset(prev => prev + res.beatmaps.length);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fffffe" }}>
            Similar to{" "}
            <span style={{ color: "#ff6b9d" }}>{sourceTitle}</span>
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
            <button onClick={handleLoadMore} disabled={loadingMore} style={loadMoreStyle}>
              {loadingMore ? "Loading…" : "↓ Load more"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  marginTop: 10,
  padding: "14px 16px",
  background: "#13121f",
  border: "1px solid rgba(255,107,157,0.3)",
  borderRadius: 10,
};

const headerStyle: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12,
  paddingBottom: 12, borderBottom: "1px solid #2e2d3d",
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
