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

  if (!state?.running && !state?.done) return null;
  // Hide when fully done and not running
  if (!state.running && state.done > 0 && state.done >= state.total) return null;
  if (!state.running) return null;

  const pct = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;

  return (
    <div style={bannerStyle}>
      <span style={dotStyle} />
      <span>
        Re-Labeling Beatmaps:{" "}
        <strong style={{ color: "#fffffe" }}>
          {state.done} / {state.total}
        </strong>
        {state.total > 0 && (
          <span style={{ color: "#a7a9be", marginLeft: 6 }}>({pct}%)</span>
        )}
        {state.failed > 0 && (
          <span style={{ color: "#fca5a5", marginLeft: 8 }}>
            {state.failed} failed
          </span>
        )}
      </span>
      <div style={barTrackStyle}>
        <div style={{ ...barFillStyle, width: `${pct}%` }} />
      </div>
    </div>
  );
}

const bannerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 24px",
  background: "#12111f",
  borderBottom: "1px solid #2e2d3d",
  fontSize: 13,
  color: "#a7a9be",
};

const dotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#ff6b9d",
  flexShrink: 0,
  boxShadow: "0 0 6px #ff6b9d",
  animation: "pulse 1.5s ease-in-out infinite",
};

const barTrackStyle: React.CSSProperties = {
  flex: 1,
  height: 4,
  background: "#2e2d3d",
  borderRadius: 2,
  overflow: "hidden",
  maxWidth: 200,
};

const barFillStyle: React.CSSProperties = {
  height: "100%",
  background: "#ff6b9d",
  borderRadius: 2,
  transition: "width 0.4s ease",
};
