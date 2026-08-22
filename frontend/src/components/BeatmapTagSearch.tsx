import { useState } from "react";
import { BeatmapRecord } from "../types";
import { getBeatmapsByTags } from "../api";
import { BeatmapCard } from "./BeatmapCard";

// All 57 known playstyle tags
const ALL_TAGS = [
  "aim/flow", "aim/precise", "aim/wide-angle", "aim/cut-stream", "aim/high-bpm",
  "aim/slider-aim", "aim/technical", "aim/reading",
  "skillset/jumps", "skillset/streams", "skillset/alt", "skillset/finger-control",
  "skillset/stamina", "skillset/burst", "skillset/speed", "skillset/tech",
  "pattern/stack", "pattern/overlap", "pattern/cross", "pattern/zigzag",
  "pattern/square", "pattern/back-and-forth", "pattern/spiral", "pattern/linear",
  "pattern/deathstream", "pattern/triplet", "pattern/quintuplet",
  "expression/simple", "expression/complex", "expression/difficulty spike",
  "expression/gimmick", "expression/SV", "expression/weird",
  "jumps/sharp", "jumps/wide", "jumps/spaced", "jumps/flow",
  "streams/burst", "streams/deathstream", "streams/speed", "streams/stamina",
  "streams/alt", "streams/finger-control",
  "reading/hidden", "reading/HD", "reading/DT", "reading/overlap",
  "reading/high-density", "reading/memorization",
  "misc/low-AR", "misc/high-AR", "misc/low-OD", "misc/high-OD",
  "misc/one-handed", "misc/nomod", "misc/FC-friendly",
].sort();

const INITIAL_SHOW = 24;

interface Props {
  requireAuth?: boolean;
}

export default function BeatmapTagSearch({ requireAuth }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [minStars, setMinStars] = useState(0);
  const [maxStars, setMaxStars] = useState(10);
  const [results, setResults] = useState<BeatmapRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    try {
      const res = await getBeatmapsByTags(
        Array.from(selected),
        minStars > 0 ? minStars : undefined,
        maxStars < 10 ? maxStars : undefined,
      );
      setResults(res.beatmaps);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setSelected(new Set());
    setResults(null);
    setError(null);
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

      {/* Difficulty slider */}
      <div style={filterRowStyle}>
        <span style={{ fontSize: 12, color: "#a7a9be", flexShrink: 0 }}>Difficulty</span>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#a7a9be" }}>
            <span>★ {minStars.toFixed(1)}</span>
            <span>★ {maxStars.toFixed(1)}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="range" min={0} max={10} step={0.5} value={minStars}
              onChange={e => setMinStars(Math.min(Number(e.target.value), maxStars - 0.5))}
              style={{ flex: 1, accentColor: "#ff6b9d" }} />
            <input type="range" min={0} max={10} step={0.5} value={maxStars}
              onChange={e => setMaxStars(Math.max(Number(e.target.value), minStars + 0.5))}
              style={{ flex: 1, accentColor: "#ff6b9d" }} />
          </div>
        </div>
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
                {results.map(bm => <BeatmapCard key={bm.beatmap_id} record={bm} />)}
              </div>
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
