// Fast integer trig over the original 65-entry quarter-wave sine table
// (fastmath.c). Angles are 0..255 (256 = 360deg). The table is the exact value
// extracted from MIDIMAZE.D8A (trunc(sin*256)), never recomputed (D-09, C-02).
import sineRaw from '../assets/generated/sine.json';
import { mulsDivs } from './fixed';

const SINE = sineRaw as readonly number[];

/** sin(angle)*factor, integer (fast_sin). */
export function fastSin(factor: number, angle: number): number {
  angle &= 255;
  if (angle >= 128) {
    angle -= 128;
    factor = -factor;
  }
  if (angle >= 64) angle = 128 - angle;
  return mulsDivs(factor, SINE[angle]!, 256);
}

/** cos(angle)*factor, integer (fast_cos). */
export function fastCos(factor: number, angle: number): number {
  return fastSin(factor, 64 - angle);
}

/**
 * Rotate (px,py) by `angle` (rotate2d): returns the new [px, py]. Components are
 * full ints (sums of int16 trig results), not re-truncated.
 */
export function rotate2d(px: number, py: number, angle: number): [number, number] {
  const rx = fastCos(px, angle) - fastSin(py, angle);
  const ry = fastSin(px, angle) + fastCos(py, angle);
  return [rx, ry];
}
