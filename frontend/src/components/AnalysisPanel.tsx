import { useState } from "react";
import { DominantPlaystyle } from "../types";
import { getPlaystyleAnalysis } from "../api";

interface Props {
  onPlaystyleResult: (result: DominantPlaystyle) => void;
}

type Source = "top" | "recent";

// AnalysisPanel: select play source, trigger analysis, show dominant playstyle
// Requirements: 3.1, 3.5
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

      {/* Source dropdown (Requirements 3.1) */}
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

      {/* Progress indicator while loading (Requirements 3.5) */}
      {loading && (
        <div style={progressStyle}>
          <div style={spinnerStyle} />
          <span style={{ color: "#a7a9be", fontSize: 13 }}>
            Fetching play history and running predictions…
          </span>
        </div>
      )}

      {/* Error */}
      {error && <div style={errorStyle}>{error}</div>}

      {/* Result: dominant playstyle label + average probability (Requirements 3.5) */}
      {result && (
        <div style={resultStyle}>
          <div style={{ marginBottom: 4 }}>
            <span style={{ color: "#a7a9be", fontSize: 12, textTransform: "uppercase" }}>
              Dominant Playstyle
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: "#ff6b9d" }}>
              {result.label}
            </span>
            <span style={{ fontSize: 14, color: "#a7a9be" }}>
              {(result.average_probability * 100).toFixed(1)}% avg probability
            </span>
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: "#a7a9be" }}>
            Based on {result.beatmaps_analyzed} beatmap
            {result.beatmaps_analyzed !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}

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

const progressStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 0",
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
  padding: "14px 16px",
  background: "#0f0e17",
  border: "1px solid #2e2d3d",
  borderRadius: 8,
};
