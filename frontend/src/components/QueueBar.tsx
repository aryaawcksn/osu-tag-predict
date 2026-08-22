import { useEffect, useState } from "react";
import { getQueueState } from "../api";
import { QueueState, QueueJob } from "../types";

// Status badge colors
const STATUS_COLORS: Record<QueueJob["status"], string> = {
  waiting: "#a7a9be",
  processing: "#f59e0b",
  done: "#34d399",
  failed: "#f87171",
};

// QueueBar polls /queue/state every 2 seconds and displays slot usage + active jobs
// Requirements 1.1, 1.5, 1.6
export default function QueueBar() {
  const [queueState, setQueueState] = useState<QueueState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchState() {
      try {
        const state = await getQueueState();
        if (!cancelled) setQueueState(state);
      } catch {
        // Silently ignore fetch errors — backend may be starting up
      }
    }

    fetchState();
    const interval = setInterval(fetchState, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!queueState) return null;

  const { occupied_slots, total_capacity, jobs } = queueState;
  const activeJobs = jobs.filter((j) => j.status === "waiting" || j.status === "processing");

  return (
    <div style={barStyle}>
      {/* Slot indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: "#a7a9be" }}>Queue</span>
        <div style={{ display: "flex", gap: 4 }}>
          {Array.from({ length: total_capacity }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: i < occupied_slots ? "#ff6b9d" : "#2e2d3d",
                transition: "background 0.3s",
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: 12, color: "#a7a9be" }}>
          {occupied_slots}/{total_capacity}
        </span>
      </div>

      {/* Active job list */}
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
