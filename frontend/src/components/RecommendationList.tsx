import { useEffect, useState } from "react";
import { BeatmapRecord, CurrentUser, DominantPlaystyle } from "../types";
import { getRecommendations, hideBeatmap, hideBeatmapset, getPlaystyleAnalysis } from "../api";
import { BeatmapCard } from "./BeatmapCard";
import SimilarBeatmapPanel from "./SimilarBeatmapPanel";

interface Props {
  currentUser: CurrentUser;
}

const STATUSES = ["ranked", "loved", "approved", "qualified", "pending", "graveyard", "wip"];
const STATUS_COLORS: Record<string, string> = {
  ranked: "#b8e994", loved: "#ff66aa", approved: "#b8e994",
  qualified: "#74b9ff", pending: "#fbbf24", graveyard: "var(--muted2)", wip: "#fbbf24",
};

// Dice icon SVG
function DiceIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle" }}>
      <rect x="2" y="2" width="20" height="20" rx="4" ry="4" />
      <circle cx="8" cy="8" r="1.5" fill={active ? "currentColor" : "currentColor"} stroke="none" />
      <circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function RecommendationList({ currentUser }: Props) {
  const [dominant, setDominant] = useState<DominantPlaystyle | null>(null);
  const [records, setRecords] = useState<BeatmapRecord[]>([]);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"top" | "recent">("top");
  const [targetStars, setTargetStars] = useState<number>(5);
  const [appliedStars, setAppliedStars] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [similarBeatmap, setSimilarBeatmap] = useState<BeatmapRecord | null>(null);
  const [randomMode, setRandomMode] = useState(false);

  async function runAnalysis() {
    setAnalysisLoading(true);
    setError(null);
    setRecords([]);
    setDominant(null);
    try {
      const result = await getPlaystyleAnalysis(source);
      setDominant(result);
      setAppliedStars(result.avg_difficulty ?? null);
      setTargetStars(result.avg_difficulty ?? 5);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function fetchRecs(playstyle: string, off: number, replace: boolean) {
    setLoading(true);
    setError(null);
    const minS = appliedStars != null ? appliedStars - 0.1 : undefined;
    const maxS = appliedStars != null ? appliedStars + 0.1 : undefined;
    try {
      const res = await getRecommendations(playstyle, minS, maxS, status || undefined, off, randomMode);
      if (replace) setRecords(res.recommendations);
      else setRecords(prev => [...prev, ...res.recommendations]);
      setHasMore(res.has_more ?? false);
      setOffset(off + res.recommendations.length);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load recommendations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (dominant) {
      setOffset(0);
      fetchRecs(dominant.label, 0, true);
    }
  }, [dominant, appliedStars, status, randomMode]);

  async function handleHide(beatmapId: string) {
    setRecords(prev => prev.filter(r => r.beatmap_id !== beatmapId));
    await hideBeatmap(beatmapId).catch(() => {});
  }

  async function handleHideSet(beatmapsetId: string) {
    setRecords(prev => prev.filter(r => r.beatmapset_id !== beatmapsetId));
    await hideBeatmapset(beatmapsetId).catch(() => {});
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <h2 style={headingStyle}>Map Recommendations</h2>
        {dominant && (
          <button
            onClick={() => setRandomMode(m => !m)}
            title={randomMode ? "Random mode ON — click to switch to ordered" : "Ordered mode — click for random"}
            style={{
              ...refreshBtnStyle,
              color: randomMode ? "var(--pink)" : "var(--muted)",
              borderColor: randomMode ? "var(--pink)" : "var(--border)",
              background: randomMode ? "rgba(255,102,170,0.08)" : "transparent",
              display: "flex", alignItems: "center", gap: 5,
            }}
          >
            <DiceIcon active={randomMode} />
            {randomMode ? "Random" : "Ordered"}
          </button>
        )}
      </div>
      <p style={subtextStyle}>
        Based on your play history — analyze first to see personalized recommendations.
      </p>

      {/* Analyze controls */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <select value={source} onChange={e => setSource(e.target.value as "top" | "recent")}
          className="osu-select" style={{ fontSize: 12, padding: "6px 28px 6px 10px", width: "auto" }}>
          <option value="top">Top Plays</option>
          <option value="recent">Recent Plays</option>
        </select>
        <button className="btn-pink" onClick={runAnalysis}
          disabled={analysisLoading}
          style={{ fontSize: 12, padding: "7px 16px", opacity: analysisLoading ? 0.5 : 1 }}>
          {analysisLoading ? "Analyzing…" : "◈ Analyze & Recommend"}
        </button>
        {dominant && (
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            Dominant tag: <strong style={{ color: "var(--pink)" }}>{dominant.label}</strong>
            <span style={{ color: "var(--muted2)", marginLeft: 6 }}>
              ({dominant.beatmaps_analyzed} maps analyzed)
            </span>
          </span>
        )}
      </div>

      {/* Difficulty + status filters */}
      {dominant && (
        <>
          <div style={filterRowStyle}>
            <span style={filterLabelStyle}>Difficulty</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                <span>★ 0.1</span>
                <span style={{ color: "var(--pink)", fontWeight: 600 }}>
                  ★ {targetStars.toFixed(1)}
                  {appliedStars === null
                    ? <span style={{ color: "var(--muted)", fontWeight: 400, marginLeft: 5 }}>(Any)</span>
                    : appliedStars !== targetStars
                      ? <span style={{ color: "#fbbf24", fontWeight: 400, marginLeft: 5 }}>(±0.1 from ★{appliedStars.toFixed(1)})</span>
                      : <span style={{ color: "#b8e994", fontWeight: 400, marginLeft: 5 }}>(±0.1)</span>
                  }
                </span>
                <span>★ 15.0</span>
              </div>
              <input type="range" min={0.1} max={15.0} step={0.1} value={targetStars}
                onChange={e => setTargetStars(Number(e.target.value))}
                style={{ width: "100%", cursor: "pointer" }} />
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button onClick={() => setAppliedStars(targetStars)} style={applyBtnStyle}>Apply</button>
              {appliedStars != null && (
                <button onClick={() => setAppliedStars(null)} style={clearBtnStyle}>✕</button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {STATUSES.map(s => (
              <button key={s} onClick={() => setStatus(status === s ? "" : s)}
                style={statusBtnStyle(status === s, s)}>
                {s}
              </button>
            ))}
          </div>
        </>
      )}

      {/* States */}
      {analysisLoading && (
        <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
          Fetching play history and running predictions…
        </p>
      )}
      {error && <div style={errorStyle}>{error}</div>}
      {!analysisLoading && !dominant && !error && (
        <div style={emptyStyle}>
          Press "Analyze &amp; Recommend" to get personalized beatmap suggestions.
        </div>
      )}
      {loading && records.length === 0 && (
        <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
          Loading recommendations…
        </p>
      )}
      {!loading && dominant && !error && records.length === 0 && (
        <div style={emptyStyle}>
          No recommendations for "{dominant.label}" yet. Try predicting more beatmaps first.
        </div>
      )}

      {records.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {records.map((bm) => (
            <BeatmapCard
              key={bm.beatmap_id}
              record={bm}
              highlightTags={dominant ? [dominant.label] : []}
              currentUser={currentUser}
              onHide={handleHide}
              onHideSet={handleHideSet}
              onFindSimilar={setSimilarBeatmap}
            />
          ))}
        </div>
      )}

      {similarBeatmap && (
        <SimilarBeatmapPanel
          sourceBeatmap={similarBeatmap}
          currentUser={currentUser}
          onClose={() => setSimilarBeatmap(null)}
          onFindSimilar={setSimilarBeatmap}
          onHide={handleHide}
          onHideSet={handleHideSet}
        />
      )}

      {hasMore && dominant && (
        <button onClick={() => fetchRecs(dominant.label, offset, false)}
          disabled={loading} style={loadMoreStyle}>
          {loading ? "Loading…" : "↓ Load more"}
        </button>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: 12, padding: 22, marginTop: 24,
};
const headingStyle: React.CSSProperties = {
  fontFamily: "var(--font-d)", fontSize: 17, fontWeight: 800, color: "var(--text)", marginBottom: 0,
};
const subtextStyle: React.CSSProperties = {
  color: "var(--muted)", fontSize: 13, marginBottom: 16,
};
const filterRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12,
  background: "var(--card2)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "10px 14px", marginBottom: 12,
};
const filterLabelStyle: React.CSSProperties = { fontSize: 12, color: "var(--muted)", flexShrink: 0 };
const applyBtnStyle: React.CSSProperties = {
  padding: "4px 10px", borderRadius: 6, border: "none",
  background: "linear-gradient(135deg, #ff66aa, #cc3377)",
  color: "#fff", fontSize: 11, fontFamily: "var(--font-d)", fontWeight: 700, cursor: "pointer",
};
const clearBtnStyle: React.CSSProperties = {
  padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)",
  background: "transparent", color: "var(--muted)", fontSize: 11, cursor: "pointer",
};
const refreshBtnStyle: React.CSSProperties = {
  padding: "5px 12px", borderRadius: 8, border: "1px solid var(--border)",
  background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer",
};
const loadMoreStyle: React.CSSProperties = {
  display: "block", width: "100%", marginTop: 12,
  padding: "10px 0", borderRadius: 8, border: "1px solid var(--border)",
  background: "transparent", color: "var(--muted)", fontSize: 13, cursor: "pointer",
  textAlign: "center",
};
const errorStyle: React.CSSProperties = {
  padding: "10px 14px", background: "#1e0a10",
  border: "1px solid #7f1d1d", borderRadius: 8, color: "#fca5a5", fontSize: 13,
};
const emptyStyle: React.CSSProperties = {
  padding: "20px 16px", textAlign: "center", color: "var(--muted)",
  fontSize: 14, background: "var(--card2)", borderRadius: 8, border: "1px solid var(--border)",
};

function statusBtnStyle(active: boolean, s: string): React.CSSProperties {
  const c = STATUS_COLORS[s] ?? "var(--muted)";
  return {
    padding: "4px 10px", borderRadius: 20, fontSize: 11,
    cursor: "pointer", border: "1px solid",
    background: active ? `${c}22` : "transparent",
    color: active ? c : "var(--muted2)",
    borderColor: active ? c : "var(--border)",
    textTransform: "capitalize",
  };
}
