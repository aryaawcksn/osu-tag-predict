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

  const defaultStars = result.difficulty_rating ?? 5;
  const [targetStars, setTargetStars] = useState(defaultStars);
  const [appliedStars, setAppliedStars] = useState<number | null>(null);

  const labels: LabelResult[] = result.predicted_labels ?? [];
  const topLabels = [...labels].sort((a, b) => b.probability - a.probability).slice(0, 4);
  const sourceTitle = result.title
    ? `${result.title}${result.version ? ` [${result.version}]` : ""}`
    : result.filename ?? "this beatmap";

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

  async function handleOpen() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (records.length > 0) return;
    doFetch(0, true, appliedStars);
  }

  function handleApplyStars() {
    setAppliedStars(targetStars);
    setOffset(0);
    doFetch(0, true, targetStars);
  }

  function handleClearStars() {
    setAppliedStars(null);
    setOffset(0);
    doFetch(0, true, null);
  }

  return (
    <div style={{ marginTop: 12 }}>
      <button onClick={handleOpen} style={triggerBtnStyle}>
        {open ? "▲ Hide Relevance" : "🎯 Find Relevance Beatmap"}
      </button>

      {open && (
        <div style={panelStyle}>
          <div style={{ marginBottom: 10 }}>
            <div style={panelTitleStyle}>
              Beatmap Relevance to <span style={{ color: "var(--pink)" }}>{sourceTitle}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
              {topLabels.map(({ label, probability }) => (
                <span key={label} style={tagChipStyle}>
                  {label} {(probability * 100).toFixed(0)}%
                </span>
              ))}
            </div>
          </div>

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
              <button onClick={handleApplyStars} style={applyBtnStyle}>Apply</button>
              {appliedStars != null && (
                <button onClick={handleClearStars} style={clearBtnStyle}>✕</button>
              )}
            </div>
          </div>

          {loading && (
            <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "14px 0" }}>
              Finding similar beatmaps…
            </p>
          )}
          {error && <div style={errorStyle}>{error}</div>}

          {!loading && records.length > 0 && (
            <>
              <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
                {records.length}{hasMore ? "+" : ""} results
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {records.map(bm => (
                  <BeatmapCard key={bm.beatmap_id} record={bm} highlightTags={topLabels.map(l => l.label)} />
                ))}
              </div>
              {hasMore && (
                <button onClick={() => doFetch(offset, false, appliedStars)} disabled={loadingMore} style={loadMoreStyle}>
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
  border: "1px solid rgba(255,102,170,0.4)",
  background: "rgba(255,102,170,0.07)",
  color: "var(--pink)", fontSize: 13, fontFamily: "var(--font-d)", fontWeight: 700, cursor: "pointer",
};
const panelStyle: React.CSSProperties = {
  marginTop: 10, padding: 16,
  background: "var(--card)", border: "1px solid rgba(255,102,170,0.2)", borderRadius: 10,
};
const panelTitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-d)", fontSize: 15, fontWeight: 800, color: "#fff",
};
const tagChipStyle: React.CSSProperties = {
  padding: "3px 9px", borderRadius: 4, fontSize: 11, fontFamily: "var(--font-m)",
  background: "rgba(255,102,170,0.14)", border: "1px solid rgba(255,102,170,0.6)",
  color: "var(--pink)", fontWeight: 700,
};
const filterRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  background: "var(--card2)", border: "1px solid var(--border)",
  borderRadius: 7, padding: "8px 12px", marginBottom: 12,
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
  padding: "20px 16px", textAlign: "center", color: "var(--muted)",
  fontSize: 14, background: "var(--card2)", borderRadius: 8, border: "1px solid var(--border)",
};
const loadMoreStyle: React.CSSProperties = {
  display: "block", width: "100%", marginTop: 12,
  padding: "10px 0", borderRadius: 8, border: "1px solid var(--border)",
  background: "transparent", color: "var(--muted)", fontSize: 13, cursor: "pointer",
  textAlign: "center",
};
