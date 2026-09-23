/**
 * osu! official difficulty colour spectrum.
 * Matches d3.scaleLinear with interpolateRgb.gamma(2.2).
 *
 * Domain:  [0.1, 1.25, 2, 2.5, 3.3, 4.2, 4.9, 5.8, 6.7, 7.7, 9]
 * Range:   #4290FB → #4FC0FF → #4FFFD5 → #7CFF4F → #F6F05C →
 *          #FF8068 → #FF4E6F → #C645B8 → #6563DE → #18158E → #000000
 */

const STOPS: [number, [number, number, number]][] = [
  [0.1,  [0x42, 0x90, 0xFB]],
  [1.25, [0x4F, 0xC0, 0xFF]],
  [2.0,  [0x4F, 0xFF, 0xD5]],
  [2.5,  [0x7C, 0xFF, 0x4F]],
  [3.3,  [0xF6, 0xF0, 0x5C]],
  [4.2,  [0xFF, 0x80, 0x68]],
  [4.9,  [0xFF, 0x4E, 0x6F]],
  [5.8,  [0xC6, 0x45, 0xB8]],
  [6.7,  [0x65, 0x63, 0xDE]],
  [7.7,  [0x18, 0x15, 0x8E]],
  [9.0,  [0x00, 0x00, 0x00]],
];

const GAMMA = 2.2;

function lerp(a: number, b: number, t: number): number {
  // Gamma-correct linear interpolation (same as d3.interpolateRgb.gamma(2.2))
  return Math.round(
    Math.pow(
      Math.pow(a / 255, GAMMA) * (1 - t) + Math.pow(b / 255, GAMMA) * t,
      1 / GAMMA,
    ) * 255,
  );
}

function toHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
}

export function starColor(rating?: number | null): string {
  if (rating == null || rating < 0.1) return "#aaaaaa";
  if (rating >= 9) return "#000000";

  // Find surrounding stops
  let lo = STOPS[0], hi = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (rating >= STOPS[i][0] && rating <= STOPS[i + 1][0]) {
      lo = STOPS[i];
      hi = STOPS[i + 1];
      break;
    }
  }

  const t = (rating - lo[0]) / (hi[0] - lo[0]);
  const [lr, lg, lb] = lo[1];
  const [hr, hg, hb] = hi[1];

  return toHex(lerp(lr, hr, t), lerp(lg, hg, t), lerp(lb, hb, t));
}
