import { PredictResult } from "../types";

interface Props {
  result: PredictResult;
}

const STATUS_COLOR: Record<string, string> = {
  ranked: "#b8e994",
  approved: "#b8e994",
  loved: "#ff6b9d",
  qualified: "#74b9ff",
  pending: "#a7a9be",
  wip: "#a7a9be",
  graveyard: "#636e72",
};

export default function ResultCard({ result }: Props) {
  const href = result.beatmap_id
    ? `https://osu.ppy.sh/beatmaps/${result.beatmap_id}`
    : undefined;
  const title = result.title ?? result.filename ?? (result.beatmap_id ? `Beatmap #${result.beatmap_id}` : "Result");
  const stars = result.difficulty_rating != null ? result.difficulty_rating.toFixed(2) : null;
  const statusColor = STATUS_COLOR[result.status ?? ""] ?? "#a7a9be";

  const stats: [string, number | null][] = [
    ["BPM", result.bpm],
    ["AR", result.ar],
    ["CS", result.cs],
    ["OD", result.od],
    ["Objects", result.object_count],
  ];

  return (
    <div style={wrapperStyle}>
      {/* Cover banner */}
      <div style={bannerStyle}>
        {result.card_url && (
          <img src={result.card_url} alt="" style={coverImgStyle} />
        )}
        <div style={bannerOverlayStyle} />
        <div style={bannerContentStyle}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer" style={titleLinkStyle}>
                {title}
              </a>
            ) : (
              <span style={{ ...titleLinkStyle, cursor: "default" }}>{title}</span>
            )}
            {(result.artist || result.version) && (
              <div style={artistStyle}>
                {result.artist}
                {result.version && (
                  <span style={{ color: "#ff6b9d", marginLeft: 6 }}>[{result.version}]</span>
                )}
              </div>
            )}
          </div>
          {/* Badges */}
          <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {stars && <span style={{ ...badgeStyle, color: "#ffd700", borderColor: "#ffd700" }}>★ {stars}</span>}
            {result.status && (
              <span style={{ ...badgeStyle, color: statusColor, borderColor: statusColor }}>
                {result.status}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={statsRowStyle}>
        {stats.map(([k, v]) => (
          <div key={k} style={statBoxStyle}>
            <span style={{ fontSize: 10, color: "#a7a9be", textTransform: "uppercase" }}>{k}</span>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{v ?? "—"}</span>
          </div>
        ))}
      </div>

      {/* Predicted labels */}
      <div style={bodyStyle}>
        <p style={sectionLabelStyle}>
          Predicted playstyles{" "}
          <span style={{ color: "#a7a9be", fontWeight: 400 }}>(threshold ≥ 10%)</span>
        </p>

        {result.predicted_labels.length === 0 ? (
          <p style={{ color: "#a7a9be", fontSize: 14 }}>No labels above threshold.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.predicted_labels.map(({ label, probability }) => (
              <div key={label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 14 }}>{label}</span>
                  <span style={{ fontSize: 14, color: "#ff6b9d", fontWeight: 600 }}>
                    {(probability * 100).toFixed(1)}%
                  </span>
                </div>
                <div style={{ background: "#2e2d3d", borderRadius: 4, height: 6 }}>
                  <div
                    style={{
                      width: `${probability * 100}%`,
                      height: "100%",
                      background: `hsl(${330 + probability * 60}, 80%, 60%)`,
                      borderRadius: 4,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", color: "#a7a9be", fontSize: 12 }}>
            All probabilities ({result.all_labels.length} labels)
          </summary>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
            {result.all_labels.map(({ label, probability }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#a7a9be" }}>{label}</span>
                <span>{(probability * 100).toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

const wrapperStyle: React.CSSProperties = {
  background: "#1a1929",
  border: "1px solid #2e2d3d",
  borderRadius: 16,
  overflow: "hidden",
  marginTop: 24,
};

const bannerStyle: React.CSSProperties = {
  position: "relative",
  minHeight: 80,
};

const coverImgStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
  objectPosition: "center",
};

const bannerOverlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "linear-gradient(90deg, rgba(26,25,41,0.95) 35%, rgba(26,25,41,0.6) 100%)",
};

const bannerContentStyle: React.CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "16px 20px",
};

const titleLinkStyle: React.CSSProperties = {
  color: "#fffffe",
  fontWeight: 700,
  fontSize: 15,
  textDecoration: "none",
  display: "block",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const artistStyle: React.CSSProperties = {
  color: "#a7a9be",
  fontSize: 12,
  marginTop: 3,
};

const badgeStyle: React.CSSProperties = {
  fontSize: 10,
  padding: "2px 7px",
  borderRadius: 4,
  border: "1px solid",
  background: "rgba(0,0,0,0.3)",
  textTransform: "capitalize",
  whiteSpace: "nowrap",
};

const statsRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 0,
  borderTop: "1px solid #2e2d3d",
  borderBottom: "1px solid #2e2d3d",
};

const statBoxStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "10px 0",
  borderRight: "1px solid #2e2d3d",
};

const bodyStyle: React.CSSProperties = {
  padding: "16px 20px",
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#fffffe",
  marginBottom: 12,
};
