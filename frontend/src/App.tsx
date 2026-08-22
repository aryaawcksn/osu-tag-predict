import { useState, useEffect } from "react";
import LinkInput from "./components/LinkInput";
import ResultCard from "./components/ResultCard";
import NavBar from "./components/NavBar";
import QueueBar from "./components/QueueBar";
import AnalysisPanel from "./components/AnalysisPanel";
import RecommendationList from "./components/RecommendationList";
import { PredictResult, CurrentUser, QueueState, DominantPlaystyle } from "./types";
import { getCurrentUser, getQueueState, predictFromLink, predictFromUpload, pollJobResult } from "./api";

export default function App() {
  const [result, setResult] = useState<PredictResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [dominantPlaystyle, setDominantPlaystyle] = useState<DominantPlaystyle | null>(null);

  // Load current user on mount (Requirements 2.4)
  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => setUser(null));
  }, []);

  // Keep a local copy of queue state so App knows if queue is full (Requirements 1.3)
  useEffect(() => {
    let cancelled = false;
    async function fetchQ() {
      try {
        const s = await getQueueState();
        if (!cancelled) setQueueState(s);
      } catch { /* backend may not be ready */ }
    }
    fetchQ();
    const id = setInterval(fetchQ, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const queueFull = queueState
    ? queueState.occupied_slots >= queueState.total_capacity
    : false;

  // Queue-aware submission: enqueue then poll (Requirements 1.2, 1.3)
  async function handleLinkSubmit(url: string) {
    if (queueFull) {
      setError("Queue is full. Please wait for a slot to open.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { job_id } = await predictFromLink(url);
      const r = await pollJobResult(job_id);
      setResult(r);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileSubmit(file: File) {
    if (queueFull) {
      setError("Queue is full. Please wait for a slot to open.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { job_id } = await predictFromUpload(file);
      const r = await pollJobResult(job_id);
      setResult(r);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function handleError(e: string) {
    setError(e);
    setResult(null);
  }

  function handleLogout() {
    setUser(null);
    window.location.reload();
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f0e17", color: "#fffffe" }}>
      {/* Nav */}
      <NavBar user={user} onLogout={handleLogout} />

      {/* Queue status bar */}
      <QueueBar />

      {/* Main content */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 16px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
            osu! Playstyle Analyzer
          </h1>
          <p style={{ color: "#a7a9be", fontSize: 15 }}>
            Paste a beatmap link or upload a <code>.osu</code> file to analyze its playstyle.
          </p>
        </div>

        {/* Queue full notice (Requirements 1.3) */}
        {queueFull && (
          <div style={noticeBannerStyle}>
            Queue is currently full (5/5 slots). New predictions are temporarily disabled.
          </div>
        )}

        {/* Prediction input — disabled when queue is full */}
        <LinkInput
          onLinkSubmit={handleLinkSubmit}
          onFileSubmit={handleFileSubmit}
          onError={handleError}
          onLoading={setLoading}
          loading={loading}
          disabled={queueFull}
        />

        {/* Loading state while polling */}
        {loading && (
          <p style={{ textAlign: "center", color: "#a7a9be", marginTop: 24 }}>
            Analyzing beatmap… waiting for result
          </p>
        )}

        {/* Error */}
        {error && (
          <div style={errorStyle}>{error}</div>
        )}

        {/* Prediction result */}
        {result && <ResultCard result={result} />}

        {/* Auth-gated features — analysis & recommendations (Requirements 2.4, 6.3) */}
        {!user && (
          <div style={loginPromptStyle}>
            <p style={{ marginBottom: 12, color: "#a7a9be", fontSize: 14 }}>
              Log in with your osu! account to unlock playstyle analysis and map recommendations.
            </p>
            <a
              href={`${import.meta.env.VITE_API_URL ?? "http://localhost:8000"}/auth/login`}
              style={loginBtnStyle}
            >
              Login with osu!
            </a>
          </div>
        )}

        {/* Authenticated: AnalysisPanel + RecommendationList (Requirements 2.4, 3.1, 4.1) */}
        {user && (
          <>
            <AnalysisPanel onPlaystyleResult={setDominantPlaystyle} />
            {dominantPlaystyle && (
              <RecommendationList playstyle={dominantPlaystyle.label} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

const noticeBannerStyle: React.CSSProperties = {
  marginBottom: 16,
  padding: "10px 16px",
  background: "#2a1a0a",
  border: "1px solid #92400e",
  borderRadius: 8,
  color: "#fbbf24",
  fontSize: 13,
  textAlign: "center",
};

const errorStyle: React.CSSProperties = {
  marginTop: 20,
  padding: "12px 16px",
  background: "#2a0a14",
  border: "1px solid #7f1d1d",
  borderRadius: 8,
  color: "#fca5a5",
  fontSize: 14,
};

const loginPromptStyle: React.CSSProperties = {
  marginTop: 40,
  padding: 24,
  background: "#1a1929",
  border: "1px solid #2e2d3d",
  borderRadius: 12,
  textAlign: "center",
};

const loginBtnStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "8px 20px",
  background: "#ff6b9d",
  color: "#fff",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 14,
  textDecoration: "none",
};
