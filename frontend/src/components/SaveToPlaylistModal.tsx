import { useEffect, useState } from "react";
import { Playlist } from "../types";
import { getMyPlaylists, createPlaylist, addToPlaylist, removeFromPlaylist } from "../api";

interface Props {
  beatmapId: string;
  beatmapTitle: string;
  onClose: () => void;
}

export default function SaveToPlaylistModal({ beatmapId, beatmapTitle, onClose }: Props) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());

  useEffect(() => {
    getMyPlaylists()
      .then(res => {
        setPlaylists(res.playlists);
        // Mark which playlists already contain this beatmap
        const already = new Set<number>();
        res.playlists.forEach(pl => {
          if (pl.beatmaps.some(b => b.beatmap_id === beatmapId)) already.add(pl.id);
        });
        setSaved(already);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [beatmapId]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  async function handleToggle(pl: Playlist) {
    setSaving(pl.id);
    try {
      if (saved.has(pl.id)) {
        await removeFromPlaylist(pl.id, beatmapId);
        setSaved(prev => { const n = new Set(prev); n.delete(pl.id); return n; });
      } else {
        await addToPlaylist(pl.id, beatmapId);
        setSaved(prev => new Set([...prev, pl.id]));
      }
    } catch { /* ignore */ }
    setSaving(null);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const pl = await createPlaylist(newName.trim());
      await addToPlaylist(pl.id, beatmapId);
      setPlaylists(prev => [pl, ...prev]);
      setSaved(prev => new Set([...prev, pl.id]));
      setNewName("");
    } catch { /* ignore */ }
    setCreating(false);
  }

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <h3 style={{ fontFamily: "var(--font-d)", fontSize: 15, fontWeight: 800, color: "#fff", margin: 0 }}>
              Save to Playlist
            </h3>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{beatmapTitle}</p>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {/* Create new */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <input
            className="osu-input"
            placeholder="New playlist name…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
            style={{ flex: 1, fontSize: 12 }}
          />
          <button className="btn-pink" onClick={handleCreate} disabled={!newName.trim() || creating}
            style={{ fontSize: 12, padding: "7px 14px", opacity: !newName.trim() || creating ? 0.45 : 1 }}>
            {creating ? "…" : "+ New"}
          </button>
        </div>

        {/* Playlist list */}
        <div style={{ maxHeight: 280, overflowY: "auto",
          scrollbarWidth: "thin", scrollbarColor: "rgba(255,102,170,0.25) transparent" }}>
          {loading ? (
            <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: 16 }}>Loading…</p>
          ) : playlists.length === 0 ? (
            <p style={{ color: "var(--muted2)", fontSize: 12, textAlign: "center", padding: 16 }}>
              No playlists yet. Create one above.
            </p>
          ) : (
            playlists.map(pl => {
              const isSaved = saved.has(pl.id);
              const isSaving = saving === pl.id;
              return (
                <button key={pl.id} onClick={() => handleToggle(pl)} disabled={isSaving}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    width: "100%", padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                    background: isSaved ? "rgba(255,102,170,0.12)" : "rgba(255,255,255,0.03)",
                    marginBottom: 4, transition: "background 0.15s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 16 }}>{isSaved ? "✅" : "🎵"}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--font-d)", fontSize: 13, fontWeight: 600,
                        color: isSaved ? "#ff66aa" : "#fff",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "left" }}>
                        {pl.name}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--muted2)", textAlign: "left" }}>
                        {pl.item_count} beatmap{pl.item_count !== 1 ? "s" : ""} · {pl.is_public ? "🌐 Public" : "🔒 Private"}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, flexShrink: 0,
                    color: isSaved ? "#ff66aa" : "var(--muted2)" }}>
                    {isSaving ? "…" : isSaved ? "Saved" : "+ Add"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 3000,
  background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
};
const modalStyle: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: 12, padding: 20, width: "100%", maxWidth: 400,
  boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
};
const closeBtnStyle: React.CSSProperties = {
  background: "transparent", border: "none", color: "var(--muted)",
  fontSize: 16, cursor: "pointer", padding: 4, lineHeight: 1,
};
