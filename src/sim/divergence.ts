// Pinpoint the first divergence between two full-tick traces (each tick = an array of
// per-player field records). Turns a "the sim desynced somewhere in 64 ticks × 8 players"
// failure into a precise (tick, player, field, expected, actual) locator — the diagnostic
// half of EPIC-17, and the same idea the EPIC-18 live checksum uses at runtime.

export interface Divergence {
  tick: number;
  /** -1 when the traces differ only in length (see `field: 'ticks'`/`'players'`). */
  player: number;
  field: string;
  expected: number;
  actual: number;
}

type Row = Record<string, number>;

/** The first differing field scanning ticks → players → fields, or null if identical
 *  over their common extent (a length mismatch is reported as its own divergence). */
export function firstDivergence(
  expected: readonly Row[][],
  actual: readonly Row[][],
): Divergence | null {
  const ticks = Math.min(expected.length, actual.length);
  for (let t = 0; t < ticks; t++) {
    const e = expected[t]!;
    const a = actual[t]!;
    const players = Math.min(e.length, a.length);
    for (let p = 0; p < players; p++) {
      for (const field of Object.keys(e[p]!)) {
        if (e[p]![field] !== a[p]![field]) {
          return { tick: t, player: p, field, expected: e[p]![field]!, actual: a[p]![field]! };
        }
      }
    }
    if (e.length !== a.length) {
      return { tick: t, player: -1, field: 'players', expected: e.length, actual: a.length };
    }
  }
  if (expected.length !== actual.length) {
    return {
      tick: ticks,
      player: -1,
      field: 'ticks',
      expected: expected.length,
      actual: actual.length,
    };
  }
  return null;
}

/** A one-line, human-readable description of a divergence (for test failure messages). */
export function describeDivergence(d: Divergence): string {
  if (d.player < 0)
    return `trace length mismatch (${d.field}): expected ${d.expected}, got ${d.actual}`;
  return `desync at tick ${d.tick}, player ${d.player}, field "${d.field}": expected ${d.expected}, got ${d.actual}`;
}
