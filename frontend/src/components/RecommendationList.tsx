import { useEffect, useState } from "react";
import { BeatmapRecord } from "../types";
import { getRecommendations, hideBeatmap, hideBeatmapset } from "../api";
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

interface SetGroup {
  setId: string | null;
  records: BeatmapRecord[]; // sorted by difficulty_rating desc
}

function getPlaystyleProb(record: BeatmapRecord, playstyle: string): number {
  return record.labels.find(l => l.label === playstyle)?.probability ?? 0;
}

function groupBySet(records: BeatmapRecord[], playstyle: string): SetGroup[] {
  const setMap = new Map<string, BeatmapRecord[]>();
  const noSet: BeatmapRecord[] = [];
  for (const r of records) {
    if (r.beatmapset_id) {
      if (!setMap.has(r.beatmapset_id)) setMap.set(r.beatmapset_id, []);
      setMap.get(r.beatmapset_id)!.push(r);
    } else {
      noSet.push(r);
    }
  }
  const groups: SetGroup[] = [];
  for (const [setId, recs] of setMap.entries()) {
    // Sort by playstyle prediction probability — highest first = representative
    const sorted = [...recs].sort(
      (a, b) => getPlaystyleProb(b, playstyle) - getPlaystyleProb(a, playstyle)
    );
    groups.push({ setId, records: sorted });
  }
  for (const r of noSet) {
    groups.push({ setId: null, records: [r] });
  }
  return groups;
}

