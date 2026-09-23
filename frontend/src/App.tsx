import { useState, useEffect } from "react";
import LinkInput from "./components/LinkInput";
import ResultCard from "./components/ResultCard";
import NavBar from "./components/NavBar";
import QueueBar from "./components/QueueBar";
import RecommendationList from "./components/RecommendationList";
import BeatmapTagSearch from "./components/BeatmapTagSearch";
import ProfilePage from "./components/ProfilePage";
import PlaylistPage from "./components/PlaylistPage";
import RelevanceSection from "./components/RelevanceSection";
import RelabelBanner from "./components/RelabelBanner";
import BeatmapsThisWeek from "./components/BeatmapsThisWeek";
import PublicPlaylists from "./components/PublicPlaylists";
import { PredictResult, CurrentUser, QueueState } from "./types";
import {
  getCurrentUser, getQueueState, predictFromLink, predictFromUpload,
  pollJobResult, setSessionToken, clearSessionToken,
} from "./api";

type Page =
  | { type: "home" }
  | { type: "profile" }
  | { type: "playlist"; username: string };

export default function App() {
  const [result, setResult] = useState<PredictResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [page, setPage] = useState<Page>({ type: "home" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("session_token");
    if (token) {
      setSessionToken(token);
      const url = new URL(window.location.href);
      url.searchParams.delete("session_token");
      window.history.replaceState({}, "", url.toString());
    }
    getCurrentUser().then(setUser).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchQ() {
      if (document.hidden) return;
      try {
        const s = await getQueueState();
        if (!cancelled) setQueueState(s);
      } catch { /* ignore */ }
    }
    fetchQ();
    const id = setInterval(fetchQ, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const queueFull = queueState
    ? queueState.occupied_slots >= queueState.total_capacity
    : false;

  async function handleLinkSubmit(url: string) {
    if (queueFull) { setError("Queue is full. Please wait."); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const { job_id } = await predictFromLink(url);
      setResult(await pollJobResult(job_id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally { setLoading(false); }
  }

  async function handleFileSubmit(file: File) {
    if (queueFull) { setError("Queue is full. Please wait."); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const { job_id } = await predictFromUpload(file);
      setResult(await pollJobResult(job_id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally { setLoading(false); }
  }

  function handleLogout() {
    clearSessionToken();
    setUser(null);
    window.location.reload();
  }

  const nav = (
    <>
      <NavBar
        user={user}
        onLogout={handleLogout}
        onProfile={() => setPage({ type: "profile" })}
      />
      <RelabelBanner />
    </>
  );

  if (page.type === "profile" && user) {
    return (
      <div style={rootStyle}>
        {nav}
        <ProfilePage
          user={user}
          onBack={() => setPage({ type: "home" })}
          onOpenPlaylist={u => setPage({ type: "playlist", username: u })}
        />
        <InfoTooltip />
      </div>
    );
  }

  if (page.type === "playlist") {
    return (
      <div style={rootStyle}>
        {nav}
        <PlaylistPage
          username={page.username}
          currentUser={user}
          onBack={() => setPage({ type: "home" })}
        />
        <InfoTooltip />
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      {nav}
      <QueueBar />
      <InfoTooltip />

      <div style={mainStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <h1 style={h1Style}>osu! Beatmap Tag Analyzer</h1>
          <p style={subtitleStyle}>
            Paste a beatmap link or upload a{" "}
            <code style={{ fontFamily: "var(--font-m)", color: "#ff66aa" }}>.osu</code>{" "}
            file to predict its tags.
          </p>
        </div>

        {/* Queue full notice */}
        {queueFull && (
          <div className="osu-card" style={{ borderColor: "rgba(146,64,14,0.6)", background: "#1c1206", color: "#fbbf24", fontSize: 13, textAlign: "center", marginBottom: 16 }}>
            Queue is full (5/5 slots). New predictions are temporarily disabled.
          </div>
        )}

        {/* Input */}
        <LinkInput
          onLinkSubmit={handleLinkSubmit}
          onFileSubmit={handleFileSubmit}
          onError={(e) => { setError(e); setResult(null); }}
          onLoading={setLoading}
          loading={loading}
          disabled={queueFull}
        />

        {loading && (
          <p style={{ textAlign: "center", color: "var(--muted)", marginTop: 20, fontSize: 13 }}>
            Analyzing beatmap… waiting for result
          </p>
        )}

        {error && <div style={errorStyle}>{error}</div>}

        {result && <ResultCard result={result} />}
        {result && user && <RelevanceSection result={result} currentUser={user} />}

        {/* Auth gate */}
        {!user && (
          <div className="osu-card" style={{ marginTop: 32, textAlign: "center" }}>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
              Log in with your osu! account to unlock map recommendations and playlists.
            </p>
            <a
              href={`${import.meta.env.VITE_API_URL ?? "http://localhost:8000"}/auth/login`}
              className="btn-pink"
              style={{ textDecoration: "none" }}
            >
              Login with osu!
            </a>
          </div>
        )}

        {user && (
          <RecommendationList currentUser={user} />
        )}

        <BeatmapsThisWeek currentUser={user} />

        {/* Public playlists section */}
        <PublicPlaylists onOpenPlaylist={u => setPage({ type: "playlist", username: u })} />

        {user && <BeatmapTagSearch currentUser={user} />}
      </div>
    </div>
  );
}

const rootStyle: React.CSSProperties = { minHeight: "100vh", background: "var(--bg)", color: "#fff" };

const mainStyle: React.CSSProperties = {
  maxWidth: 1280,
  margin: "0 auto",
  padding: "36px 24px 80px",
};

const headerStyle: React.CSSProperties = { textAlign: "center", marginBottom: 36 };

const h1Style: React.CSSProperties = {
  fontFamily: "var(--font-d)",
  fontSize: 26, fontWeight: 800, color: "#fff",
  letterSpacing: "0.02em", marginBottom: 8,
};

const subtitleStyle: React.CSSProperties = { color: "var(--muted)", fontSize: 14 };

const errorStyle: React.CSSProperties = {
  marginTop: 16, padding: "11px 16px",
  background: "#1e0a10", border: "1px solid #7f1d1d",
  borderRadius: 8, color: "#fca5a5", fontSize: 13,
};

function InfoTooltip() {
  const [visible, setVisible] = useState(false);
  return (
    <div
      style={{ position: "fixed", bottom: 20, right: 20, zIndex: 200, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {visible && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8,
          padding: "10px 14px", fontSize: 12, color: "var(--muted)", maxWidth: 240, lineHeight: 1.5,
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
          Analysis results are not 100% accurate. Your contributions when rating beatmaps
          in osu!lazer will greatly help improve the model.
        </div>
      )}
      <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--card)",
        border: "1px solid var(--border)", color: "var(--muted)", fontSize: 12, fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center", cursor: "default", userSelect: "none" }}>
        i
      </div>
    </div>
  );
}
