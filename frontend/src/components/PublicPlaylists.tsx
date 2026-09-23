import { useEffect, useState } from "react";
import { Playlist } from "../types";
import { getPublicPlaylists } from "../api";

interface Props {
  onOpenPlaylist: (username: string) => void;
}

export default function PublicPlaylists({ onOpenPlaylist }: Props) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublicPlaylists()
      .then(res => setPlaylists(res.playlists))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || playlists.length === 0) return null;

  return (
    <section style={{ marginTop: 40 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: "var(--font-d)", fontSize: 18, fontWeight: 800, color: "#fff", margin: 0 }}>
          User Playlists
        </h2>
        <p style={{ fontSize: 12, color: "var(--muted2)", marginTop: 3 }}>
          Public playlists curated by the community
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {playlists.map(pl => (
          <PlaylistCard key={pl.id} playlist={pl} onOpen={() => onOpenPlaylist(pl.owner.username)} />
        ))}
      </div>
    </section>
  );
}

function PlaylistCard({ playlist: pl, onOpen }: { playlist: Playlist; onOpen: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--card)",
        border: `1px solid ${hovered ? "rgba(255,102,170,0.45)" : "rgba(180,130,220,0.18)"}`,
        borderRadius: 12, overflow: "hidden", cursor: "pointer",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? "0 8px 24px rgba(0,0,0,0.45)" : "none",
        transition: "all 0.2s",
      }}
    >
      {/* Cover mosaic */}
      <CoverMosaic covers={pl.covers} />

      {/* Body */}
      <div style={{ padding: "12px 14px 14px" }}>
        {/* Playlist name */}
        <div style={{ fontFamily: "var(--font-d)", fontWeight: 800, fontSize: 14, color: "#fff",
          marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {pl.name}
        </div>

        {/* Owner row */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
          {pl.owner.avatar_url ? (
            <img src={pl.owner.avatar_url} alt={pl.owner.username}
              style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover",
                border: "1px solid rgba(255,102,170,0.4)" }} />
          ) : (
            <div style={{ width: 20, height: 20, borderRadius: "50%",
              background: "rgba(255,102,170,0.2)", flexShrink: 0 }} />
          )}
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{pl.owner.username}</span>
          <span style={{ fontSize: 11, color: "var(--muted2)", marginLeft: "auto" }}>
            {pl.item_count} maps
          </span>
        </div>

        {/* Top tags */}
        {pl.top_tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {pl.top_tags.map(tag => (
              <span key={tag} style={{ fontFamily: "var(--font-m)", fontSize: 10, padding: "2px 8px",
                borderRadius: 4, background: "rgba(255,102,170,0.12)", border: "1px solid rgba(255,102,170,0.4)",
                color: "#ff66aa" }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CoverMosaic({ covers }: { covers: string[] }) {
  const filled = [...covers, ...Array(4).fill(null)].slice(0, 4);
  return (
    <div style={{ height: 100, display: "grid",
      gridTemplateColumns: covers.length >= 2 ? "1fr 1fr" : "1fr",
      gridTemplateRows: covers.length >= 3 ? "1fr 1fr" : "1fr",
      overflow: "hidden", background: "var(--bg)" }}>
      {filled.map((src, i) =>
        src ? (
          <img key={i} src={src} alt="" loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.7 }} />
        ) : (
          <div key={i} style={{ background: "rgba(180,130,220,0.06)" }} />
        )
      )}
    </div>
  );
}
