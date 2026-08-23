import { useState } from "react";
import { BeatmapRecord } from "../types";
import { getBeatmapsByTags } from "../api";
import { BeatmapCard } from "./BeatmapCard";

// All tags from pickle model — exact names
const ALL_TAGS = [
  "skillset/jumps", "jumps/sharp", "expression/simple", "skillset/alt",
  "tech/aim control", "expression/difficulty spike", "style/clean",
  "expression/repetition", "jumps/back and forth", "jumps/wide",
  "jumps/stamina", "streams/speed", "jumps/cross-screen", "jumps/triangles",
  "skillset/reading", "streams/flow aim", "expression/chaotic",
  "expression/progression", "tech/finger control", "jumps/linear",
  "jumps/freeform", "skillset/tech", "reading/overlaps", "style/messy",
  "streams/doubles", "streams/bursts", "meta/variable timing",
  "reading/visually dense", "skillset/precision", "expression/high contrast",
  "meta/swing", "tech/slider tech", "sliders/complex sv", "style/freeform",
  "style/geometric", "reading/perfect stacks", "style/hexgrid",
  "sliders/high sv", "sliders/complex slidershapes", "streams/stamina",
  "meta/accelerating bpm", "expression/playfield usage", "jumps/squares",
  "sliders/low sv", "style/symmetrical", "meta/time signatures",
  "style/avant-garde", "expression/conceptual", "gimmick/ninja spinners",
  "style/grid snap", "skillset/streams", "style/distance snap",
  "expression/old-style revival", "streams/cutstreams", "gimmick/circle only",
  "streams/spaced streams", "expression/iNiS-style",
].sort();

const INITIAL_SHOW = 24;

const STATUS_COLORS: Record<string, string> = {
  ranked: "#b8e994", loved: "#ff6b9d", approved: "#b8e994",
  qualified: "#74b9ff", pending: "#fbbf24", graveyard: "#636e72", wip: "#fbbf24",
};

interface Props {
  requireAuth?: boolean;
}

