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
        <div style={{ fontFamily: "var(--font-d)", fontWeight: 800, fontSize: 14, color: "var(--text)",
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
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
            {pl.top_tags.map(tag => (
              <span key={tag} style={{ fontFamily: "var(--font-m)", fontSize: 10, padding: "2px 8px",
                borderRadius: 4, background: "rgba(255,102,170,0.12)", border: "1px solid rgba(255,102,170,0.4)",
                color: "#ff66aa" }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Diff distribution bar chart */}
        {pl.diff_distribution && pl.diff_distribution.length > 0 && (
          <MiniDiffChart distribution={pl.diff_distribution} />
        )}
      </div>
    </div>
  );
}

function MiniDiffChart({ distribution }: { distribution: { range: string; count: number; color: string }[] }) {
  const max = Math.max(...distribution.map(d => d.count), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 36, marginTop: 4 }}>
      {distribution.map(d => {
        const hasAny = d.count > 0;
        const heightPct = hasAny ? Math.max((d.count / max) * 100, 10) : 4;
        return (
          <div key={d.range} title={`${d.range}: ${d.count} map${d.count !== 1 ? "s" : ""}`}
            style={{ flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", gap: 2, height: "100%", justifyContent: "flex-end" }}>
            <div style={{
              width: "100%", borderRadius: "2px 2px 0 0",
              height: `${heightPct}%`,
              background: hasAny ? `${d.color}55` : "rgba(255,255,255,0.04)",
              border: `1px solid ${hasAny ? d.color + "70" : "rgba(255,255,255,0.07)"}`,
              position: "relative", overflow: "hidden",
            }}>
              {hasAny && <div style={{ position: "absolute", inset: 0, background: `${d.color}40` }} />}
            </div>
            <div style={{ fontSize: 7, color: hasAny ? "var(--muted2)" : "transparent",
              fontFamily: "var(--font-m)", lineHeight: 1 }}>
              {d.range.replace("★", "")}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CoverMosaic({ covers }: { covers: string[] }) {  const filled = [...covers, ...Array(4).fill(null)].slice(0, 4);
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
