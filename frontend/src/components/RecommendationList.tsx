import { useEffect, useState } from "react";
import { BeatmapRecord } from "../types";
import { getRecommendations } from "../api";

interface Props {
  playstyle: string;
}

const STATUS_COLOR: Record<string, string> = {
  ranked: "#b8e994",
  approved: "#b8e994",
  loved: "#ff6b9d",
  qualified: "#74b9ff",
  pending: "#fbbf24",
  wip: "#fbbf24",
  graveyard: "#636e72",
};

function fmt(n?: number | null, decimals = 1): string {
  if (n == null) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(decimals);
}

export default function RecommendationList({ playstyle }: Props) {
  const [records, setRecords] = useState<BeatmapRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playstyle) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    setRecords([]);

    getRecommendations(playstyle)
      .then((res) => {
        setRecords(res.recommendations);
        if (res.message) setMessage(res.message);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load recommendations");
      })
      .finally(() => setLoading(false));
  }, [playstyle]);

  return (
    <div style={containerStyle}>
      <h2 style={headingStyle}>Map Recommendations</h2>
      <p style={subtextStyle}>
        Maps matching your dominant playstyle:{" "}
        <strong style={{ color: "#ff6b9d" }}>{playstyle}</strong>
      </p>

      {loading && (
        <p style={{ color: "#a7a9be", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
          Loading recommendations…
        </p>
      )}

      {error && <div style={errorStyle}>{error}</div>}

      {!loading && !error && records.length === 0 && (
        <div style={emptyStyle}>
          {message ?? `Belum ada rekomendasi untuk "${playstyle}". Coba predict lebih banyak beatmap dulu.`}
        </div>
      )}

      {records.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
          {records.map((bm) => (
            <BeatmapCard key={bm.beatmap_id} record={bm} />
          ))}
        </div>
      )}
    </div>
  );
}

function BeatmapCard({ record }: { record: BeatmapRecord }) {
  const href = `https://osu.ppy.sh/beatmaps/${record.beatmap_id}`;
  const title = record.title ?? `Beatmap #${record.beatmap_id}`;
  const stars = record.difficulty_rating != null ? record.difficulty_rating.toFixed(2) : null;
  const statusColor = STATUS_COLOR[record.status ?? ""] ?? "#a7a9be";

  const stats: [string, string][] = [
    ["BPM", fmt(record.bpm, 0)],
    ["AR", fmt(record.ar)],
    ["CS", fmt(record.cs)],
    ["OD", fmt(record.od)],
    ["Objects", fmt(record.object_count, 0)],
  ];

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block" }}>
      <div style={cardStyle}>
        {/* Cover */}
        {record.card_url && (
          <img src={record.card_url} alt="" style={coverImgStyle} loading="lazy" />
        )}
        <div style={overlayStyle} />

        {/* Content */}
        <div style={contentStyle}>
          {/* Left */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={titleStyle}>{title}</div>
            {record.artist && (
              <div style={artistStyle}>
                oleh {record.artist}
                {record.version && (
                  <span style={{ color: "#ff6b9d", marginLeft: 6 }}>[{record.version}]</span>
                )}
              </div>
            )}

            {/* Badges + stats */}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 7, alignItems: "center" }}>
              {stars && (
                <span style={{ ...badgeStyle, color: "#ffd700", borderColor: "rgba(255,215,0,0.4)" }}>
                  ★ {stars}
                </span>
              )}
              {record.status && (
                <span style={{ ...badgeStyle, color: statusColor, borderColor: `${statusColor}66` }}>
                  {record.status}
                </span>
              )}
              {stats.map(([k, v]) => (
                <span key={k} style={statBadgeStyle}>{k} {v}</span>
              ))}
            </div>
          </div>

          {/* Right: top 3 labels */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
            {record.labels
              .sort((a, b) => b.probability - a.probability)
              .slice(0, 3)
              .map(({ label, probability }) => (
                <span key={label} style={tagStyle(probability)}>
                  {label} {(probability * 100).toFixed(0)}%
                </span>
              ))}
          </div>
        </div>
      </div>
    </a>
  );
}

const containerStyle: React.CSSProperties = {
  background: "#1a1929",
  border: "1px solid #2e2d3d",
  borderRadius: 12,
  padding: 24,
  marginTop: 24,
};

const headingStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: "#fffffe",
  marginBottom: 6,
};

const subtextStyle: React.CSSProperties = {
  color: "#a7a9be",
  fontSize: 13,
  marginBottom: 16,
};

const errorStyle: React.CSSProperties = {
  padding: "10px 14px",
  background: "#2a0a14",
  border: "1px solid #7f1d1d",
  borderRadius: 8,
  color: "#fca5a5",
  fontSize: 13,
};

const emptyStyle: React.CSSProperties = {
  padding: "20px 16px",
  textAlign: "center",
  color: "#a7a9be",
  fontSize: 14,
  background: "#0f0e17",
  borderRadius: 8,
  border: "1px solid #2e2d3d",
};

const cardStyle: React.CSSProperties = {
  position: "relative",
  borderRadius: 10,
  overflow: "hidden",
  background: "#1a1929",
  border: "1px solid #2e2d3d",
  minHeight: 85,
};

const coverImgStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
  objectPosition: "center",
};

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "linear-gradient(90deg, rgba(15,14,23,0.93) 40%, rgba(15,14,23,0.6) 100%)",
};

const contentStyle: React.CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 16px",
};

const titleStyle: React.CSSProperties = {
  color: "#fffffe",
  fontWeight: 700,
  fontSize: 14,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const artistStyle: React.CSSProperties = {
  color: "#a7a9be",
  fontSize: 12,
  marginTop: 2,
};

const badgeStyle: React.CSSProperties = {
  fontSize: 10,
  padding: "2px 6px",
  borderRadius: 4,
  border: "1px solid",
  background: "rgba(0,0,0,0.3)",
  textTransform: "capitalize",
  whiteSpace: "nowrap",
};

const statBadgeStyle: React.CSSProperties = {
  ...badgeStyle,
  color: "#a7a9be",
  borderColor: "#2e2d3d",
};

function tagStyle(probability: number): React.CSSProperties {
  const alpha = 0.15 + probability * 0.4;
  return {
    fontSize: 10,
    padding: "2px 7px",
    borderRadius: 4,
    background: `rgba(255, 107, 157, ${alpha})`,
    border: "1px solid rgba(255, 107, 157, 0.4)",
    color: "#ff6b9d",
    whiteSpace: "nowrap",
  };
}
