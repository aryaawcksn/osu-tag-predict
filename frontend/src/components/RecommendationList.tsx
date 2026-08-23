import { useEffect, useRef, useState } from "react";
import { BeatmapRecord } from "../types";
import { getRecommendations, hideBeatmap } from "../api";
import { BeatmapCard } from "./BeatmapCard";

interface Props {
  playstyle: string;
  avgDifficulty?: number;
}

const STATUSES = ["ranked", "loved", "approved", "qualified", "pending", "graveyard", "wip"];
const STATUS_COLORS: Record<string, string> = {
  ranked: "#b8e994", loved: "#ff6b9d", approved: "#b8e994",
  qualified: "#74b9ff", pending: "#fbbf24", graveyard: "#636e72", wip: "#fbbf24",
};

export default function RecommendationList({ playstyle, avgDifficulty }: Props) {
  const [records, setRecords] = useState<BeatmapRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetStars, setTargetStars] = useState<number>(avgDifficulty ?? 5);
  const [appliedStars, setAppliedStars] = useState<number | null>(avgDifficulty ?? null);
  const [status, setStatus] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  async function fetchRecs(off: number, replace: boolean) {
    if (!playstyle) return;
    setLoading(true);
    setError(null);
    const minS = appliedStars != null ? appliedStars - 0.5 : undefined;
    const maxS = appliedStars != null ? appliedStars + 0.5 : undefined;
    try {
      const res = await getRecommendations(playstyle, minS, maxS, status || undefined, off);
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
    setOffset(0);
    fetchRecs(0, true);
  }, [playstyle, appliedStars, status]);

  function handleRefresh() {
    const newOffset = offset;
    fetchRecs(newOffset, false);
  }

  async function handleHide(beatmapId: string) {
    setHiddenIds(prev => new Set([...prev, beatmapId]));
    setRecords(prev => prev.filter(r => r.beatmap_id !== beatmapId));
    try {
      await hideBeatmap(beatmapId);
    } catch {
      // revert on failure
      setHiddenIds(prev => { const n = new Set(prev); n.delete(beatmapId); return n; });
    }
  }

  return (
    <div style={containerStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <h2 style={headingStyle}>Map Recommendations</h2>
        <button onClick={handleRefresh} disabled={loading} style={refreshBtnStyle} title="Load next 10 maps">
          ↻ Refresh
        </button>
      </div>
      <p style={subtextStyle}>
        Maps matching your dominant playstyle:{" "}
        <strong style={{ color: "#ff6b9d" }}>{playstyle}</strong>
        <span style={{ color: "#636e72", fontSize: 11, marginLeft: 8 }}>swipe right to hide</span>
      </p>

      {/* Difficulty filter */}
      <div style={filterRowStyle}>
        <span style={filterLabelStyle}>Difficulty</span>
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
          <button onClick={() => setAppliedStars(targetStars)} style={applyBtnStyle}>Apply</button>
          {appliedStars != null && (
            <button onClick={() => setAppliedStars(null)} style={clearBtnStyle}>✕</button>
          )}
        </div>
      </div>

      {/* Status filter */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatus(status === s ? "" : s)} style={statusBtnStyle(status === s, s)}>
            {s}
          </button>
        ))}
      </div>

      {loading && records.length === 0 && (
        <p style={{ color: "#a7a9be", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
          Loading recommendations…
        </p>
      )}
      {error && <div style={errorStyle}>{error}</div>}
      {!loading && !error && records.length === 0 && (
        <div style={emptyStyle}>
          No recommendations for "{playstyle}" yet. Try predicting more beatmaps first.
        </div>
      )}

      {records.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {records.map((bm) => (
            <SwipeableCard key={bm.beatmap_id} record={bm} onHide={handleHide} />
          ))}
        </div>
      )}

      {hasMore && (
        <button onClick={() => fetchRecs(offset, false)} disabled={loading} style={loadMoreStyle}>
          {loading ? "Loading…" : "↓ Load more"}
        </button>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------- //
// Swipeable card wrapper                                                       //
// -------------------------------------------------------------------------- //

function SwipeableCard({ record, onHide }: { record: BeatmapRecord; onHide: (id: string) => void }) {
  const [translateX, setTranslateX] = useState(0);
  const [hiding, setHiding] = useState(false);
  const startX = useRef<number | null>(null);
  const isDragging = useRef(false);

  const THRESHOLD = 80; // px to trigger hide

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    isDragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!isDragging.current || startX.current == null) return;
    const delta = e.clientX - startX.current;
    if (delta > 0) setTranslateX(delta); // only right swipe
  }

  function onPointerUp() {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (translateX >= THRESHOLD) {
      setHiding(true);
      setTimeout(() => onHide(record.beatmap_id), 300);
    } else {
      setTranslateX(0);
    }
    startX.current = null;
  }

  const opacity = hiding ? 0 : Math.max(0, 1 - translateX / 200);
  const showHideLabel = translateX > 20;

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 10 }}>
      {/* Hide indicator behind card */}
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center",
        paddingLeft: 20, background: "rgba(255,107,157,0.15)",
        borderRadius: 10, border: "1px solid rgba(255,107,157,0.3)",
        opacity: showHideLabel ? 1 : 0, transition: "opacity 0.1s",
      }}>
        <span style={{ fontSize: 12, color: "#ff6b9d", fontWeight: 600 }}>👋 Hide</span>
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translateX(${translateX}px)`,
          opacity,
          transition: hiding ? "transform 0.3s ease, opacity 0.3s ease" : isDragging.current ? "none" : "transform 0.2s ease",
          cursor: "grab",
          userSelect: "none",
        }}
      >
        <BeatmapCard record={record} />
      </div>
    </div>
  );
}

// Styles
const containerStyle: React.CSSProperties = {
  background: "#1a1929", border: "1px solid #2e2d3d",
  borderRadius: 12, padding: 24, marginTop: 24,
};
const headingStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, color: "#fffffe", marginBottom: 0,
};
const subtextStyle: React.CSSProperties = {
  color: "#a7a9be", fontSize: 13, marginBottom: 16,
};
const filterRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12,
  background: "#0f0e17", border: "1px solid #2e2d3d",
  borderRadius: 8, padding: "10px 14px", marginBottom: 12,
};
const filterLabelStyle: React.CSSProperties = {
  fontSize: 12, color: "#a7a9be", flexShrink: 0,
};
const applyBtnStyle: React.CSSProperties = {
  padding: "4px 10px", borderRadius: 6, border: "none",
  background: "#ff6b9d", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer",
};
const clearBtnStyle: React.CSSProperties = {
  padding: "4px 8px", borderRadius: 6, border: "1px solid #2e2d3d",
  background: "transparent", color: "#a7a9be", fontSize: 11, cursor: "pointer",
};
const refreshBtnStyle: React.CSSProperties = {
  padding: "5px 12px", borderRadius: 6, border: "1px solid #2e2d3d",
  background: "transparent", color: "#a7a9be", fontSize: 12, cursor: "pointer",
};
const loadMoreStyle: React.CSSProperties = {
  display: "block", width: "100%", marginTop: 12,
  padding: "10px 0", borderRadius: 8, border: "1px solid #2e2d3d",
  background: "transparent", color: "#a7a9be", fontSize: 13, cursor: "pointer",
  textAlign: "center",
};
const errorStyle: React.CSSProperties = {
  padding: "10px 14px", background: "#2a0a14",
  border: "1px solid #7f1d1d", borderRadius: 8, color: "#fca5a5", fontSize: 13,
};
const emptyStyle: React.CSSProperties = {
  padding: "20px 16px", textAlign: "center", color: "#a7a9be",
  fontSize: 14, background: "#0f0e17", borderRadius: 8, border: "1px solid #2e2d3d",
};

function statusBtnStyle(active: boolean, s: string): React.CSSProperties {
  const c = STATUS_COLORS[s] ?? "#a7a9be";
  return {
    padding: "4px 10px", borderRadius: 20, fontSize: 11,
    cursor: "pointer", border: "1px solid",
    background: active ? `${c}22` : "transparent",
    color: active ? c : "#636e72",
    borderColor: active ? c : "#2e2d3d",
    textTransform: "capitalize",
  };
}
