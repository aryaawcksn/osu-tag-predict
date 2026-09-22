import { useEffect, useState } from "react";
import { getQueueState, getStats } from "../api";
import { QueueState, QueueJob } from "../types";

const STATUS_COLORS: Record<QueueJob["status"], string> = {
  waiting: "var(--muted)",
  processing: "#f59e0b",
  done: "#34d399",
  failed: "#f87171",
};

export default function QueueBar() {
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [stats, setStats] = useState<{ total_users: number; total_beatmaps: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchQ() {
      try {
        const s = await getQueueState();
        if (!cancelled) setQueueState(s);
      } catch {}
    }
    fetchQ();
    const id = setInterval(fetchQ, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchStats() {
      try {
        const s = await getStats();
        if (!cancelled) setStats(s);
      } catch {}
    }
    fetchStats();
    const id = setInterval(fetchStats, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (!queueState) return null;

  const { occupied_slots, total_capacity, jobs } = queueState;
  const activeJobs = jobs.filter((j) => j.status === "waiting" || j.status === "processing");

  return (
    <div style={barStyle}>
      {/* Queue slots */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-m)", letterSpacing: "0.06em" }}>QUEUE</span>
        <div style={{ display: "flex", gap: 3 }}>
          {Array.from({ length: total_capacity }).map((_, i) => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: 2,
              background: i < occupied_slots ? "#ff66aa" : "rgba(180,130,220,0.15)",
              transition: "background 0.3s",
            }} />
          ))}
        </div>
        <span style={{ fontSize: 11, color: "#ff66aa", fontFamily: "var(--font-m)", fontWeight: 600 }}>
          {occupied_slots}/{total_capacity}
        </span>
      </div>

      {activeJobs.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {activeJobs.map((job) => (
            <span key={job.id} style={badgeStyle(job.status)}>
              {job.status === "processing" ? "⚙ processing" : `#${job.position ?? "?"} waiting`}
            </span>
          ))}
        </div>
      )}

      {occupied_slots >= total_capacity && (
        <span style={{ fontSize: 11, color: "#f87171", flexShrink: 0 }}>Queue full</span>
      )}

      <div style={{ flex: 1 }} />

      {stats && (
        <div style={statsStyle}>
          <span title="Total registered users">👤 {stats.total_users.toLocaleString()}</span>
          <span style={{ color: "var(--border)" }}>|</span>
          <span title="Total beatmaps processed">🗂 {stats.total_beatmaps.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

const barStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 14,
  padding: "7px 24px",
  background: "var(--bg)",
  borderBottom: "1px solid var(--border)",
  overflowX: "auto", flexWrap: "wrap",
};

const statsStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  fontSize: 11, color: "var(--muted2)", flexShrink: 0,
};

function badgeStyle(status: QueueJob["status"]): React.CSSProperties {
  return {
    fontSize: 11, padding: "2px 8px", borderRadius: 4,
    background: "var(--card)",
    border: `1px solid ${STATUS_COLORS[status]}`,
    color: STATUS_COLORS[status],
    fontFamily: "var(--font-m)",
    whiteSpace: "nowrap",
  };
}
