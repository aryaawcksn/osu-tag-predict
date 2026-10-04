import { useState } from "react";
import { BeatmapRecord, CurrentUser, DominantPlaystyle } from "../types";
import { getBeatmapsByTags, getPlaystyleAnalysis } from "../api";
import { BeatmapCard } from "./BeatmapCard";
import { ALL_TAGS } from "../constants";
import SimilarBeatmapPanel from "./SimilarBeatmapPanel";
import RangeSlider from "./RangeSlider";

const INITIAL_SHOW = 24;
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2007 + 1 }, (_, i) => CURRENT_YEAR - i);

const STATUS_COLORS: Record<string, string> = {
  ranked: "#b8e994", loved: "#ff6b9d", approved: "#b8e994",
  qualified: "#74b9ff", pending: "#fbbf24", graveyard: "#636e72", wip: "#fbbf24",
};

interface Props {
  currentUser?: CurrentUser | null;
}

export default function BeatmapTagSearch({ currentUser }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [starMin, setStarMin] = useState(0.1);
  const [starMax, setStarMax] = useState(15.0);
  const [appliedRange, setAppliedRange] = useState<[number, number] | null>(null);
  const [status, setStatus] = useState<string>("");
  const [yearFrom, setYearFrom] = useState<number | null>(null);
  const [yearTo, setYearTo] = useState<number | null>(null);
  const [results, setResults] = useState<BeatmapRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [similarBeatmap, setSimilarBeatmap] = useState<BeatmapRecord | null>(null);
  const [activeSearch, setActiveSearch] = useState<{
    tags: string[]; minStars?: number; maxStars?: number;
    yearFrom?: number; yearTo?: number;
  } | null>(null);

  // Auto-detect state
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeSource, setAnalyzeSource] = useState<"top" | "recent">("top");
  const [distribution, setDistribution] = useState<DominantPlaystyle["distribution"] | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const visibleTags = showAll ? ALL_TAGS : ALL_TAGS.slice(0, INITIAL_SHOW);

  function toggleTag(tag: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }

  async function handleAutoDetect() {
    setAnalyzing(true);
    setAnalyzeError(null);
    setDistribution(null);
    try {
      const result = await getPlaystyleAnalysis(analyzeSource);
      setDistribution(result.distribution);
      // Pre-select top tag and set difficulty from play history
      if (result.distribution.length > 0) {
        setSelected(new Set([result.distribution[0].label]));
      }
      if (result.avg_difficulty != null) {
        const avg = result.avg_difficulty;
        setStarMin(Math.max(0.1, Math.round((avg - 0.5) * 10) / 10));
        setStarMax(Math.min(15.0, Math.round((avg + 0.5) * 10) / 10));
        setAppliedRange([
          Math.max(0.1, Math.round((avg - 0.5) * 10) / 10),
          Math.min(15.0, Math.round((avg + 0.5) * 10) / 10),
        ]);
      }
    } catch (err: unknown) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSearch() {
    if (selected.size === 0) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setOffset(0);
    const minS = appliedRange != null ? appliedRange[0] : undefined;
    const maxS = appliedRange != null ? appliedRange[1] : undefined;
    const searchParams = {
      tags: Array.from(selected), minStars: minS, maxStars: maxS,
      yearFrom: yearFrom ?? undefined, yearTo: yearTo ?? undefined,
    };
    setActiveSearch(searchParams);
    try {
      const res = await getBeatmapsByTags(
        searchParams.tags, minS, maxS, 0, status || undefined,
        searchParams.yearFrom, searchParams.yearTo,
      );
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
      const res = await getBeatmapsByTags(
        activeSearch.tags, activeSearch.minStars, activeSearch.maxStars,
        offset, status || undefined, activeSearch.yearFrom, activeSearch.yearTo,
      );
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
    setYearFrom(null);
    setYearTo(null);
    setAppliedRange(null);
    setStarMin(0.1);
    setStarMax(15.0);
    setDistribution(null);
  }

  // Top tags from distribution to show as suggestion chips (top 8, skip already selected)
  const topSuggestions = distribution
    ? distribution.slice(0, 8)
    : null;

  return (
    <div style={containerStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={headingStyle}>Find Beatmaps by Tags</h2>
          <p style={subtextStyle}>Select tags manually or auto-detect from your play history.</p>
        </div>

        {/* Auto-detect controls */}
        {currentUser && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <select
              value={analyzeSource}
              onChange={e => setAnalyzeSource(e.target.value as "top" | "recent")}
              className="osu-select"
              style={{ fontSize: 11, padding: "5px 24px 5px 8px", width: "auto" }}
            >
              <option value="top">Top plays</option>
              <option value="recent">Recent plays</option>
            </select>
            <button
              onClick={handleAutoDetect}
              disabled={analyzing}
              style={{
                padding: "6px 12px", borderRadius: 8, border: "none",
                background: "linear-gradient(135deg, var(--pink), var(--pink-dim))",
                color: "#fff", fontSize: 11, fontFamily: "var(--font-d)", fontWeight: 700,
                cursor: analyzing ? "not-allowed" : "pointer",
                opacity: analyzing ? 0.6 : 1, whiteSpace: "nowrap",
              }}
            >
              {analyzing ? "Analyzing…" : "◈ Auto-detect"}
            </button>
          </div>
        )}
      </div>

      {analyzeError && (
        <div style={{ ...errorStyle, marginBottom: 12 }}>{analyzeError}</div>
      )}

      {/* Distribution suggestions */}
      {topSuggestions && (
        <div style={{
          background: "var(--card2)", border: "1px solid var(--border)",
          borderRadius: 10, padding: "12px 14px", marginBottom: 14,
        }}>
          <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-m)", letterSpacing: "0.06em", marginBottom: 10 }}>
            YOUR PLAYSTYLE — click to toggle tags
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {topSuggestions.map(d => {
              const isOn = selected.has(d.label);
              const pct = Math.round(d.average_probability * 100);
              const maxProb = topSuggestions[0]?.average_probability ?? 1;
              return (
                <div key={d.label} onClick={() => toggleTag(d.label)} style={{ cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{
                      fontFamily: "var(--font-m)", fontSize: 11,
                      color: isOn ? "var(--pink)" : "var(--muted)",
                      fontWeight: isOn ? 700 : 400,
                    }}>
                      {isOn ? "✓ " : ""}{d.label}
                    </span>
                    <span style={{ fontFamily: "var(--font-m)", fontSize: 10, color: isOn ? "var(--pink)" : "var(--muted2)" }}>
                      {pct}%
                    </span>
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      width: `${(d.average_probability / maxProb) * 100}%`,
                      height: "100%", borderRadius: 2,
                      background: isOn
                        ? `linear-gradient(90deg, var(--pink), var(--pink-dim))`
                        : "rgba(255,255,255,0.15)",
                      transition: "all 0.2s ease",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Combination presets */}
          {topSuggestions.length >= 2 && (
            <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
              <div style={{ fontSize: 10, color: "var(--muted2)", fontFamily: "var(--font-m)", marginBottom: 7 }}>
                QUICK COMBINATIONS
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {/* Top 1 alone */}
                {[
                  [topSuggestions[0]?.label],
                  topSuggestions.slice(0, 2).map(d => d.label),
                  topSuggestions.slice(0, 3).map(d => d.label),
                ].filter(combo => combo.every(Boolean)).map((combo, i) => {
                  const active = combo.length === selected.size && combo.every(t => selected.has(t));
                  return (
                    <button key={i}
                      onClick={e => { e.stopPropagation(); setSelected(new Set(combo)); }}
                      style={{
                        padding: "3px 9px", borderRadius: 20, fontSize: 10,
                        fontFamily: "var(--font-m)", cursor: "pointer",
                        border: `1px solid ${active ? "var(--pink)" : "var(--border)"}`,
                        background: active ? "rgba(255,102,170,0.14)" : "transparent",
                        color: active ? "var(--pink)" : "var(--muted2)",
                        transition: "all 0.12s",
                      }}>
                      {combo.join(" + ")}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual tag grid */}
      <div style={tagGridStyle}>
        {visibleTags.map(tag => (
          <button key={tag} onClick={() => toggleTag(tag)} style={tagBtnStyle(selected.has(tag))}>
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
          {Array.from(selected).map(tag => {
            const isSimilarTag = similarBeatmap?.labels.some(l => l.label === tag);
            return (
              <span key={tag} style={selectedChipStyle(isSimilarTag)} onClick={() => toggleTag(tag)}>
                {tag} ✕
              </span>
            );
          })}
        </div>
      )}

      {/* Difficulty range slider */}
      <div style={filterRowStyle}>
        <span style={{ fontSize: 12, color: "var(--muted)", flexShrink: 0 }}>Difficulty</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: "var(--muted2)", textAlign: "center", marginBottom: 2 }}>
            {appliedRange
              ? `★${appliedRange[0].toFixed(1)} – ★${appliedRange[1].toFixed(1)} applied`
              : "Any difficulty"}
          </div>
          <RangeSlider
            min={0.1} max={15.0} step={0.1}
            valueMin={starMin} valueMax={starMax}
            onChange={(lo, hi) => { setStarMin(lo); setStarMax(hi); }}
          />
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={() => setAppliedRange([starMin, starMax])} style={applyBtnStyle}>Apply</button>
          {appliedRange != null && (
            <button onClick={() => { setAppliedRange(null); setStarMin(0.1); setStarMax(15.0); }} style={clearSmallBtnStyle}>✕</button>
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
              color: status === s ? STATUS_COLORS[s] : "var(--muted2)",
              borderColor: status === s ? STATUS_COLORS[s] : "var(--border)",
            }}
          >{s}</button>
        ))}
      </div>

      {/* Year range filter */}
      <div style={{ ...filterRowStyle, marginTop: 10, gap: 10 }}>
        <span style={{ fontSize: 12, color: "var(--muted)", flexShrink: 0 }}>Year</span>
        <select value={yearFrom ?? ""} onChange={e => setYearFrom(e.target.value ? Number(e.target.value) : null)} style={yearSelectStyle}>
          <option value="">From</option>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span style={{ color: "var(--muted2)", fontSize: 12 }}>–</span>
        <select value={yearTo ?? ""} onChange={e => setYearTo(e.target.value ? Number(e.target.value) : null)} style={yearSelectStyle}>
          <option value="">To</option>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {(yearFrom != null || yearTo != null) && (
          <button onClick={() => { setYearFrom(null); setYearTo(null); }} style={clearSmallBtnStyle}>✕</button>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          onClick={handleSearch}
          disabled={selected.size === 0 || loading}
          style={{ ...doneBtnStyle, opacity: selected.size === 0 || loading ? 0.5 : 1, cursor: selected.size === 0 || loading ? "not-allowed" : "pointer" }}
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
              <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
                {results.length} beatmap{results.length !== 1 ? "s" : ""} found
                <span style={{ color: "var(--muted2)", fontSize: 11, marginLeft: 8 }}>right-click a card to hide or find similar</span>
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                {results.map(bm => (
                  <BeatmapCard
                    key={bm.beatmap_id}
                    record={bm}
                    highlightTags={Array.from(selected)}
                    currentUser={currentUser}
                    onFindSimilar={bm => setSimilarBeatmap(bm)}
                  />
                ))}
              </div>
              {hasMore && (
                <button onClick={handleLoadMore} disabled={loadingMore} style={loadMoreStyle}>
                  {loadingMore ? "Loading…" : "↓ Load more"}
                </button>
              )}
              {similarBeatmap && (
                <SimilarBeatmapPanel
                  sourceBeatmap={similarBeatmap}
                  currentUser={currentUser}
                  onClose={() => setSimilarBeatmap(null)}
                  onFindSimilar={setSimilarBeatmap}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: 12, padding: 22, marginTop: 24,
};
const headingStyle: React.CSSProperties = {
  fontFamily: "var(--font-d)", fontSize: 17, fontWeight: 800, color: "var(--text)", marginBottom: 2,
};
const subtextStyle: React.CSSProperties = {
  color: "var(--muted)", fontSize: 13,
};
const tagGridStyle: React.CSSProperties = {
  display: "flex", flexWrap: "wrap", gap: 6,
};
function tagBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500,
    cursor: "pointer", border: "1px solid",
    background: active ? "rgba(255,102,170,0.14)" : "rgba(255,255,255,0.03)",
    color: active ? "var(--pink)" : "var(--muted)",
    borderColor: active ? "var(--pink)" : "rgba(180,130,220,0.25)",
    fontFamily: "var(--font-m)", transition: "all 0.1s ease",
  };
}
const showMoreStyle: React.CSSProperties = {
  marginTop: 10, padding: "4px 12px", borderRadius: 6,
  background: "transparent", border: "1px solid var(--border)",
  color: "var(--muted)", fontSize: 11, cursor: "pointer",
};
function selectedChipStyle(relevant = false): React.CSSProperties {
  return {
    padding: "3px 10px", borderRadius: 20, fontSize: 11, fontFamily: "var(--font-m)",
    background: relevant ? "rgba(255,102,170,0.3)" : "rgba(255,102,170,0.14)",
    border: relevant ? "1px solid var(--pink)" : "1px solid rgba(255,102,170,0.5)",
    color: "var(--pink)", cursor: "pointer", fontWeight: relevant ? 700 : 400,
  };
}
const filterRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12,
  background: "var(--card2)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "10px 14px", marginTop: 14,
};
const applyBtnStyle: React.CSSProperties = {
  padding: "4px 10px", borderRadius: 6, border: "none",
  background: "linear-gradient(135deg, var(--pink), var(--pink-dim))",
  color: "#fff", fontSize: 11, fontFamily: "var(--font-d)", fontWeight: 700, cursor: "pointer",
};
const clearSmallBtnStyle: React.CSSProperties = {
  padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)",
  background: "transparent", color: "var(--muted)", fontSize: 11, cursor: "pointer",
};
const doneBtnStyle: React.CSSProperties = {
  flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
  background: "linear-gradient(135deg, var(--pink), var(--pink-dim))",
  color: "#fff", fontSize: 13, fontFamily: "var(--font-d)", fontWeight: 700,
};
const clearBtnStyle: React.CSSProperties = {
  padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)",
  background: "transparent", color: "var(--muted)", fontSize: 13, cursor: "pointer",
};
const errorStyle: React.CSSProperties = {
  marginTop: 12, padding: "10px 14px", background: "#1e0a10",
  border: "1px solid #7f1d1d", borderRadius: 8, color: "#fca5a5", fontSize: 13,
};
const emptyStyle: React.CSSProperties = {
  padding: "20px 16px", textAlign: "center", color: "var(--muted)",
  fontSize: 14, background: "var(--card2)", borderRadius: 8, border: "1px solid var(--border)",
};
const loadMoreStyle: React.CSSProperties = {
  display: "block", width: "100%", marginTop: 12, padding: "10px 0", borderRadius: 8,
  border: "1px solid var(--border)", background: "transparent",
  color: "var(--muted)", fontSize: 13, cursor: "pointer", textAlign: "center",
};
const yearSelectStyle: React.CSSProperties = {
  padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)",
  background: "var(--card2)", color: "var(--muted)", fontSize: 12, cursor: "pointer",
};
