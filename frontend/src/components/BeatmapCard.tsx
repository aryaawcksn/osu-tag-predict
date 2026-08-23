import { BeatmapRecord } from "../types";

const STATUS_COLOR: Record<string, string> = {
  ranked: "#b8e994", approved: "#b8e994", loved: "#ff6b9d",
  qualified: "#74b9ff", pending: "#fbbf24", wip: "#fbbf24", graveyard: "#636e72",
};

function fmt(n?: number | null, decimals = 1): string {
  if (n == null) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(decimals);
}

export function BeatmapCard({ record, highlightTags }: { record: BeatmapRecord; highlightTags?: string[] }) {
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
        {record.card_url && (
          <img src={record.card_url} alt="" style={coverImgStyle} loading="lazy" />
        )}
        {/* Stronger overlay for readability */}
        <div style={overlayStyle} />

        <div style={contentStyle}>
          {/* Left */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={titleStyle}>{title}</div>
            {record.artist && (
              <div style={artistStyle}>
                by {record.artist}
                {record.version && (
                  <span style={{ color: "#ff6b9d", marginLeft: 6 }}>[{record.version}]</span>
                )}
              </div>
            )}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 7, alignItems: "center" }}>
              {stars && (
                <span style={{ ...badgeStyle, color: "#ffd700", borderColor: "rgba(255,215,0,0.5)", background: "rgba(0,0,0,0.6)" }}>
                  ★ {stars}
                </span>
              )}
              {record.status && (
                <span style={{ ...badgeStyle, color: statusColor, borderColor: `${statusColor}88`, background: "rgba(0,0,0,0.6)" }}>
                  {record.status}
                </span>
              )}
              {stats.map(([k, v]) => (
                <span key={k} style={statBadgeStyle}>{k} {v}</span>
              ))}
            </div>
          </div>

          {/* Right: highlighted tags first, then top others */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
            {[
              // highlighted tags first (sorted by probability)
              ...record.labels
                .filter(l => highlightTags?.includes(l.label))
                .sort((a, b) => b.probability - a.probability),
              // then remaining top tags
              ...record.labels
                .filter(l => !highlightTags?.includes(l.label))
                .sort((a, b) => b.probability - a.probability),
            ]
              .slice(0, 4)
              .map(({ label, probability }) => (
                <span key={label} style={tagStyle(probability, highlightTags?.includes(label))}>
                  {label} {(probability * 100).toFixed(0)}%
                </span>
              ))}
          </div>
        </div>
      </div>
    </a>
  );
}

const cardStyle: React.CSSProperties = {
  position: "relative", borderRadius: 10, overflow: "hidden",
  background: "#1a1929", border: "1px solid #2e2d3d", minHeight: 85,
};
const coverImgStyle: React.CSSProperties = {
  position: "absolute", inset: 0, width: "100%", height: "100%",
  objectFit: "cover", objectPosition: "center",
};
const overlayStyle: React.CSSProperties = {
  position: "absolute", inset: 0,
  background: "linear-gradient(90deg, rgba(10,9,18,0.96) 35%, rgba(10,9,18,0.75) 70%, rgba(10,9,18,0.55) 100%)",
};
const contentStyle: React.CSSProperties = {
  position: "relative", display: "flex", alignItems: "center",
  gap: 12, padding: "12px 16px",
};
const titleStyle: React.CSSProperties = {
  color: "#fffffe", fontWeight: 700, fontSize: 14,
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};
const artistStyle: React.CSSProperties = {
  color: "#c8cad8", fontSize: 12, marginTop: 2,
};
const badgeStyle: React.CSSProperties = {
  fontSize: 10, padding: "2px 6px", borderRadius: 4,
  border: "1px solid", textTransform: "capitalize", whiteSpace: "nowrap",
};
const statBadgeStyle: React.CSSProperties = {
  ...badgeStyle, color: "#c8cad8", borderColor: "rgba(46,45,61,0.8)", background: "rgba(0,0,0,0.55)",
};

function tagStyle(probability: number, highlighted = false): React.CSSProperties {
  return {
    fontSize: 10, padding: "2px 7px", borderRadius: 4,
    background: highlighted ? "rgba(255,107,157,0.25)" : "rgba(0,0,0,0.65)",
    border: highlighted ? "1px solid rgba(255,107,157,0.8)" : "1px solid rgba(255,107,157,0.5)",
    color: "#ff6b9d", whiteSpace: "nowrap",
    fontWeight: highlighted ? 700 : 400,
  };
}
