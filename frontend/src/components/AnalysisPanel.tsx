import { useState } from "react";
import { DominantPlaystyle, PlaystyleDistribution } from "../types";
import { getPlaystyleAnalysis } from "../api";

interface Props {
  onPlaystyleResult: (result: DominantPlaystyle) => void;
}

type Source = "top" | "recent";

export default function AnalysisPanel({ onPlaystyleResult }: Props) {
  const [source, setSource] = useState<Source>("top");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DominantPlaystyle | null>(null);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const dominant = await getPlaystyleAnalysis(source);
      setResult(dominant);
      onPlaystyleResult(dominant);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={panelStyle}>
      <h2 style={headingStyle}>Playstyle Analysis</h2>
      <p style={subtextStyle}>
        Analyze your play history to determine your dominant playstyle.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <label htmlFor="source-select" style={{ color: "#a7a9be", fontSize: 13, flexShrink: 0 }}>
          Data source
        </label>
        <select
          id="source-select"
          value={source}
          onChange={(e) => setSource(e.target.value as Source)}
          disabled={loading}
          style={selectStyle}
        >
          <option value="top">Top Plays</option>
          <option value="recent">Recent Plays</option>
        </select>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          style={loading ? { ...btnStyle, opacity: 0.6, cursor: "not-allowed" } : btnStyle}
        >
          {loading ? "Analyzing…" : "Analyze"}
        </button>
      </div>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0" }}>
          <div style={spinnerStyle} />
          <span style={{ color: "#a7a9be", fontSize: 13 }}>
            Fetching play history and running predictions…
          </span>
        </div>
      )}

      {error && <div style={errorStyle}>{error}</div>}

      {result && <PlaystyleResult result={result} />}
    </div>
  );
}

function PlaystyleResult({ result }: { result: DominantPlaystyle }) {
  const top = result.distribution.slice(0, 8);
  const max = top[0]?.average_probability ?? 1;

  return (
    <div style={resultStyle}>
      {/* Dominant label */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ color: "#a7a9be", fontSize: 11, textTransform: "uppercase", marginBottom: 4 }}>
          Dominant Playstyle
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: "#ff6b9d" }}>
            {result.label}
          </span>
          <span style={{ fontSize: 13, color: "#a7a9be" }}>
            {(result.average_probability * 100).toFixed(1)}% avg
          </span>
        </div>
        <div style={{ fontSize: 12, color: "#636e72", marginTop: 4 }}>
          Based on {result.beatmaps_analyzed} beatmap{result.beatmaps_analyzed !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Bubble distribution */}
      <div style={{ color: "#a7a9be", fontSize: 11, textTransform: "uppercase", marginBottom: 10 }}>
        Playstyle Distribution
      </div>
      <div style={bubbleContainerStyle}>
        {top.map((item) => (
          <Bubble key={item.label} item={item} max={max} isDominant={item.label === result.label} />
        ))}
      </div>

      {/* Bar chart for rest */}
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 5 }}>
        {top.map((item) => (
          <div key={item.label}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 12, color: item.label === result.label ? "#ff6b9d" : "#a7a9be" }}>
                {item.label}
              </span>
              <span style={{ fontSize: 12, color: "#fffffe", fontWeight: item.label === result.label ? 700 : 400 }}>
                {(item.average_probability * 100).toFixed(1)}%
              </span>
            </div>
            <div style={{ background: "#2e2d3d", borderRadius: 3, height: 4 }}>
              <div style={{
                width: `${(item.average_probability / max) * 100}%`,
                height: "100%",
                borderRadius: 3,
                background: item.label === result.label
                  ? "#ff6b9d"
                  : `rgba(255,107,157,${0.25 + (item.average_probability / max) * 0.4})`,
                transition: "width 0.5s ease",
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bubble({ item, max, isDominant }: {
  item: PlaystyleDistribution;
  max: number;
  isDominant: boolean;
}) {
  const ratio = item.average_probability / max;
  const size = Math.round(36 + ratio * 52); // 36px to 88px
  const alpha = 0.12 + ratio * 0.35;

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: `rgba(255,107,157,${alpha})`,
      border: `${isDominant ? 2 : 1}px solid rgba(255,107,157,${0.3 + ratio * 0.5})`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 4,
      flexShrink: 0,
      transition: "all 0.3s ease",
    }}>
      <span style={{
        fontSize: Math.max(8, Math.round(8 + ratio * 5)),
        fontWeight: isDominant ? 700 : 500,
        color: isDominant ? "#ff6b9d" : "#fffffe",
        textAlign: "center",
        lineHeight: 1.2,
        wordBreak: "break-word",
        overflow: "hidden",
        maxWidth: size - 10,
      }}>
        {item.label}
      </span>
    </div>
  );
}

// Styles

const panelStyle: React.CSSProperties = {
  background: "#1a1929",
  border: "1px solid #2e2d3d",
  borderRadius: 12,
  padding: 24,
  marginTop: 32,
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

const selectStyle: React.CSSProperties = {
  background: "#0f0e17",
  border: "1px solid #2e2d3d",
  borderRadius: 6,
  color: "#fffffe",
  fontSize: 13,
  padding: "6px 10px",
  cursor: "pointer",
  flex: 1,
};

const btnStyle: React.CSSProperties = {
  padding: "7px 18px",
  borderRadius: 6,
  border: "none",
  background: "#ff6b9d",
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  flexShrink: 0,
};

const spinnerStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  border: "2px solid #2e2d3d",
  borderTop: "2px solid #ff6b9d",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
  flexShrink: 0,
};

const errorStyle: React.CSSProperties = {
  padding: "10px 14px",
  background: "#2a0a14",
  border: "1px solid #7f1d1d",
  borderRadius: 8,
  color: "#fca5a5",
  fontSize: 13,
  marginTop: 8,
};

const resultStyle: React.CSSProperties = {
  marginTop: 16,
  padding: "16px",
  background: "#0f0e17",
  border: "1px solid #2e2d3d",
  borderRadius: 8,
};

const bubbleContainerStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "center",
};
