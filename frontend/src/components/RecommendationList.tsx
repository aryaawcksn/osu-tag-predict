import { useEffect, useState } from "react";
import { BeatmapRecord } from "../types";
import { getRecommendations } from "../api";

interface Props {
  playstyle: string;
}

// RecommendationList: fetch and display beatmap recommendations for a playstyle
// Requirements: 4.2, 4.6
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

      {/* Empty state (Requirements 4.6) */}
      {!loading && !error && records.length === 0 && (
        <div style={emptyStyle}>
          {message ?? `No recommendations available for playstyle "${playstyle}" yet. Try predicting more beatmaps first.`}
        </div>
      )}

      {/* Beatmap cards (Requirements 4.2) */}
      {records.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
          {records.map((bm) => (
            <BeatmapCard key={bm.beatmap_id} record={bm} />
          ))}
        </div>
      )}
    </div>
  );
}

function BeatmapCard({ record }: { record: BeatmapRecord }) {
  const stats: [string, number | null][] = [
    ["BPM", record.bpm],
    ["AR", record.ar],
    ["CS", record.cs],
    ["OD", record.od],
    ["Objects", record.object_count],
  ];

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <a
          href={`https://osu.ppy.sh/beatmaps/${record.beatmap_id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={beatmapLinkStyle}
        >
          Beatmap #{record.beatmap_id}
        </a>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {stats.map(([k, v]) => (
          <div key={k} style={statBoxStyle}>
            <span style={{ fontSize: 10, color: "#a7a9be", textTransform: "uppercase" }}>{k}</span>
            <span style={{ fontSize: 15, fontWeight: 700 }}>
              {v != null ? v : "—"}
            </span>
          </div>
        ))}
      </div>

      {/* Playstyle tags */}
      {record.labels.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {record.labels
            .sort((a, b) => b.probability - a.probability)
            .map(({ label, probability }) => (
              <span key={label} style={tagStyle(probability)}>
                {label} {(probability * 100).toFixed(0)}%
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

// Style helpers

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
  background: "#0f0e17",
  border: "1px solid #2e2d3d",
  borderRadius: 10,
  padding: "14px 16px",
};

const beatmapLinkStyle: React.CSSProperties = {
  color: "#ff6b9d",
  fontSize: 15,
  fontWeight: 600,
  textDecoration: "none",
};

const statBoxStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  background: "#1a1929",
  border: "1px solid #2e2d3d",
  borderRadius: 6,
  padding: "6px 12px",
  minWidth: 52,
};

function tagStyle(probability: number): React.CSSProperties {
  const alpha = 0.15 + probability * 0.4;
  return {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 4,
    background: `rgba(255, 107, 157, ${alpha})`,
    border: "1px solid rgba(255, 107, 157, 0.4)",
    color: "#ff6b9d",
    whiteSpace: "nowrap",
  };
}
