import { describe, expect, it } from 'vitest';
import { describeDivergence, firstDivergence } from './divergence';

const row = (y: number, x: number): Record<string, number> => ({ y, x });

describe('firstDivergence', () => {
  it('returns null for identical traces', () => {
    const t = [[row(1, 2), row(3, 4)], [row(5, 6)]];
    expect(
      firstDivergence(
        t,
        t.map((tick) => tick.map((p) => ({ ...p }))),
      ),
    ).toBeNull();
  });

  it('finds the first differing field, scanning ticks then players then fields', () => {
    const a = [
      [row(1, 2), row(3, 4)],
      [row(5, 6), row(7, 8)],
    ];
    const b = [
      [row(1, 2), row(3, 4)],
      [row(5, 6), row(7, 99)],
    ];
    expect(firstDivergence(a, b)).toEqual({
      tick: 1,
      player: 1,
      field: 'x',
      expected: 8,
      actual: 99,
    });
  });

  it('reports the earliest tick even if a later one also differs', () => {
    const a = [[row(1, 1)], [row(2, 2)]];
    const b = [[row(1, 9)], [row(2, 9)]];
    expect(firstDivergence(a, b)?.tick).toBe(0);
  });

  it('reports a tick-count mismatch when one trace is shorter', () => {
    const a = [[row(1, 1)], [row(2, 2)]];
    const b = [[row(1, 1)]];
    expect(firstDivergence(a, b)).toEqual({
      tick: 1,
      player: -1,
      field: 'ticks',
      expected: 2,
      actual: 1,
    });
  });

  it('describeDivergence is human-readable for both kinds', () => {
    expect(describeDivergence({ tick: 3, player: 2, field: 'dir', expected: 64, actual: 65 })).toBe(
      'desync at tick 3, player 2, field "dir": expected 64, got 65',
    );
    expect(
      describeDivergence({ tick: 5, player: -1, field: 'ticks', expected: 10, actual: 5 }),
    ).toContain('trace length mismatch');
  });
});
