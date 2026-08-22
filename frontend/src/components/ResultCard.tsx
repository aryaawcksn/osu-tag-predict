import { PredictResult } from "../types";

interface Props {
  result: PredictResult;
}

export default function ResultCard({ result }: Props) {
  const title = result.filename ?? (result.beatmap_id ? `Beatmap #${result.beatmap_id}` : "Result");

  return (
    <div style={cardStyle}>
      <h2 style={{ fontSize: 18, marginBottom: 4, color: "#ff6b9d" }}>{title}</h2>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          ["BPM", result.bpm],
          ["AR", result.ar],
          ["CS", result.cs],
          ["OD", result.od],
          ["Objects", result.object_count],
        ].map(([k, v]) => (
          <div key={k as string} style={statBox}>
            <span style={{ fontSize: 11, color: "#a7a9be", textTransform: "uppercase" }}>{k}</span>
            <span style={{ fontSize: 20, fontWeight: 700 }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Predicted labels */}
      <h3 style={{ fontSize: 14, color: "#a7a9be", marginBottom: 12 }}>
        Predicted playstyles{" "}
        <span style={{ color: "#fffffe", fontWeight: 400 }}>
          (threshold ≥ 10%)
        </span>
      </h3>

      {result.predicted_labels.length === 0 ? (
        <p style={{ color: "#a7a9be", fontSize: 14 }}>
          No labels above threshold. Try a different beatmap.
        </p>
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

      {/* All labels toggle */}
      <details style={{ marginTop: 20 }}>
        <summary style={{ cursor: "pointer", color: "#a7a9be", fontSize: 13 }}>
          All probabilities ({result.all_labels.length} labels)
        </summary>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
          {result.all_labels.map(({ label, probability }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "#a7a9be" }}>{label}</span>
              <span>{(probability * 100).toFixed(2)}%</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#1a1929",
  border: "1px solid #2e2d3d",
  borderRadius: 16,
  padding: 24,
  marginTop: 24,
};

const statBox: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  background: "#0f0e17",
  border: "1px solid #2e2d3d",
  borderRadius: 8,
  padding: "8px 16px",
  minWidth: 60,
};
