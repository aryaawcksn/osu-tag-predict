import { useEffect, useState } from "react";
import { Playlist, CurrentUser } from "../types";
import { getUserPlaylists, createPlaylist, deletePlaylist, updatePlaylist } from "../api";
import { BeatmapCard } from "./BeatmapCard";

interface Props {
  username: string;
  currentUser: CurrentUser | null;
  onBack: () => void;
}

export default function PlaylistPage({ username, currentUser, onBack }: Props) {
  const [owner, setOwner] = useState<{ username: string; avatar_url?: string; osu_id: number } | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const isOwner = currentUser?.username === username;

  useEffect(() => {
    getUserPlaylists(username)
      .then(res => { setOwner(res.owner); setPlaylists(res.playlists); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [username]);

  const activePl = playlists.find(p => p.id === activeId) ?? playlists[0] ?? null;

  // Compute most common tags across ALL playlists of this user (public+own)
  const tagCount: Record<string, number> = {};
  playlists.forEach(pl =>
    pl.top_tags.forEach(t => { tagCount[t] = (tagCount[t] ?? 0) + 1; })
  );
  const globalTopTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const pl = await createPlaylist(newName.trim());
      setPlaylists(prev => [pl, ...prev]);
      setActiveId(pl.id);
      setNewName("");
    } catch { /* ignore */ }
    setCreating(false);
  }

  async function handleDelete(id: number) {
    await deletePlaylist(id).catch(() => {});
    setPlaylists(prev => prev.filter(p => p.id !== id));
    if (activeId === id) setActiveId(null);
  }

  async function handleTogglePublic(pl: Playlist) {
    const updated = await updatePlaylist(pl.id, { is_public: !pl.is_public }).catch(() => null);
    if (updated) setPlaylists(prev => prev.map(p => p.id === pl.id ? updated : p));
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 80px" }}>
      <button onClick={onBack} className="btn-ghost" style={{ marginBottom: 28, fontSize: 13 }}>
        ← Back
      </button>

      {/* Profile header */}
      {owner && (
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          {owner.avatar_url ? (
            <img src={owner.avatar_url} alt={owner.username}
              style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover",
                border: "3px solid rgba(255,102,170,0.5)", marginBottom: 12 }} />
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: "50%",
              background: "rgba(255,102,170,0.2)", margin: "0 auto 12px" }} />
          )}
          <h1 style={{ fontFamily: "var(--font-d)", fontSize: 22, fontWeight: 800, color: "#fff", margin: 0 }}>
            {owner.username}'s Playlists
          </h1>
          {globalTopTags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 10 }}>
              {globalTopTags.map(t => (
                <span key={t} style={{ fontFamily: "var(--font-m)", fontSize: 11, padding: "3px 10px",
                  borderRadius: 20, background: "rgba(255,102,170,0.14)", border: "1px solid rgba(255,102,170,0.5)",
                  color: "#ff66aa" }}>
                  {t}
                </span>
              ))}
            </div>
          )}
          <p style={{ fontSize: 12, color: "var(--muted2)", marginTop: 8 }}>
            {playlists.length} playlist{playlists.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {loading && <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Loading…</p>}

      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20, alignItems: "start" }}>
          {/* Sidebar: playlist list */}
          <div>
            {isOwner && (
              <div style={{ marginBottom: 12 }}>
                <input className="osu-input" placeholder="New playlist…" value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
                  style={{ fontSize: 12, marginBottom: 6 }} />
                <button className="btn-pink" onClick={handleCreate}
                  disabled={!newName.trim() || creating}
                  style={{ width: "100%", fontSize: 12, padding: "7px 0",
                    opacity: !newName.trim() || creating ? 0.45 : 1 }}>
                  {creating ? "Creating…" : "+ New Playlist"}
                </button>
              </div>
            )}

            {playlists.length === 0 ? (
              <p style={{ color: "var(--muted2)", fontSize: 12, padding: "12px 0" }}>
                {isOwner ? "No playlists yet." : "No public playlists."}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {playlists.map(pl => {
                  const active = (activeId ?? playlists[0]?.id) === pl.id;
                  return (
                    <div key={pl.id}
                      style={{ borderRadius: 8, overflow: "hidden",
                        background: active ? "rgba(255,102,170,0.12)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${active ? "rgba(255,102,170,0.45)" : "var(--border)"}` }}>
                      <button onClick={() => setActiveId(pl.id)}
                        style={{ display: "block", width: "100%", padding: "10px 12px",
                          background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
                        <div style={{ fontFamily: "var(--font-d)", fontSize: 13, fontWeight: 700,
                          color: active ? "#ff66aa" : "#fff",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {pl.name}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--muted2)", marginTop: 2 }}>
                          {pl.item_count} maps · {pl.is_public ? "🌐 Public" : "🔒 Private"}
                        </div>
                      </button>
                      {isOwner && (
                        <div style={{ display: "flex", gap: 4, padding: "0 8px 8px" }}>
                          <button onClick={() => handleTogglePublic(pl)}
                            style={{ flex: 1, fontSize: 10, padding: "3px 0", borderRadius: 5,
                              border: "1px solid var(--border)", background: "transparent",
                              color: "var(--muted)", cursor: "pointer" }}>
                            {pl.is_public ? "Make Private" : "Make Public"}
                          </button>
                          <button onClick={() => handleDelete(pl.id)}
                            style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5,
                              border: "1px solid #7f1d1d", background: "transparent",
                              color: "#fca5a5", cursor: "pointer" }}>
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Main: active playlist beatmaps */}
          <div>
            {activePl ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  <h2 style={{ fontFamily: "var(--font-d)", fontSize: 18, fontWeight: 800, color: "#fff", margin: 0 }}>
                    {activePl.name}
                  </h2>
                  <p style={{ fontSize: 12, color: "var(--muted2)", marginTop: 3 }}>
                    {activePl.item_count} beatmap{activePl.item_count !== 1 ? "s" : ""}
                    {activePl.top_tags.length > 0 && (
                      <> · top tags: <span style={{ color: "#ff66aa" }}>{activePl.top_tags.join(", ")}</span></>
                    )}
                  </p>
                </div>
                {activePl.beatmaps.length === 0 ? (
                  <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--muted)",
                    background: "var(--card2)", borderRadius: 10, border: "1px solid var(--border)" }}>
                    This playlist is empty.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                    {activePl.beatmaps.map(bm => (
                      <BeatmapCard key={bm.beatmap_id} record={bm} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
                Select a playlist to view its beatmaps.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
