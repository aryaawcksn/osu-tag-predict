import { useState } from "react";
import LinkInput from "./components/LinkInput";
import ResultCard from "./components/ResultCard";
import { PredictResult } from "./types";

export default function App() {
  const [result, setResult] = useState<PredictResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleResult(r: PredictResult) {
    setResult(r);
    setError(null);
  }

  function handleError(e: string) {
    setError(e);
    setResult(null);
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 16px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
          osu! Playstyle Predictor
        </h1>
        <p style={{ color: "#a7a9be", fontSize: 15 }}>
          Paste a beatmap link or upload a <code>.osu</code> file to classify its playstyle.
        </p>
      </div>

      {/* Input */}
      <LinkInput
        onResult={handleResult}
        onError={handleError}
        onLoading={setLoading}
        loading={loading}
      />

      {/* Loading */}
      {loading && (
        <p style={{ textAlign: "center", color: "#a7a9be", marginTop: 24 }}>
          Analyzing beatmap…
        </p>
      )}

      {/* Error */}
      {error && (
        <div style={{
          marginTop: 20,
          padding: "12px 16px",
          background: "#2a0a14",
          border: "1px solid #7f1d1d",
          borderRadius: 8,
          color: "#fca5a5",
          fontSize: 14,
        }}>
          {error}
        </div>
      )}

      {/* Result */}
      {result && <ResultCard result={result} />}
    </div>
  );
}
