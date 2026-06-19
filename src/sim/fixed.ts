// Fixed-point integer helpers matching the 68000 / original C semantics (C-02).

/** Truncate to a signed 16-bit value (C `short` assignment). */
export function toInt16(v: number): number {
  return (v << 16) >> 16;
}

/**
 * `muls_divs(a,b,c)` (mulsdivs.c): `(a*b)/c` with 16-bit signed args and result
 * and a 32-bit intermediate product; the divide truncates toward zero. Returns
 * `a` when `c == 0` (BUGFIX_DIVISION_BY_ZERO).
 */
export function mulsDivs(a: number, b: number, c: number): number {
  a = toInt16(a);
  b = toInt16(b);
  c = toInt16(c);
  if (c === 0) return a;
  return toInt16(Math.trunc((a * b) / c));
}
