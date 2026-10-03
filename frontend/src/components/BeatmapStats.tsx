// ── Beatmap stats display: battery-style bars ────────────────────────────────

interface StatsProps {
  ar?: number | null;
  cs?: number | null;
  od?: number | null;
  objectCount?: number | null;
  difficultyRating?: number | null;
  starColor: string;
}

const STATS = [
  { key: "AR", max: 10 },
  { key: "CS", max: 10 },
  { key: "OD", max: 10 },
  { key: "OBJ", max: 2000 },
] as const;

function fmt(n?: number | null, d = 1): string {
  if (n == null) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(d);
}

function BatteryBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  const segments = 8;

  return (
    <div
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: `repeat(${segments}, minmax(0, 1fr))`,
        gap: 2,
        minWidth: 0,
        height: 11,
        padding: "2px 3px",
        border: "1px solid rgba(255, 255, 255, 0.14)",
        background: "rgba(0, 0, 0, 0.35)",
        clipPath: "polygon(5px 0, 100% 0, calc(100% - 5px) 100%, 0 100%)",
      }}
    >
      {Array.from({ length: segments }).map((_, i) => {
        const threshold = ((i + 1) / segments) * 100;
        const filled = pct >= threshold;
        const partial = !filled && pct > (i / segments) * 100;

        return (
          <div
            key={i}
            style={{
              minWidth: 0,
              border: `1px solid ${filled ? color : "rgba(255,255,255,0.15)"}`,
              background: filled ? color : partial ? `${color}40` : "transparent",
              transform: "skewX(-14deg)",
              boxShadow: filled ? `0 0 4px ${color}66` : "none",
              transition: "background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
            }}
          />
        );
      })}
    </div>
  );
}

export function BeatmapStats({ ar, cs, od, objectCount, difficultyRating, starColor: col }: StatsProps) {
  const values: Record<string, number | null | undefined> = { AR: ar, CS: cs, OD: od, OBJ: objectCount };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Difficulty rating bar - on top */}
      {difficultyRating != null && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            background: `linear-gradient(135deg, ${col}18, ${col}08)`,
            border: `1px solid ${col}35`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span
              style={{
                fontFamily: "var(--font-m)",
                fontSize: "0.62rem",
                color: "#77778c",
                letterSpacing: "0.06em",
                fontWeight: 600,
                lineHeight: 1,
              }}
            >
              DIFF
            </span>
            <span
              style={{
                fontFamily: "var(--font-d)",
                fontSize: 13,
                fontWeight: 800,
                color: col,
                letterSpacing: "0.02em",
              }}
            >
              ★ {difficultyRating.toFixed(2)}
            </span>
          </div>
          <div
            style={{
              height: 4,
              borderRadius: 2,
              overflow: "hidden",
              background: "rgba(255,255,255,0.08)",
            }}
          >
            <div
              style={{
                width: `${Math.min((difficultyRating / 10) * 100, 100)}%`,
                height: "100%",
                borderRadius: 2,
                background: `linear-gradient(90deg, ${col}ee, ${col}88)`,
                boxShadow: `0 0 6px ${col}66`,
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* AR CS OD OBJ battery bars - in 2x2 grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "7px 12px",
          padding: 10,
          background:
            "linear-gradient(135deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.015)), #13111d",
          border: "1px solid rgba(180, 130, 220, 0.14)",
          borderRadius: 8,
        }}
      >
        {STATS.map(({ key, max }) => {
          const raw = values[key];
          if (raw == null) return null;
          const label = key === "OBJ" ? fmt(raw, 0) : fmt(raw);

          return (
            <div
              key={key}
              style={{
                display: "grid",
                gridTemplateColumns: "25px minmax(50px, 1fr) 38px",
                alignItems: "center",
                gap: 6,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-m)",
                  fontSize: "0.62rem",
                  fontWeight: 600,
                  lineHeight: 1,
                  color: "#77778c",
                  letterSpacing: "0.06em",
                }}
              >
                {key}
              </span>
              <BatteryBar value={raw} max={max} color={col} />
              <span
                style={{
                  fontFamily: "var(--font-m)",
                  fontSize: "0.62rem",
                  fontWeight: 600,
                  lineHeight: 1,
                  color: col,
                  overflow: "hidden",
                  textAlign: "right",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
