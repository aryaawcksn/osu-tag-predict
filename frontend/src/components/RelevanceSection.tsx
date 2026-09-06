import { useState } from "react";
import { BeatmapRecord, LabelResult, PredictResult } from "../types";
import { getBeatmapsByRelevance } from "../api";
import { BeatmapCard } from "./BeatmapCard";

interface Props {
  result: PredictResult;
}

export default function RelevanceSection({ result }: Props) {
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<BeatmapRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const labels: LabelResult[] = result.predicted_labels ?? [];
  const topLabels = [...labels].sort((a, b) => b.probability - a.probability).slice(0, 4);
  const sourceTitle = result.title
    ? `${result.title}${result.version ? ` [${result.version}]` : ""}`
    : result.filename ?? "this beatmap";

  async function handleOpen() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (records.length > 0) return;
    setLoading(true);
    setError(null);
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
    <div style={{ marginTop: 12 }}>
      <button onClick={handleOpen} style={triggerBtnStyle}>
        {open ? "▲ Hide Relevance" : "🎯 Find Relevance Beatmap"}
      </button>

      {open && (
        <div style={sectionStyle}>
          <div style={{ marginBottom: 12 }}>
            <div style={sectionTitleStyle}>
              Beatmap Relevance to{" "}
              <span style={{ color: "#ff6b9d" }}>{sourceTitle}</span>
            </div>
            {/* source tag chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
              {topLabels.map(({ label, probability }) => (
                <span key={label} style={relevanceTagChipStyle}>
                  {label} {(probability * 100).toFixed(0)}%
                </span>
              ))}
            </div>
          </div>

          {loading && (
            <p style={{ color: "#a7a9be", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
              Finding similar beatmaps…
            </p>
          )}
          {error && <div style={errorStyle}>{error}</div>}

          {!loading && records.length > 0 && (
            <>
              <p style={{ fontSize: 12, color: "#a7a9be", marginBottom: 10 }}>
                Menemukan {records.length}{hasMore ? "+" : ""} hasil
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {records.map(bm => (
                  <BeatmapCard
                    key={bm.beatmap_id}
                    record={bm}
                    highlightTags={topLabels.map(l => l.label)}
                    relevanceTags={topLabels.map(l => l.label)}
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

          {!loading && !error && records.length === 0 && (
            <div style={emptyStyle}>No similar beatmaps found yet.</div>
          )}
        </div>
      )}
    </div>
  );
}

const triggerBtnStyle: React.CSSProperties = {
  width: "100%", padding: "9px 0", borderRadius: 8,
  border: "1px solid rgba(255,107,157,0.4)",
  background: "rgba(255,107,157,0.08)",
  color: "#ff6b9d", fontSize: 13, fontWeight: 600, cursor: "pointer",
};

const sectionStyle: React.CSSProperties = {
  marginTop: 12, padding: "16px",
  background: "#1a1929", border: "1px solid rgba(255,107,157,0.25)",
  borderRadius: 10,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 16, fontWeight: 700, color: "#fffffe",
};

const relevanceTagChipStyle: React.CSSProperties = {
  padding: "3px 9px", borderRadius: 4, fontSize: 11,
  background: "rgba(255,107,157,0.2)", border: "1px solid rgba(255,107,157,0.7)",
  color: "#ff6b9d", fontWeight: 700,
};

const errorStyle: React.CSSProperties = {
  padding: "10px 14px", background: "#2a0a14",
  border: "1px solid #7f1d1d", borderRadius: 8, color: "#fca5a5", fontSize: 13,
};

const emptyStyle: React.CSSProperties = {
  padding: "20px 16px", textAlign: "center", color: "#a7a9be",
  fontSize: 14, background: "#0f0e17", borderRadius: 8, border: "1px solid #2e2d3d",
};

const loadMoreStyle: React.CSSProperties = {
  display: "block", width: "100%", marginTop: 12,
  padding: "10px 0", borderRadius: 8, border: "1px solid #2e2d3d",
  background: "transparent", color: "#a7a9be", fontSize: 13, cursor: "pointer",
  textAlign: "center",
};
