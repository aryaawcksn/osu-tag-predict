import { useEffect, useState } from "react";
import { getQueueState, getStats } from "../api";
import { QueueState, QueueJob } from "../types";

const STATUS_COLORS: Record<QueueJob["status"], string> = {
  waiting: "#a7a9be",
  processing: "#f59e0b",
  done: "#34d399",
  failed: "#f87171",
};

export default function QueueBar() {
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [stats, setStats] = useState<{ total_users: number; total_beatmaps: number } | null>(null);

  // Queue polling — every 2s
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

  // Stats polling — every 5 minutes
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
        <span style={{ fontSize: 12, color: "#a7a9be" }}>Queue</span>
        <div style={{ display: "flex", gap: 4 }}>
          {Array.from({ length: total_capacity }).map((_, i) => (
            <div key={i} style={{
              width: 10, height: 10, borderRadius: 2,
              background: i < occupied_slots ? "#ff6b9d" : "#2e2d3d",
              transition: "background 0.3s",
            }} />
          ))}
        </div>
        <span style={{ fontSize: 12, color: "#a7a9be" }}>
          {occupied_slots}/{total_capacity}
        </span>
      </div>

      {/* Active jobs */}
      {activeJobs.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {activeJobs.map((job) => (
            <span key={job.id} style={badgeStyle(job.status)}>
              {job.status === "processing" ? "⚙ processing" : `#${job.position ?? "?"} waiting`}
            </span>
          ))}
        </div>
      )}

      {occupied_slots >= total_capacity && (
        <span style={{ fontSize: 12, color: "#f87171", flexShrink: 0 }}>Queue full</span>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Stats */}
      {stats && (
        <div style={statsStyle}>
          <span title="Total registered users">
            👤 {stats.total_users.toLocaleString()}
          </span>
          <span style={{ color: "#2e2d3d" }}>|</span>
          <span title="Total beatmaps processed">
            🗂 {stats.total_beatmaps.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}

const barStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  padding: "8px 24px",
  background: "#0f0e17",
  borderBottom: "1px solid #2e2d3d",
  overflowX: "auto",
  flexWrap: "wrap",
};

const statsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  color: "#636e72",
  flexShrink: 0,
};

function badgeStyle(status: QueueJob["status"]): React.CSSProperties {
  return {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 4,
    background: "#1a1929",
    border: `1px solid ${STATUS_COLORS[status]}`,
    color: STATUS_COLORS[status],
    whiteSpace: "nowrap",
  };
}
