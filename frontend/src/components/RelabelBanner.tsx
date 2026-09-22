import { useEffect, useState } from "react";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

interface RelabelState {
  running: boolean;
  total: number;
  done: number;
  failed: number;
  started_at: string | null;
}

export default function RelabelBanner() {
  const [state, setState] = useState<RelabelState | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`${BASE_URL}/relabel/status`);
        if (!res.ok) return;
        const data: RelabelState = await res.json();
        if (!cancelled) setState(data);
      } catch { /* backend not ready */ }
    }
    poll();
    const id = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (!state?.running) return null;

  const pct = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;

  return (
    <div style={bannerStyle}>
      <span style={dotStyle} />
      <span>
        Re-Labeling:{" "}
        <strong style={{ color: "#fff" }}>{state.done} / {state.total}</strong>
        {state.total > 0 && <span style={{ color: "var(--muted)", marginLeft: 6 }}>({pct}%)</span>}
        {state.failed > 0 && <span style={{ color: "#fca5a5", marginLeft: 8 }}>{state.failed} failed</span>}
      </span>
      <div style={barTrackStyle}>
        <div style={{ ...barFillStyle, width: `${pct}%` }} />
      </div>
    </div>
  );
}

const bannerStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  padding: "7px 24px",
  background: "var(--card2)",
  borderBottom: "1px solid var(--border)",
  fontSize: 12, color: "var(--muted)",
};

const dotStyle: React.CSSProperties = {
  width: 7, height: 7, borderRadius: "50%",
  background: "#ff66aa", flexShrink: 0,
  animation: "pulse 1.5s ease-in-out infinite",
};

const barTrackStyle: React.CSSProperties = {
  flex: 1, height: 3, background: "rgba(180,130,220,0.15)",
  borderRadius: 2, overflow: "hidden", maxWidth: 180,
};

const barFillStyle: React.CSSProperties = {
  height: "100%",
  background: "linear-gradient(90deg, #ff66aa, #cc3377)",
  borderRadius: 2, transition: "width 0.4s ease",
};
