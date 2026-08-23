import { useEffect, useState } from "react";
import { BeatmapRecord, CurrentUser } from "../types";
import { getHiddenBeatmaps, unhideBeatmap } from "../api";
import { BeatmapCard } from "./BeatmapCard";

interface Props {
  user: CurrentUser;
  onBack: () => void;
}

export default function ProfilePage({ user, onBack }: Props) {
  const [hidden, setHidden] = useState<BeatmapRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHiddenBeatmaps()
      .then(res => setHidden(res.hidden))
      .catch(() => setError("Failed to load hidden beatmaps"))
      .finally(() => setLoading(false));
  }, []);

  async function handleUnhide(beatmapId: string) {
    setHidden(prev => prev.filter(b => b.beatmap_id !== beatmapId));
    await unhideBeatmap(beatmapId).catch(() => {});
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px" }}>
      <button onClick={onBack} style={backBtnStyle}>← Back</button>

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
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fffffe", marginBottom: 4 }}>
          Hidden Recommendations
        </h2>
        <p style={{ fontSize: 12, color: "#a7a9be", marginBottom: 16 }}>
          These maps are hidden from your recommendations. Click Unhide to restore them.
        </p>

        {loading && <p style={{ color: "#a7a9be", fontSize: 13 }}>Loading…</p>}
        {error && <p style={{ color: "#fca5a5", fontSize: 13 }}>{error}</p>}

        {!loading && hidden.length === 0 && (
          <div style={emptyStyle}>No hidden beatmaps.</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {hidden.map(bm => (
            <div key={bm.beatmap_id} style={{ position: "relative" }}>
              <BeatmapCard record={bm} />
              <button
                onClick={() => handleUnhide(bm.beatmap_id)}
                style={unhideBtnStyle}
              >
                Unhide
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  padding: "6px 14px", borderRadius: 6, border: "1px solid #2e2d3d",
  background: "transparent", color: "#a7a9be", fontSize: 13,
  cursor: "pointer", marginBottom: 24,
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
  position: "absolute", top: 8, right: 8, zIndex: 10,
  padding: "3px 10px", borderRadius: 5, border: "1px solid #2e2d3d",
  background: "rgba(15,14,23,0.9)", color: "#a7a9be",
  fontSize: 11, cursor: "pointer",
};
