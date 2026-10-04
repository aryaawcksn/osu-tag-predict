import { useRef, useCallback } from "react";

interface Props {
  min: number;
  max: number;
  step: number;
  valueMin: number;
  valueMax: number;
  onChange: (min: number, max: number) => void;
}

/**
 * Dual-handle range slider using two overlapping <input type="range">.
 * Works without any external library.
 */
export default function RangeSlider({ min, max, step, valueMin, valueMax, onChange }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  const pct = useCallback((v: number) => ((v - min) / (max - min)) * 100, [min, max]);

  const leftPct  = pct(valueMin);
  const rightPct = pct(valueMax);

  function handleMinChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Math.min(Number(e.target.value), valueMax - step);
    onChange(v, valueMax);
  }

  function handleMaxChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Math.max(Number(e.target.value), valueMin + step);
    onChange(valueMin, v);
  }

  return (
    <div ref={trackRef} style={{ position: "relative", height: 20, width: "100%" }}>
      {/* Track background */}
      <div style={{
        position: "absolute", top: "50%", left: 0, right: 0,
        transform: "translateY(-50%)",
        height: 3, borderRadius: 2,
        background: "rgba(255,102,170,0.12)",
      }} />

      {/* Active range fill */}
      <div style={{
        position: "absolute", top: "50%", transform: "translateY(-50%)",
        left: `${leftPct}%`, width: `${rightPct - leftPct}%`,
        height: 3, borderRadius: 2,
        background: "linear-gradient(90deg, var(--pink), var(--pink-dim))",
        pointerEvents: "none",
      }} />

      {/* Min thumb */}
      <input
        type="range" min={min} max={max} step={step} value={valueMin}
        onChange={handleMinChange}
        className="range-thumb"
      />

      {/* Max thumb */}
      <input
        type="range" min={min} max={max} step={step} value={valueMax}
        onChange={handleMaxChange}
        className="range-thumb"
      />
    </div>
  );
}

const thumbStyle: React.CSSProperties = {
  position: "absolute",
  top: 0, left: 0, right: 0, bottom: 0,
  width: "100%",
  margin: 0, padding: 0,
  appearance: "none" as const,
  WebkitAppearance: "none" as const,
  background: "transparent",
  pointerEvents: "none",
  // each thumb still needs pointer events
  cursor: "pointer",
};
