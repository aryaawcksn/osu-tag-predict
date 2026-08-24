import { useEffect, useState, useMemo } from "react";
import { BeatmapRecord, CurrentUser } from "../types";
import { getHiddenBeatmaps, multiUnhide } from "../api";
import { BeatmapCard } from "./BeatmapCard";

interface Props {
  user: CurrentUser;
}

type SortMode = "set" | "beatmap";

export default function ProfilePage({ user }: Props) {
  const [hidden, setHidden] = useState<BeatmapRecord[]>([]);
  const [hiddenSets, setHiddenSets] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("beatmap");
  const [selected, setSelected] = useState<Set<string>>(new Set()); // beatmap_ids
  const [selectedSets, setSelectedSets] = useState<Set<string>>(new Set()); // beatmapset_ids

  useEffect(() => {
    getHiddenBeatmaps()
      .then(res => {
        setHidden(res.hidden);
        setHiddenSets(res.hidden_sets);
      })
      .catch(() => setError("Failed to load hidden beatmaps"))
      .finally(() => setLoading(false));
  }, []);

  // Group by set when sortMode === "set"
  const grouped = useMemo(() => {
    if (sortMode === "beatmap") {
      // Filter to only individually hidden beatmaps
      return null;
    }
    // Group by beatmapset_id (hidden-by-set entries + individually hidden with a set)
    const bySet: Record<string, BeatmapRecord[]> = {};
    const noSet: BeatmapRecord[] = [];
    for (const bm of hidden) {
      if (bm.beatmapset_id) {
        if (!bySet[bm.beatmapset_id]) bySet[bm.beatmapset_id] = [];
        bySet[bm.beatmapset_id].push(bm);
      } else {
        noSet.push(bm);
      }
    }
    return { bySet, noSet };
  }, [hidden, sortMode]);

  function toggleSelectBeatmap(beatmapId: string) {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(beatmapId) ? n.delete(beatmapId) : n.add(beatmapId);
      return n;
    });
  }

  function toggleSelectSet(setId: string) {
    setSelectedSets(prev => {
      const n = new Set(prev);
      n.has(setId) ? n.delete(setId) : n.add(setId);
      return n;
    });
  }

  function selectAll() {
    if (sortMode === "beatmap") {
      setSelected(new Set(hidden.filter(b => b.hidden_by === "beatmap").map(b => b.beatmap_id)));
    } else {
      setSelectedSets(new Set(hiddenSets));
      setSelected(new Set(hidden.filter(b => b.hidden_by === "beatmap").map(b => b.beatmap_id)));
    }
  }

  function clearSelection() {
    setSelected(new Set());
    setSelectedSets(new Set());
  }

  async function handleMultiUnhide() {
    const bids = Array.from(selected);
    const sids = Array.from(selectedSets);
    // Optimistic update
    setHidden(prev => prev.filter(b => {
      if (bids.includes(b.beatmap_id)) return false;
      if (b.beatmapset_id && sids.includes(b.beatmapset_id)) return false;
      return true;
    }));
    setHiddenSets(prev => prev.filter(s => !sids.includes(s)));
    setSelected(new Set());
    setSelectedSets(new Set());
    await multiUnhide(bids, sids).catch(() => {});
  }

  async function handleUnhideSingle(beatmapId: string) {
    setHidden(prev => prev.filter(b => b.beatmap_id !== beatmapId));
    await multiUnhide([beatmapId], []).catch(() => {});
  }

  async function handleUnhideSet(setId: string) {
    setHidden(prev => prev.filter(b => b.beatmapset_id !== setId || b.hidden_by !== "set"));
    setHiddenSets(prev => prev.filter(s => s !== setId));
    await multiUnhide([], [setId]).catch(() => {});
  }

  const anySelected = selected.size > 0 || selectedSets.size > 0;
  const hiddenByBeatmap = hidden.filter(b => b.hidden_by === "beatmap");

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px" }}>
      <a href="#" style={backBtnStyle}>← Back</a>

      {/* Profile header */}
      <div style={profileHeaderStyle}>
        {user.avatar_url && (
          <img src={user.avatar_url} alt={user.username} style={avatarStyle} />
        )}
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fffffe" }}>{user.username}</div>
          <div style={{ fontSize: 13, color: "#a7a9be", marginTop: 2 }}>osu! ID: {user.osu_id}</div>
        </div>
      </div>

      {/* Hidden beatmaps */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fffffe", margin: 0 }}>
            Hidden Recommendations
          </h2>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {/* Sort toggle */}
            <button onClick={() => setSortMode("beatmap")} style={sortBtnStyle(sortMode === "beatmap")}>
              By beatmap
            </button>
            <button onClick={() => setSortMode("set")} style={sortBtnStyle(sortMode === "set")}>
              By set
            </button>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "#a7a9be", marginBottom: 12 }}>
          {hidden.length} hidden — check items then click Unhide selected, or unhide one at a time.
        </p>

        {/* Multi-unhide toolbar */}
        {hidden.length > 0 && (
          <div style={toolbarStyle}>
            <button onClick={selectAll} style={smallBtnStyle}>Select all</button>
            {anySelected && (
              <>
                <button onClick={clearSelection} style={smallBtnStyle}>Clear</button>
                <button onClick={handleMultiUnhide} style={unhideSelectedBtnStyle}>
                  Unhide selected ({selected.size + selectedSets.size})
                </button>
              </>
            )}
          </div>
        )}

        {loading && <p style={{ color: "#a7a9be", fontSize: 13 }}>Loading…</p>}
        {error && <p style={{ color: "#fca5a5", fontSize: 13 }}>{error}</p>}

        {!loading && hidden.length === 0 && (
          <div style={emptyStyle}>No hidden beatmaps.</div>
        )}

        {/* SORT BY BEATMAP: show individually hidden beatmaps */}
        {sortMode === "beatmap" && !loading && (
          <div style={{ ...scrollableHiddenStyle, display: "flex", flexDirection: "column", gap: 8 }}>
            {hiddenByBeatmap.length === 0 && hidden.length > 0 && (
              <div style={{ ...emptyStyle, marginBottom: 0 }}>
                No individually hidden beatmaps. Switch to "By set" to see set-hidden entries.
              </div>
            )}
            {hiddenByBeatmap.map(bm => (
              <div key={bm.beatmap_id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={selected.has(bm.beatmap_id)}
                  onChange={() => toggleSelectBeatmap(bm.beatmap_id)}
                  style={{ accentColor: "#ff6b9d", flexShrink: 0, cursor: "pointer" }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <BeatmapCard record={bm} />
                </div>
                <button onClick={() => handleUnhideSingle(bm.beatmap_id)} style={unhideBtnStyle}>
                  Unhide
                </button>
              </div>
            ))}
          </div>
        )}

        {/* SORT BY SET */}
        {sortMode === "set" && !loading && grouped && (
          <div style={{ ...scrollableHiddenStyle, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Set-hidden groups */}
            {hiddenSets.map(setId => {
              const maps = grouped.bySet[setId] ?? [];
              return (
                <div key={setId} style={setGroupStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={selectedSets.has(setId)}
                      onChange={() => toggleSelectSet(setId)}
                      style={{ accentColor: "#ff6b9d", cursor: "pointer" }}
                    />
                    <span style={{ fontSize: 12, color: "#a7a9be", flex: 1 }}>
                      Beatmapset <span style={{ color: "#ff6b9d" }}>#{setId}</span>
                      <span style={{ marginLeft: 6, color: "#636e72" }}>({maps.length} diff{maps.length !== 1 ? "s" : ""})</span>
                    </span>
                    <button onClick={() => handleUnhideSet(setId)} style={unhideBtnStyle}>
                      Unhide set
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {maps.map(bm => (
                      <BeatmapCard key={bm.beatmap_id} record={bm} />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Individually hidden with a set (not set-hidden) */}
            {grouped.noSet.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: "#a7a9be", marginBottom: 8 }}>No beatmapset</div>
                {grouped.noSet.map(bm => (
                  <div key={bm.beatmap_id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <input
                      type="checkbox"
                      checked={selected.has(bm.beatmap_id)}
                      onChange={() => toggleSelectBeatmap(bm.beatmap_id)}
                      style={{ accentColor: "#ff6b9d", flexShrink: 0, cursor: "pointer" }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <BeatmapCard record={bm} />
                    </div>
                    <button onClick={() => handleUnhideSingle(bm.beatmap_id)} style={unhideBtnStyle}>
                      Unhide
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Individually hidden that have a set_id but weren't set-hidden */}
            {(() => {
              const indivWithSet = hidden.filter(b =>
                b.hidden_by === "beatmap" && b.beatmapset_id && !hiddenSets.includes(b.beatmapset_id)
              );
              if (!indivWithSet.length) return null;
              // Group them by set
              const bySet: Record<string, BeatmapRecord[]> = {};
              for (const bm of indivWithSet) {
                const k = bm.beatmapset_id!;
                if (!bySet[k]) bySet[k] = [];
                bySet[k].push(bm);
              }
              return Object.entries(bySet).map(([sid, maps]) => (
                <div key={sid} style={setGroupStyle}>
                  <div style={{ fontSize: 12, color: "#a7a9be", marginBottom: 6 }}>
                    Beatmapset <span style={{ color: "#ff6b9d" }}>#{sid}</span>
                    <span style={{ marginLeft: 6, color: "#636e72" }}>(individual hides)</span>
                  </div>
                  {maps.map(bm => (
                    <div key={bm.beatmap_id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                      <input
                        type="checkbox"
                        checked={selected.has(bm.beatmap_id)}
                        onChange={() => toggleSelectBeatmap(bm.beatmap_id)}
                        style={{ accentColor: "#ff6b9d", flexShrink: 0, cursor: "pointer" }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <BeatmapCard record={bm} />
                      </div>
                      <button onClick={() => handleUnhideSingle(bm.beatmap_id)} style={unhideBtnStyle}>
                        Unhide
                      </button>
                    </div>
                  ))}
                </div>
              ));
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  display: "inline-block", padding: "6px 14px", borderRadius: 6, border: "1px solid #2e2d3d",
  background: "transparent", color: "#a7a9be", fontSize: 13,
  cursor: "pointer", marginBottom: 24, textDecoration: "none",
};
const profileHeaderStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 16,
  padding: "20px 24px", background: "#1a1929",
  border: "1px solid #2e2d3d", borderRadius: 12, marginBottom: 24,
};
const avatarStyle: React.CSSProperties = {
  width: 64, height: 64, borderRadius: "50%",
  objectFit: "cover", border: "2px solid #2e2d3d",
};
const sectionStyle: React.CSSProperties = {
  background: "#1a1929", border: "1px solid #2e2d3d",
  borderRadius: 12, padding: 24,
};
const emptyStyle: React.CSSProperties = {
  padding: "20px", textAlign: "center", color: "#a7a9be",
  fontSize: 13, background: "#0f0e17", borderRadius: 8,
  border: "1px solid #2e2d3d",
};
const unhideBtnStyle: React.CSSProperties = {
  flexShrink: 0, padding: "4px 10px", borderRadius: 5, border: "1px solid #2e2d3d",
  background: "rgba(15,14,23,0.9)", color: "#a7a9be",
  fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
};
const toolbarStyle: React.CSSProperties = {
  display: "flex", gap: 6, alignItems: "center", marginBottom: 12,
};
const smallBtnStyle: React.CSSProperties = {
  padding: "4px 10px", borderRadius: 5, border: "1px solid #2e2d3d",
  background: "transparent", color: "#a7a9be", fontSize: 11, cursor: "pointer",
};
const unhideSelectedBtnStyle: React.CSSProperties = {
  padding: "4px 12px", borderRadius: 5, border: "none",
  background: "#ff6b9d", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer",
};
const setGroupStyle: React.CSSProperties = {
  background: "#0f0e17", borderRadius: 8, border: "1px solid #2e2d3d", padding: "12px 14px",
};

const scrollableHiddenStyle: React.CSSProperties = {
  maxHeight: 520,
  overflowY: "auto",
  paddingRight: 4,
};

function sortBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: "4px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer",
    border: "1px solid",
    background: active ? "rgba(255,107,157,0.15)" : "transparent",
    color: active ? "#ff6b9d" : "#636e72",
    borderColor: active ? "#ff6b9d" : "#2e2d3d",
  };
}
