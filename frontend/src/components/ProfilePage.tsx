import { useEffect, useState, useMemo } from "react";
import { BeatmapRecord, CurrentUser } from "../types";
import { getHiddenBeatmaps, multiUnhide } from "../api";
import { BeatmapCard } from "./BeatmapCard";

interface Props {
  user: CurrentUser;
  onBack: () => void;
}

type SortMode = "set" | "beatmap";

export default function ProfilePage({ user, onBack }: Props) {
  const [hidden, setHidden] = useState<BeatmapRecord[]>([]);
  const [hiddenSets, setHiddenSets] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("beatmap");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedSets, setSelectedSets] = useState<Set<string>>(new Set());

  useEffect(() => {
    getHiddenBeatmaps()
      .then(res => { setHidden(res.hidden); setHiddenSets(res.hidden_sets); })
      .catch(() => setError("Failed to load hidden beatmaps"))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    if (sortMode === "beatmap") return null;
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

  function toggleSelectBeatmap(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSelectSet(id: string) {
    setSelectedSets(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function selectAll() {
    if (sortMode === "beatmap") setSelected(new Set(hidden.filter(b => b.hidden_by === "beatmap").map(b => b.beatmap_id)));
    else { setSelectedSets(new Set(hiddenSets)); setSelected(new Set(hidden.filter(b => b.hidden_by === "beatmap").map(b => b.beatmap_id))); }
  }
  function clearSelection() { setSelected(new Set()); setSelectedSets(new Set()); }

  async function handleMultiUnhide() {
    const bids = Array.from(selected);
    const sids = Array.from(selectedSets);
    setHidden(prev => prev.filter(b => {
      if (bids.includes(b.beatmap_id)) return false;
      if (b.beatmapset_id && sids.includes(b.beatmapset_id)) return false;
      return true;
    }));
    setHiddenSets(prev => prev.filter(s => !sids.includes(s)));
    setSelected(new Set()); setSelectedSets(new Set());
    await multiUnhide(bids, sids).catch(() => {});
  }
  async function handleUnhideSingle(id: string) {
    setHidden(prev => prev.filter(b => b.beatmap_id !== id));
    await multiUnhide([id], []).catch(() => {});
  }
  async function handleUnhideSet(setId: string) {
    setHidden(prev => prev.filter(b => b.beatmapset_id !== setId));
    setHiddenSets(prev => prev.filter(s => s !== setId));
    await multiUnhide([], [setId]).catch(() => {});
  }

  const anySelected = selected.size > 0 || selectedSets.size > 0;
  const hiddenByBeatmap = hidden.filter(b => b.hidden_by === "beatmap");

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px" }}>
      <button onClick={onBack} className="btn-ghost" style={{ marginBottom: 24, fontSize: 13 }}>
        ← Back
      </button>

      {/* Profile header */}
      <div style={profileHeaderStyle}>
        {user.avatar_url && (
          <img src={user.avatar_url} alt={user.username} style={avatarStyle} />
        )}
        <div>
          <div style={{ fontFamily: "var(--font-d)", fontSize: 22, fontWeight: 800, color: "#fff" }}>
            {user.username}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, fontFamily: "var(--font-m)" }}>
            osu! ID: {user.osu_id}
          </div>
        </div>
      </div>

      {/* Hidden beatmaps */}
      <div className="osu-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h2 style={{ fontFamily: "var(--font-d)", fontSize: 16, fontWeight: 800, color: "#fff", margin: 0 }}>
            Hidden Recommendations
          </h2>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setSortMode("beatmap")} style={sortBtnStyle(sortMode === "beatmap")}>By beatmap</button>
            <button onClick={() => setSortMode("set")} style={sortBtnStyle(sortMode === "set")}>By set</button>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
          {hidden.length} hidden — select items then unhide, or unhide one at a time.
        </p>

        {hidden.length > 0 && (
          <div style={toolbarStyle}>
            <button onClick={selectAll} style={smallBtnStyle}>Select all</button>
            {anySelected && (
              <>
                <button onClick={clearSelection} style={smallBtnStyle}>Clear</button>
                <button onClick={handleMultiUnhide} className="btn-pink"
                  style={{ fontSize: 11, padding: "4px 12px" }}>
                  Unhide selected ({selected.size + selectedSets.size})
                </button>
              </>
            )}
          </div>
        )}

        {loading && <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</p>}
        {error && <p style={{ color: "#fca5a5", fontSize: 13 }}>{error}</p>}
        {!loading && hidden.length === 0 && <div style={emptyStyle}>No hidden beatmaps.</div>}

        {/* By beatmap */}
        {sortMode === "beatmap" && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {hiddenByBeatmap.length === 0 && hidden.length > 0 && (
              <div style={emptyStyle}>No individually hidden beatmaps. Switch to "By set".</div>
            )}
            {hiddenByBeatmap.map(bm => (
              <div key={bm.beatmap_id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={selected.has(bm.beatmap_id)}
                  onChange={() => toggleSelectBeatmap(bm.beatmap_id)}
                  style={{ accentColor: "var(--pink)", flexShrink: 0, cursor: "pointer" }} />
                <div style={{ flex: 1, minWidth: 0 }}><BeatmapCard record={bm} /></div>
                <button onClick={() => handleUnhideSingle(bm.beatmap_id)} style={unhideBtnStyle}>Unhide</button>
              </div>
            ))}
          </div>
        )}

        {/* By set */}
        {sortMode === "set" && !loading && grouped && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {hiddenSets.map(setId => {
              const maps = grouped.bySet[setId] ?? [];
              return (
                <div key={setId} style={setGroupStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <input type="checkbox" checked={selectedSets.has(setId)}
                      onChange={() => toggleSelectSet(setId)}
                      style={{ accentColor: "var(--pink)", cursor: "pointer" }} />
                    <span style={{ fontSize: 12, color: "var(--muted)", flex: 1 }}>
                      Beatmapset <span style={{ color: "var(--pink)" }}>#{setId}</span>
                      <span style={{ marginLeft: 6, color: "var(--muted2)" }}>({maps.length} diff{maps.length !== 1 ? "s" : ""})</span>
                    </span>
                    <button onClick={() => handleUnhideSet(setId)} style={unhideBtnStyle}>Unhide set</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {maps.map(bm => <BeatmapCard key={bm.beatmap_id} record={bm} />)}
                  </div>
                </div>
              );
            })}

            {grouped.noSet.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>No beatmapset</div>
                {grouped.noSet.map(bm => (
                  <div key={bm.beatmap_id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <input type="checkbox" checked={selected.has(bm.beatmap_id)}
                      onChange={() => toggleSelectBeatmap(bm.beatmap_id)}
                      style={{ accentColor: "var(--pink)", flexShrink: 0, cursor: "pointer" }} />
                    <div style={{ flex: 1, minWidth: 0 }}><BeatmapCard record={bm} /></div>
                    <button onClick={() => handleUnhideSingle(bm.beatmap_id)} style={unhideBtnStyle}>Unhide</button>
                  </div>
                ))}
              </div>
            )}

            {(() => {
              const indivWithSet = hidden.filter(b =>
                b.hidden_by === "beatmap" && b.beatmapset_id && !hiddenSets.includes(b.beatmapset_id)
              );
              if (!indivWithSet.length) return null;
              const bySet: Record<string, BeatmapRecord[]> = {};
              for (const bm of indivWithSet) {
                const k = bm.beatmapset_id!;
                if (!bySet[k]) bySet[k] = [];
                bySet[k].push(bm);
              }
              return Object.entries(bySet).map(([sid, maps]) => (
                <div key={sid} style={setGroupStyle}>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                    Beatmapset <span style={{ color: "var(--pink)" }}>#{sid}</span>
                    <span style={{ marginLeft: 6, color: "var(--muted2)" }}>(individual hides)</span>
                  </div>
                  {maps.map(bm => (
                    <div key={bm.beatmap_id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                      <input type="checkbox" checked={selected.has(bm.beatmap_id)}
                        onChange={() => toggleSelectBeatmap(bm.beatmap_id)}
                        style={{ accentColor: "var(--pink)", flexShrink: 0, cursor: "pointer" }} />
                      <div style={{ flex: 1, minWidth: 0 }}><BeatmapCard record={bm} /></div>
                      <button onClick={() => handleUnhideSingle(bm.beatmap_id)} style={unhideBtnStyle}>Unhide</button>
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

const profileHeaderStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 16,
  padding: "18px 22px", background: "var(--card)",
  border: "1px solid var(--border)", borderRadius: 12, marginBottom: 20,
};
const avatarStyle: React.CSSProperties = {
  width: 60, height: 60, borderRadius: "50%",
  objectFit: "cover", border: "2px solid rgba(255,102,170,0.4)",
};
const emptyStyle: React.CSSProperties = {
  padding: "18px", textAlign: "center", color: "var(--muted)",
  fontSize: 13, background: "var(--card2)", borderRadius: 8,
  border: "1px solid var(--border)",
};
const unhideBtnStyle: React.CSSProperties = {
  flexShrink: 0, padding: "4px 10px", borderRadius: 6,
  border: "1px solid var(--border)",
  background: "transparent", color: "var(--muted)",
  fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
};
const toolbarStyle: React.CSSProperties = {
  display: "flex", gap: 6, alignItems: "center", marginBottom: 12,
};
const smallBtnStyle: React.CSSProperties = {
  padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)",
  background: "transparent", color: "var(--muted)", fontSize: 11, cursor: "pointer",
};
const setGroupStyle: React.CSSProperties = {
  background: "var(--card2)", borderRadius: 8,
  border: "1px solid var(--border)", padding: "12px 14px",
};
function sortBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: "4px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer",
    border: "1px solid",
    background: active ? "rgba(255,102,170,0.14)" : "transparent",
    color: active ? "var(--pink)" : "var(--muted2)",
    borderColor: active ? "var(--pink)" : "var(--border)",
  };
}
