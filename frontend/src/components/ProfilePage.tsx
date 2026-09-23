import { useEffect, useState } from "react";
import { CurrentUser, Playlist } from "../types";
import { getMyPlaylists, createPlaylist, deletePlaylist, updatePlaylist } from "../api";

interface Props {
  user: CurrentUser;
  onBack: () => void;
  onOpenPlaylist: (username: string) => void;
}

export default function ProfilePage({ user, onBack, onOpenPlaylist }: Props) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getMyPlaylists()
      .then(res => setPlaylists(res.playlists))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const pl = await createPlaylist(newName.trim());
      setPlaylists(prev => [pl, ...prev]);
      setNewName("");
    } catch { /* ignore */ }
    setCreating(false);
  }

  async function handleDelete(id: number) {
    await deletePlaylist(id).catch(() => {});
    setPlaylists(prev => prev.filter(p => p.id !== id));
  }

  async function handleTogglePublic(pl: Playlist) {
    const updated = await updatePlaylist(pl.id, { is_public: !pl.is_public }).catch(() => null);
    if (updated) setPlaylists(prev => prev.map(p => p.id === pl.id ? updated : p));
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 24px 80px" }}>
      <button onClick={onBack} className="btn-ghost" style={{ marginBottom: 28, fontSize: 13 }}>
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
          <button
            onClick={() => onOpenPlaylist(user.username)}
            style={{ marginTop: 10, fontSize: 12, color: "#ff66aa", background: "none",
              border: "none", cursor: "pointer", padding: 0, fontFamily: "var(--font-d)", fontWeight: 600 }}
          >
            View public playlist page →
          </button>
        </div>
      </div>

      {/* My Playlists */}
      <div className="osu-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontFamily: "var(--font-d)", fontSize: 17, fontWeight: 800, color: "#fff", margin: 0 }}>
            My Playlists
          </h2>
          <span style={{ fontSize: 12, color: "var(--muted2)" }}>
            {playlists.length} playlist{playlists.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Create new */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <input
            className="osu-input"
            placeholder="New playlist name…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
            style={{ flex: 1, fontSize: 13 }}
          />
          <button className="btn-pink" onClick={handleCreate}
            disabled={!newName.trim() || creating}
            style={{ fontSize: 13, padding: "8px 18px",
              opacity: !newName.trim() || creating ? 0.45 : 1 }}>
            {creating ? "Creating…" : "+ New"}
          </button>
        </div>

        {loading && <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</p>}

        {!loading && playlists.length === 0 && (
          <div style={{ padding: "24px 0", textAlign: "center", color: "var(--muted2)", fontSize: 13 }}>
            No playlists yet. Save beatmaps from the card overlay to start building one.
          </div>
        )}

        {!loading && playlists.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {playlists.map(pl => (
              <PlaylistRow
                key={pl.id}
                playlist={pl}
                onTogglePublic={() => handleTogglePublic(pl)}
                onDelete={() => handleDelete(pl.id)}
                onOpen={() => onOpenPlaylist(user.username)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlaylistRow({ playlist: pl, onTogglePublic, onDelete, onOpen }: {
  playlist: Playlist;
  onTogglePublic: () => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px", borderRadius: 10,
      background: "var(--card2)", border: "1px solid var(--border)" }}>

      {/* Cover thumbnails */}
      <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
        {[...pl.covers, null, null, null].slice(0, 3).map((src, i) =>
          src ? (
            <img key={i} src={src} alt=""
              style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 4, opacity: 0.8 }} />
          ) : (
            <div key={i} style={{ width: 36, height: 36, borderRadius: 4,
              background: "rgba(180,130,220,0.08)", border: "1px solid var(--border)" }} />
          )
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <button onClick={onOpen}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0,
            fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 14, color: "#fff",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            display: "block", width: "100%", textAlign: "left" }}>
          {pl.name}
        </button>
        <div style={{ fontSize: 11, color: "var(--muted2)", marginTop: 2 }}>
          {pl.item_count} beatmap{pl.item_count !== 1 ? "s" : ""}
          {pl.top_tags.length > 0 && (
            <> · <span style={{ color: "var(--muted)" }}>{pl.top_tags.slice(0, 2).join(", ")}</span></>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
        <button onClick={onTogglePublic}
          style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6,
            border: "1px solid var(--border)", background: "transparent",
            color: pl.is_public ? "#ff66aa" : "var(--muted2)", cursor: "pointer" }}>
          {pl.is_public ? "🌐 Public" : "🔒 Private"}
        </button>
        <button onClick={onDelete}
          style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6,
            border: "1px solid #7f1d1d", background: "transparent",
            color: "#fca5a5", cursor: "pointer" }}>
          ✕
        </button>
      </div>
    </div>
  );
}

const profileHeaderStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 18,
  padding: "18px 22px", background: "var(--card)",
  border: "1px solid var(--border)", borderRadius: 12, marginBottom: 20,
};
const avatarStyle: React.CSSProperties = {
  width: 64, height: 64, borderRadius: "50%",
  objectFit: "cover", border: "2px solid rgba(255,102,170,0.4)",
};
