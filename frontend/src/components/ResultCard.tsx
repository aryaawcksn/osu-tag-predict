import { PredictResult } from "../types";

interface Props {
  result: PredictResult;
}

const STATUS_COLOR: Record<string, string> = {
  ranked: "#b8e994", approved: "#b8e994", loved: "#ff66aa",
  qualified: "#74b9ff", pending: "#fbbf24", wip: "#fbbf24", graveyard: "var(--muted2)",
};

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  } catch { return "—"; }
}

function fmt(n?: number | null, decimals = 1): string {
  if (n == null) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(decimals);
}

export default function ResultCard({ result }: Props) {
  const href = result.beatmap_id ? `https://osu.ppy.sh/beatmaps/${result.beatmap_id}` : undefined;
  const title = result.title ?? result.filename ?? (result.beatmap_id ? `Beatmap #${result.beatmap_id}` : "Result");
  const stars = result.difficulty_rating != null ? result.difficulty_rating.toFixed(2) : null;
  const statusColor = STATUS_COLOR[result.status ?? ""] ?? "var(--muted)";
  const displayDate = result.ranked_date ?? result.submitted_date;
  const dateLabel = result.ranked_date ? "Ranked" : "Submitted";

  return (
    <div style={wrapperStyle}>
      {/* Cover banner */}
      <div style={bannerStyle}>
        {result.card_url && <img src={result.card_url} alt="" style={coverImgStyle} />}
        <div style={bannerOverlayStyle} />
        <div style={bannerContentStyle}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer" style={titleStyle}>{title}</a>
            ) : (
              <span style={titleStyle}>{title}</span>
            )}
            {result.artist && <div style={subtitleStyle}>by {result.artist}</div>}
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
              {result.creator && <span style={chipStyle}>{result.creator}</span>}
              {result.version && <span style={{ ...chipStyle, color: "#ff66aa", borderColor: "rgba(255,102,170,0.4)" }}>[{result.version}]</span>}
              {stars && <span style={{ ...chipStyle, color: "#ffd700", borderColor: "rgba(255,215,0,0.4)" }}>★ {stars}</span>}
              {result.status && <span style={{ ...chipStyle, color: statusColor, borderColor: `${statusColor}55` }}>{result.status}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Meta row */}
      {(result.play_count != null || result.favourite_count != null || displayDate) && (
        <div style={metaRowStyle}>
          {result.play_count != null && <span style={metaItemStyle}>▶ {result.play_count.toLocaleString()} plays</span>}
          {result.favourite_count != null && <span style={metaItemStyle}>♥ {result.favourite_count.toLocaleString()} favs</span>}
          {displayDate && <span style={metaItemStyle}>{dateLabel}: {formatDate(displayDate)}</span>}
        </div>
      )}

      {/* Stats row */}
      <div style={statsRowStyle}>
        {([ ["BPM", fmt(result.bpm, 0)], ["AR", fmt(result.ar)], ["CS", fmt(result.cs)], ["OD", fmt(result.od)], ["Objects", fmt(result.object_count, 0)] ] as [string, string][]).map(([k, v]) => (
          <div key={k} style={statBoxStyle}>
            <span style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", fontFamily: "var(--font-m)", letterSpacing: "0.06em" }}>{k}</span>
            <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-d)" }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Labels */}
      <div style={bodyStyle}>
        <p style={sectionLabelStyle}>
          Predicted Playstyles{" "}
          <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 11 }}>(threshold ≥ 10%)</span>
        </p>

        {result.predicted_labels.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>No labels above threshold.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.predicted_labels.map(({ label, probability }) => (
              <div key={label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{label}</span>
                  <span style={{ fontSize: 13, color: "#ff66aa", fontWeight: 600, fontFamily: "var(--font-m)" }}>
                    {(probability * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${probability * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        <details style={{ marginTop: 14 }}>
          <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: 12 }}>
            All probabilities ({result.all_labels.length} labels)
          </summary>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
            {result.all_labels.map(({ label, probability }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "var(--muted)" }}>{label}</span>
                <span style={{ fontFamily: "var(--font-m)" }}>{(probability * 100).toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

const wrapperStyle: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: 12, overflow: "hidden", marginTop: 20,
};
const bannerStyle: React.CSSProperties = { position: "relative", minHeight: 90 };
const coverImgStyle: React.CSSProperties = {
  position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
};
const bannerOverlayStyle: React.CSSProperties = {
  position: "absolute", inset: 0,
  background: "linear-gradient(90deg, rgba(26,23,38,0.96) 30%, rgba(26,23,38,0.6) 100%)",
};
const bannerContentStyle: React.CSSProperties = {
  position: "relative", padding: "16px 20px",
};
const titleStyle: React.CSSProperties = {
  color: "#fff", fontFamily: "var(--font-d)", fontWeight: 800, fontSize: 16,
  textDecoration: "none", display: "block",
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};
const subtitleStyle: React.CSSProperties = {
  color: "var(--muted)", fontSize: 13, marginTop: 2,
};
const chipStyle: React.CSSProperties = {
  fontSize: 11, padding: "2px 8px", borderRadius: 4,
  border: "1px solid var(--border)", background: "rgba(0,0,0,0.3)",
  color: "var(--muted)", whiteSpace: "nowrap",
};
const metaRowStyle: React.CSSProperties = {
  display: "flex", gap: 14, padding: "7px 20px",
  borderBottom: "1px solid var(--border)", flexWrap: "wrap",
  background: "rgba(0,0,0,0.15)",
};
const metaItemStyle: React.CSSProperties = {
  fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-m)",
};
const statsRowStyle: React.CSSProperties = {
  display: "flex", borderBottom: "1px solid var(--border)",
};
const statBoxStyle: React.CSSProperties = {
  flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
  padding: "10px 0", borderRight: "1px solid var(--border)",
};
const bodyStyle: React.CSSProperties = { padding: "16px 20px" };
const sectionLabelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 10,
};
