import { useCallback } from "react";
import { starColor, starTextColor } from "../utils/starColor";

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

  // Midpoint of the selected range for gradient color
  const midVal    = (valueMin + valueMax) / 2;
  const colorMin  = starColor(valueMin);
  const colorMid  = starColor(midVal);
  const colorMax  = starColor(valueMax);
  const labelMin  = starTextColor(valueMin);
  const labelMax  = starTextColor(valueMax);

  function handleMinChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Math.round(Math.min(Number(e.target.value), valueMax) * 10) / 10;
    onChange(v, valueMax);
  }
  function handleMaxChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Math.round(Math.max(Number(e.target.value), valueMin) * 10) / 10;
    onChange(valueMin, v);
  }

  const clamp = (p: number) => Math.min(Math.max(p, 0), 100);

  return (
    <div style={{ position: "relative", width: "100%", height: 68 }}>

      {/* Min label */}
      <span style={{
        position: "absolute",
        left: `${clamp(leftPct)}%`,
        top: 0,
        transform: "translateX(-50%)",
        fontSize: 10, fontFamily: "var(--font-m)", fontWeight: 700,
        color: labelMin, whiteSpace: "nowrap", pointerEvents: "none",
        lineHeight: "16px",
        textShadow: "0 1px 3px rgba(0,0,0,0.5)",
      }}>
        ★{valueMin.toFixed(1)}
      </span>

      {/* Track + thumbs */}
      <div style={{ position: "absolute", top: 24, left: 0, right: 0, height: 20 }}>
        {/* Track background */}
        <div style={{
          position: "absolute", top: "50%", left: 0, right: 0,
          transform: "translateY(-50%)",
          height: 3, borderRadius: 2,
          background: "rgba(255,102,170,0.12)",
          pointerEvents: "none",
        }} />

        {/* Active fill — spectrum gradient */}
        <div style={{
          position: "absolute", top: "50%", transform: "translateY(-50%)",
          left: `${leftPct}%`, width: `${Math.max(gapPct, 0)}%`,
          height: 3, borderRadius: 2,
          background: `linear-gradient(90deg, ${colorMin}, ${colorMid}, ${colorMax})`,
          pointerEvents: "none",
        }} />

        <input
          type="range" min={min} max={max} step={step} value={valueMin}
          onChange={handleMinChange}
          className="range-thumb range-thumb--spectrum"
          style={{ position: "absolute", inset: 0, width: "100%", margin: 0, "--thumb-color": colorMin } as React.CSSProperties}
        />
        <input
          type="range" min={min} max={max} step={step} value={valueMax}
          onChange={handleMaxChange}
          className="range-thumb range-thumb--spectrum"
          style={{ position: "absolute", inset: 0, width: "100%", margin: 0, "--thumb-color": colorMax } as React.CSSProperties}
        />
      </div>

      {/* Max label */}
      <span style={{
        position: "absolute",
        left: `${clamp(rightPct)}%`,
        top: 52,
        transform: "translateX(-50%)",
        fontSize: 10, fontFamily: "var(--font-m)", fontWeight: 700,
        color: labelMax, whiteSpace: "nowrap", pointerEvents: "none",
        lineHeight: "16px",
        textShadow: "0 1px 3px rgba(0,0,0,0.5)",
      }}>
        ★{valueMax.toFixed(1)}
      </span>
    </div>
  );
}