function SetGroupCard({
  group, playstyle, onHide, onHideSet,
}: {
  group: SetGroup;
  playstyle: string;
  onHide: (id: string) => void;
  onHideSet: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // Representative = highest difficulty (first after sort)
  const representative = group.records[0];
  const hasMultiple = group.records.length > 1;
  const extraCount = group.records.length - 1;

  return (
    <div>
      {/* In group mode: only show "Hide this beatmapset" in context menu */}
      <BeatmapCard
        record={representative}
        highlightTags={[playstyle]}
        onHideSet={group.setId ? onHideSet : undefined}
        hideMode="set-only"
      />
      {hasMultiple && (
        <button onClick={() => setExpanded(v => !v)} style={expandBtnStyle}>
          {expanded
            ? `▲ Hide ${extraCount} diff${extraCount !== 1 ? "s" : ""}`
            : `▼ ${extraCount} more diff${extraCount !== 1 ? "s" : ""} in this set`}
        </button>
      )}
      {expanded && hasMultiple && (
        <div style={expandedListStyle}>
          {group.records.slice(1).map(r => (
            <BeatmapCard
              key={r.beatmap_id}
              record={r}
              highlightTags={[playstyle]}
              onHide={onHide}
              onHideSet={group.setId ? onHideSet : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function RecommendationList({ playstyle, avgDifficulty }: Props) {
  const [records, setRecords] = useState<BeatmapRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetStars, setTargetStars] = useState<number>(avgDifficulty ?? 5);
  const [appliedStars, setAppliedStars] = useState<number | null>(avgDifficulty ?? null);
  const [status, setStatus] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [groupMode, setGroupMode] = useState(false);

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

  async function handleHide(beatmapId: string) {
    setRecords(prev => prev.filter(r => r.beatmap_id !== beatmapId));
    await hideBeatmap(beatmapId).catch(() => {});
  }

  async function handleHideSet(beatmapsetId: string) {
    setRecords(prev => prev.filter(r => r.beatmapset_id !== beatmapsetId));
    await hideBeatmapset(beatmapsetId).catch(() => {});
  }

  const groups = groupMode ? groupBySet(records, playstyle) : null;

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <h2 style={headingStyle}>Map Recommendations</h2>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {/* Group toggle */}
          <button onClick={() => setGroupMode(false)} style={viewBtnStyle(!groupMode)}>Flat</button>
          <button onClick={() => setGroupMode(true)} style={viewBtnStyle(groupMode)}>Group by set</button>
          <button onClick={() => fetchRecs(offset, false)} disabled={loading} style={refreshBtnStyle}>
            ↻ More
          </button>
        </div>
      </div>
      <p style={subtextStyle}>
        Matching <strong style={{ color: "#ff6b9d" }}>{playstyle}</strong>
        <span style={{ color: "#636e72", fontSize: 11, marginLeft: 8 }}>right-click to hide</span>
      </p>

      {/* Difficulty filter */}
      <div style={filterRowStyle}>
        <span style={filterLabelStyle}>★</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#a7a9be", marginBottom: 3 }}>
            <span>1</span>
            <span style={{ color: "#ff6b9d", fontWeight: 600 }}>
              {appliedStars != null ? appliedStars.toFixed(1) : "Any"}
            </span>
            <span>10</span>
          </div>
          <input type="range" min={1} max={10} step={0.5} value={targetStars}
            onChange={e => setTargetStars(Number(e.target.value))}
            style={{ width: "100%", accentColor: "#ff6b9d", cursor: "pointer" }} />
        </div>
        <button onClick={() => setAppliedStars(targetStars)} style={applyBtnStyle}>Apply</button>
        {appliedStars != null && (
          <button onClick={() => setAppliedStars(null)} style={clearBtnStyle}>✕</button>
        )}
      </div>

      {/* Status filter */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatus(status === s ? "" : s)} style={statusBtnStyle(status === s, s)}>
            {s}
          </button>
        ))}
      </div>

      {/* List */}
      {loading && records.length === 0 && (
        <p style={{ color: "#a7a9be", fontSize: 13, textAlign: "center", padding: "24px 0" }}>Loading…</p>
      )}
      {error && <div style={errorStyle}>{error}</div>}
      {!loading && !error && records.length === 0 && (
        <div style={emptyStyle}>No recommendations for "{playstyle}" yet.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {groupMode && groups
          ? groups.map(group => (
              <SetGroupCard
                key={group.setId ?? group.records[0].beatmap_id}
                group={group}
                playstyle={playstyle}
                onHide={handleHide}
                onHideSet={handleHideSet}
              />
            ))
          : records.map(bm => (
              <BeatmapCard
                key={bm.beatmap_id}
                record={bm}
                highlightTags={[playstyle]}
                onHide={handleHide}
                onHideSet={handleHideSet}
              />
            ))}
      </div>

      {hasMore && (
        <button onClick={() => fetchRecs(offset, false)} disabled={loading} style={loadMoreStyle}>
          {loading ? "Loading…" : "↓ Load more"}
        </button>
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
  fontSize: 18, fontWeight: 700, color: "#fffffe", marginBottom: 0,
};
const subtextStyle: React.CSSProperties = {
  color: "#a7a9be", fontSize: 13, marginBottom: 12,
};
const filterRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  background: "#0f0e17", border: "1px solid #2e2d3d",
  borderRadius: 8, padding: "10px 14px", marginBottom: 10,
};
const filterLabelStyle: React.CSSProperties = {
  fontSize: 13, color: "#ffd700", flexShrink: 0,
};
const applyBtnStyle: React.CSSProperties = {
  padding: "4px 10px", borderRadius: 6, border: "none", flexShrink: 0,
  background: "#ff6b9d", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer",
};
const clearBtnStyle: React.CSSProperties = {
  padding: "4px 8px", borderRadius: 6, border: "1px solid #2e2d3d", flexShrink: 0,
  background: "transparent", color: "#a7a9be", fontSize: 11, cursor: "pointer",
};
const refreshBtnStyle: React.CSSProperties = {
  padding: "5px 10px", borderRadius: 6, border: "1px solid #2e2d3d",
  background: "transparent", color: "#a7a9be", fontSize: 12, cursor: "pointer",
};
const loadMoreStyle: React.CSSProperties = {
  display: "block", width: "100%", marginTop: 12,
  padding: "10px 0", borderRadius: 8, border: "1px solid #2e2d3d",
  background: "transparent", color: "#a7a9be", fontSize: 13, cursor: "pointer", textAlign: "center",
};
const errorStyle: React.CSSProperties = {
  padding: "10px 14px", background: "#2a0a14",
  border: "1px solid #7f1d1d", borderRadius: 8, color: "#fca5a5", fontSize: 13, marginBottom: 10,
};
const emptyStyle: React.CSSProperties = {
  padding: "20px 16px", textAlign: "center", color: "#a7a9be",
  fontSize: 14, background: "#0f0e17", borderRadius: 8, border: "1px solid #2e2d3d",
};
const expandBtnStyle: React.CSSProperties = {
  display: "block", width: "100%", marginTop: 4, padding: "5px 8px",
  background: "transparent", border: "none", color: "#636e72",
  fontSize: 11, cursor: "pointer", textAlign: "left",
};
const expandedListStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 6,
  marginTop: 6, paddingLeft: 12, borderLeft: "2px solid #2e2d3d",
};

function viewBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: "4px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer",
    border: "1px solid",
    background: active ? "rgba(255,107,157,0.15)" : "transparent",
    color: active ? "#ff6b9d" : "#636e72",
    borderColor: active ? "#ff6b9d" : "#2e2d3d",
  };
}

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
