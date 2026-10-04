import { useCallback } from "react";

interface Props {
  min: number;
  max: number;
  step: number;
  valueMin: number;
  valueMax: number;
  onChange: (min: number, max: number) => void;
}

export default function RangeSlider({ min, max, step, valueMin, valueMax, onChange }: Props) {
  const pct = useCallback(
    (v: number) => ((v - min) / (max - min)) * 100,
    [min, max],
  );

  const leftPct  = pct(valueMin);
  const rightPct = pct(valueMax);
  const gapPct   = rightPct - leftPct;

  function handleMinChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Math.round(Math.min(Number(e.target.value), valueMax) * 10) / 10;
    onChange(v, valueMax);
  }
  function handleMaxChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Math.round(Math.max(Number(e.target.value), valueMin) * 10) / 10;
    onChange(valueMin, v);
  }

  const clamp = (p: number) => Math.min(Math.max(p, 0), 100);

  // Layout: 16px top label + 8px gap + 20px track + 8px gap + 16px bottom label = 68px total
  return (
    <div style={{ position: "relative", width: "100%", height: 68 }}>

      {/* Min label — always ABOVE track */}
      <span style={{
        position: "absolute",
        left: `${clamp(leftPct)}%`,
        top: 0,
        transform: "translateX(-50%)",
        fontSize: 10, fontFamily: "var(--font-m)", fontWeight: 700,
        color: "var(--pink)", whiteSpace: "nowrap", pointerEvents: "none",
        lineHeight: "16px",
      }}>
        ★{valueMin.toFixed(1)}
      </span>

      {/* Track + thumbs — top: 24 (16px label + 8px gap) */}
      <div style={{ position: "absolute", top: 24, left: 0, right: 0, height: 20 }}>
        {/* Track background */}
        <div style={{
          position: "absolute", top: "50%", left: 0, right: 0,
          transform: "translateY(-50%)",
          height: 3, borderRadius: 2,
          background: "rgba(255,102,170,0.12)",
          pointerEvents: "none",
        }} />

        {/* Active fill */}
        <div style={{
          position: "absolute", top: "50%", transform: "translateY(-50%)",
          left: `${leftPct}%`, width: `${Math.max(gapPct, 0)}%`,
          height: 3, borderRadius: 2,
          background: "linear-gradient(90deg, var(--pink), var(--pink-dim))",
          pointerEvents: "none",
        }} />

        <input
          type="range" min={min} max={max} step={step} value={valueMin}
          onChange={handleMinChange}
          className="range-thumb"
          style={{ position: "absolute", inset: 0, width: "100%", margin: 0 }}
        />
        <input
          type="range" min={min} max={max} step={step} value={valueMax}
          onChange={handleMaxChange}
          className="range-thumb"
          style={{ position: "absolute", inset: 0, width: "100%", margin: 0 }}
        />
      </div>

      {/* Max label — always BELOW track, top: 24 + 20 + 8 = 52 */}
      <span style={{
        position: "absolute",
        left: `${clamp(rightPct)}%`,
        top: 52,
        transform: "translateX(-50%)",
        fontSize: 10, fontFamily: "var(--font-m)", fontWeight: 700,
        color: "var(--pink)", whiteSpace: "nowrap", pointerEvents: "none",
        lineHeight: "16px",
      }}>
        ★{valueMax.toFixed(1)}
      </span>
    </div>
  );
}