export default function BeatmapTagSearch({ requireAuth }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [targetStars, setTargetStars] = useState(5);
  const [appliedStars, setAppliedStars] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("");
  const [results, setResults] = useState<BeatmapRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [activeSearch, setActiveSearch] = useState<{ tags: string[]; minStars?: number; maxStars?: number } | null>(null);

  const visibleTags = showAll ? ALL_TAGS : ALL_TAGS.slice(0, INITIAL_SHOW);

  function toggleTag(tag: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }

  async function handleSearch() {
    if (selected.size === 0) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setOffset(0);
    const minS = appliedStars != null ? appliedStars - 0.5 : undefined;
    const maxS = appliedStars != null ? appliedStars + 0.5 : undefined;
    const searchParams = { tags: Array.from(selected), minStars: minS, maxStars: maxS };
    setActiveSearch(searchParams);
    try {
      const res = await getBeatmapsByTags(searchParams.tags, minS, maxS, 0, status || undefined);
      setResults(res.beatmaps);
      setHasMore(res.has_more);
      setOffset(res.beatmaps.length);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadMore() {
    if (!activeSearch) return;
    setLoadingMore(true);
    try {
      const res = await getBeatmapsByTags(activeSearch.tags, activeSearch.minStars, activeSearch.maxStars, offset, status || undefined);
      setResults(prev => [...(prev ?? []), ...res.beatmaps]);
      setHasMore(res.has_more);
      setOffset(prev => prev + res.beatmaps.length);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Load more failed");
    } finally {
      setLoadingMore(false);
    }
  }

  function handleClear() {
    setSelected(new Set());
    setResults(null);
    setError(null);
    setHasMore(false);
    setOffset(0);
    setActiveSearch(null);
  }

  return (
    <div style={containerStyle}>
      <h2 style={headingStyle}>Find Beatmaps by Tags</h2>
      <p style={subtextStyle}>
        Select one or more playstyle tags to find matching beatmaps from the database.
      </p>

      {/* Tag grid */}
      <div style={tagGridStyle}>
        {visibleTags.map(tag => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            style={tagBtnStyle(selected.has(tag))}
          >
            {tag}
          </button>
        ))}
      </div>

      {ALL_TAGS.length > INITIAL_SHOW && (
        <button onClick={() => setShowAll(v => !v)} style={showMoreStyle}>
          {showAll ? "Show less ▲" : `Show ${ALL_TAGS.length - INITIAL_SHOW} more ▼`}
        </button>
      )}

      {/* Selected chips */}
      {selected.size > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "12px 0 0" }}>
          {Array.from(selected).map(tag => (
            <span key={tag} style={selectedChipStyle} onClick={() => toggleTag(tag)}>
              {tag} ✕
            </span>
          ))}
        </div>
      )}

      {/* Difficulty slider — single target value */}
      <div style={filterRowStyle}>
        <span style={{ fontSize: 12, color: "#a7a9be", flexShrink: 0 }}>Difficulty</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#a7a9be", marginBottom: 4 }}>
            <span>★ 1</span>
            <span style={{ color: "#ff6b9d", fontWeight: 600 }}>
              {appliedStars != null ? `★ ${appliedStars.toFixed(1)}` : "Any"}
            </span>
            <span>★ 10</span>
          </div>
          <input type="range" min={1} max={10} step={0.5} value={targetStars}
            onChange={e => setTargetStars(Number(e.target.value))}
            style={{ width: "100%", accentColor: "#ff6b9d", cursor: "pointer" }} />
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={() => setAppliedStars(targetStars)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#ff6b9d", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            Apply
          </button>
          {appliedStars != null && (
            <button onClick={() => setAppliedStars(null)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #2e2d3d", background: "transparent", color: "#a7a9be", fontSize: 11, cursor: "pointer" }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Status filter */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        {["ranked", "loved", "approved", "qualified", "pending", "graveyard", "wip"].map(s => (
          <button key={s} onClick={() => setStatus(status === s ? "" : s)}
            style={{
              padding: "4px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer",
              border: "1px solid", textTransform: "capitalize" as const,
              background: status === s ? `${STATUS_COLORS[s]}22` : "transparent",
              color: status === s ? STATUS_COLORS[s] : "#636e72",
              borderColor: status === s ? STATUS_COLORS[s] : "#2e2d3d",
            }}
          >{s}</button>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          onClick={handleSearch}
          disabled={selected.size === 0 || loading}
          style={{
            ...doneBtnStyle,
            opacity: selected.size === 0 || loading ? 0.5 : 1,
            cursor: selected.size === 0 || loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Searching…" : `Search (${selected.size} tag${selected.size !== 1 ? "s" : ""})`}
        </button>
        {(selected.size > 0 || results !== null) && (
          <button onClick={handleClear} style={clearBtnStyle}>Clear</button>
        )}
      </div>

      {/* Results */}
      {error && <div style={errorStyle}>{error}</div>}

      {results !== null && !loading && (
        <div style={{ marginTop: 16 }}>
          {results.length === 0 ? (
            <div style={emptyStyle}>
              No beatmaps found matching all selected tags. Try fewer tags or a wider difficulty range.
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12, color: "#a7a9be", marginBottom: 10 }}>
                {results.length} beatmap{results.length !== 1 ? "s" : ""} found
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {results.map(bm => (
                  <BeatmapCard key={bm.beatmap_id} record={bm} highlightTags={Array.from(selected)} />
                ))}
              </div>
              {hasMore && (
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  style={loadMoreStyle}
                >
                  {loadingMore ? "Loading…" : "↓ Load more"}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Styles
const containerStyle: React.CSSProperties = {
  background: "#1a1929", border: "1px solid #2e2d3d",
  borderRadius: 12, padding: 24, marginTop: 24,
};
const headingStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, color: "#fffffe", marginBottom: 6,
};
const subtextStyle: React.CSSProperties = {
  color: "#a7a9be", fontSize: 13, marginBottom: 14,
};
const tagGridStyle: React.CSSProperties = {
  display: "flex", flexWrap: "wrap", gap: 7,
};
function tagBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: "5px 11px", borderRadius: 6, fontSize: 11, fontWeight: 500,
    cursor: "pointer", border: "1px solid",
    background: active ? "rgba(255,107,157,0.18)" : "rgba(0,0,0,0.25)",
    color: active ? "#ff6b9d" : "#a7a9be",
    borderColor: active ? "rgba(255,107,157,0.6)" : "#2e2d3d",
    transition: "all 0.1s ease",
  };
}
const showMoreStyle: React.CSSProperties = {
  marginTop: 10, padding: "4px 12px", borderRadius: 6,
  background: "transparent", border: "1px solid #2e2d3d",
  color: "#a7a9be", fontSize: 11, cursor: "pointer",
};
const selectedChipStyle: React.CSSProperties = {
  padding: "3px 10px", borderRadius: 20, fontSize: 11,
  background: "rgba(255,107,157,0.2)", border: "1px solid rgba(255,107,157,0.5)",
  color: "#ff6b9d", cursor: "pointer",
};
const filterRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12,
  background: "#0f0e17", border: "1px solid #2e2d3d",
  borderRadius: 8, padding: "10px 14px", marginTop: 14,
};
const doneBtnStyle: React.CSSProperties = {
  flex: 1, padding: "8px 0", borderRadius: 7, border: "none",
  background: "#ff6b9d", color: "#fff", fontSize: 13, fontWeight: 600,
};
const clearBtnStyle: React.CSSProperties = {
  padding: "8px 16px", borderRadius: 7, border: "1px solid #2e2d3d",
  background: "transparent", color: "#a7a9be", fontSize: 13, cursor: "pointer",
};
const errorStyle: React.CSSProperties = {
  marginTop: 12, padding: "10px 14px", background: "#2a0a14",
  border: "1px solid #7f1d1d", borderRadius: 8, color: "#fca5a5", fontSize: 13,
};
const emptyStyle: React.CSSProperties = {
  padding: "20px 16px", textAlign: "center", color: "#a7a9be",
  fontSize: 14, background: "#0f0e17", borderRadius: 8, border: "1px solid #2e2d3d",
};
const loadMoreStyle: React.CSSProperties = {
  display: "block", width: "100%", marginTop: 12,
  padding: "10px 0", borderRadius: 8,
  border: "1px solid #2e2d3d", background: "transparent",
  color: "#a7a9be", fontSize: 13, cursor: "pointer",
  textAlign: "center",
};
