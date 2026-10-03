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
  const segments = 10;

  return (
    <div style={{ display: "flex", gap: 1.5, alignItems: "center" }}>
      {Array.from({ length: segments }).map((_, i) => {
        const threshold = ((i + 1) / segments) * 100;
        const filled = pct >= threshold;
        const partial = !filled && pct > (i / segments) * 100;
        const partialPct = partial ? ((pct - (i / segments) * 100) / (100 / segments)) * 100 : 0;

        return (
          <div
            key={i}
            style={{
              width: 7,
              height: 14,
              clipPath: "polygon(20% 0%, 80% 0%, 100% 50%, 80% 100%, 20% 100%, 0% 50%)",
              background: filled
                ? `${color}dd`
                : partial
                ? `linear-gradient(90deg, ${color}dd ${partialPct}%, rgba(255,255,255,0.08) ${partialPct}%)`
                : "rgba(255,255,255,0.08)",
              border: filled || partial ? "none" : "1px solid rgba(255,255,255,0.12)",
              boxShadow: filled ? `0 0 3px ${color}55` : "none",
              transition: "all 0.2s ease",
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
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {/* Difficulty rating bar - on top */}
      {difficultyRating != null && (
        <div style={{
          padding: "6px 10px",
          borderRadius: 6,
          background: `linear-gradient(135deg, ${col}15, ${col}08)`,
          border: `1px solid ${col}30`,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{
              fontFamily: "var(--font-m)", fontSize: 9, color: "var(--muted2)",
              letterSpacing: "0.06em", fontWeight: 600,
            }}>
              DIFFICULTY
            </span>
            <span style={{
              fontFamily: "var(--font-d)", fontSize: 12, fontWeight: 800,
              color: col, letterSpacing: "0.02em",
            }}>
              ★ {difficultyRating.toFixed(2)}
            </span>
          </div>
          <div style={{
            height: 4, borderRadius: 2, overflow: "hidden",
            background: "rgba(255,255,255,0.08)",
          }}>
            <div style={{
              width: `${Math.min((difficultyRating / 10) * 100, 100)}%`,
              height: "100%", borderRadius: 2,
              background: `linear-gradient(90deg, ${col}ee, ${col}88)`,
              boxShadow: `0 0 6px ${col}66`,
              transition: "width 0.3s ease",
            }} />
          </div>
        </div>
      )}

      {/* AR CS OD OBJ battery bars - in 2x2 grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 6,
      }}>
        {STATS.map(({ key, max }) => {
          const raw = values[key];
          if (raw == null) return null;
          const label = key === "OBJ" ? fmt(raw, 0) : fmt(raw);

          return (
            <div key={key} style={{
              padding: "5px 8px",
              borderRadius: 5,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{
                  fontFamily: "var(--font-m)", fontSize: 8, color: "var(--muted2)",
                  letterSpacing: "0.06em", fontWeight: 600,
                }}>
                  {key}
                </span>
                <span style={{
                  fontFamily: "var(--font-m)", fontSize: 9, color: col,
                  fontWeight: 700,
                }}>
                  {label}
                </span>
              </div>
              <BatteryBar value={raw} max={max} color={col} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
