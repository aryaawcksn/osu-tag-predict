import { PredictResult } from "../types";

interface Props {
  result: PredictResult;
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

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return "—";
  }
}

function fmt(n?: number | null, decimals = 1): string {
  if (n == null) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(decimals);
}

export default function ResultCard({ result }: Props) {
  const href = result.beatmap_id
    ? `https://osu.ppy.sh/beatmaps/${result.beatmap_id}`
    : undefined;

  const title = result.title ?? result.filename ?? (result.beatmap_id ? `Beatmap #${result.beatmap_id}` : "Result");
  const stars = result.difficulty_rating != null ? result.difficulty_rating.toFixed(2) : null;
  const statusColor = STATUS_COLOR[result.status ?? ""] ?? "#a7a9be";
  const displayDate = result.ranked_date ?? result.submitted_date;

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
            {/* Title */}
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer" style={titleStyle}>
                {title}
              </a>
            ) : (
              <span style={titleStyle}>{title}</span>
            )}
            {/* Artist */}
            {result.artist && (
              <div style={subtitleStyle}>by {result.artist}</div>
            )}
            {/* Creator + difficulty */}
            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
              {result.creator && (
                <span style={metaChipStyle}>mapped by {result.creator}</span>
              )}
              {result.version && (
                <span style={{ ...metaChipStyle, color: "#ff6b9d", borderColor: "rgba(255,107,157,0.4)" }}>
                  [{result.version}]
                </span>
              )}
              {stars && (
                <span style={{ ...metaChipStyle, color: "#ffd700", borderColor: "rgba(255,215,0,0.4)" }}>
                  ★ {stars}
                </span>
              )}
              {result.status && (
                <span style={{ ...metaChipStyle, color: statusColor, borderColor: `${statusColor}66` }}>
                  {result.status}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Meta row: plays, favourites, date */}
      {(result.play_count != null || result.favourite_count != null || displayDate) && (
        <div style={metaRowStyle}>
          {result.play_count != null && (
            <span style={metaItemStyle}>▶ plays: {result.play_count.toLocaleString()}</span>
          )}
          {result.favourite_count != null && (
            <span style={metaItemStyle}>♥ favourites: {result.favourite_count.toLocaleString()}</span>
          )}
          {displayDate && (
            <span style={metaItemStyle}>
              {result.ranked_date ? "Ranked" : "Submitted"}: {formatDate(displayDate)}
            </span>
          )}
        </div>
      )}

      {/* Stats row */}
      <div style={statsRowStyle}>
        {([
          ["BPM", fmt(result.bpm, 0)],
          ["AR", fmt(result.ar)],
          ["CS", fmt(result.cs)],
          ["OD", fmt(result.od)],
          ["Objects", fmt(result.object_count, 0)],
        ] as [string, string][]).map(([k, v]) => (
          <div key={k} style={statBoxStyle}>
            <span style={{ fontSize: 10, color: "#a7a9be", textTransform: "uppercase" }}>{k}</span>
            <span style={{ fontSize: 17, fontWeight: 700 }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Predicted labels */}
      <div style={bodyStyle}>
        <p style={sectionLabelStyle}>
          Predicted Playstyles{" "}
          <span style={{ color: "#a7a9be", fontWeight: 400, fontSize: 12 }}>(threshold ≥ 10%)</span>
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
                    {(probability * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={{ background: "#2e2d3d", borderRadius: 4, height: 6 }}>
                  <div style={{
                    width: `${probability * 100}%`,
                    height: "100%",
                    background: `hsl(${330 + probability * 60}, 80%, 60%)`,
                    borderRadius: 4,
                    transition: "width 0.4s ease",
                  }} />
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
  minHeight: 90,
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
  background: "linear-gradient(90deg, rgba(26,25,41,0.95) 35%, rgba(26,25,41,0.55) 100%)",
};

const bannerContentStyle: React.CSSProperties = {
  position: "relative",
  padding: "16px 20px",
};

const titleStyle: React.CSSProperties = {
  color: "#fffffe",
  fontWeight: 700,
  fontSize: 16,
  textDecoration: "none",
  display: "block",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const subtitleStyle: React.CSSProperties = {
  color: "#a7a9be",
  fontSize: 13,
  marginTop: 2,
};

const metaChipStyle: React.CSSProperties = {
  fontSize: 11,
  padding: "2px 8px",
  borderRadius: 4,
  border: "1px solid #2e2d3d",
  background: "rgba(0,0,0,0.3)",
  color: "#a7a9be",
  whiteSpace: "nowrap",
};

const metaRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 16,
  padding: "8px 20px",
  borderBottom: "1px solid #2e2d3d",
  flexWrap: "wrap",
  background: "rgba(0,0,0,0.15)",
};

const metaItemStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#a7a9be",
};

const statsRowStyle: React.CSSProperties = {
  display: "flex",
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
