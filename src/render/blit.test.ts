import { describe, expect, it } from 'vitest';
import { blitRuns } from './blit';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
class FakeCtx {
  fillStyle = '';
  calls: Rect[] = [];
  fillRect(x: number, y: number, w: number, h: number): void {
    this.calls.push({ x, y, w, h });
  }
}
const ctx = (): FakeCtx => new FakeCtx();
const run = (c: FakeCtx) => c as unknown as CanvasRenderingContext2D;

/** The set of "x,y" pixels covered by the recorded fillRect calls. */
function covered(c: FakeCtx): Set<string> {
  const px = new Set<string>();
  for (const r of c.calls) {
    expect(r.h).toBe(1); // we only ever emit 1px-tall runs
    for (let i = 0; i < r.w; i++) px.add(`${r.x + i},${r.y}`);
  }
  return px;
}

describe('blitRuns', () => {
  it('coalesces a run of set bits into one fillRect', () => {
    const c = ctx();
    blitRuns(run(c), [0xe000], 0, 1, 1, 10, 20); // bits 0,1,2 set
    expect(c.calls).toEqual([{ x: 10, y: 20, w: 3, h: 1 }]);
  });

  it('emits a separate run per gap', () => {
    const c = ctx();
    blitRuns(run(c), [0xa000], 0, 1, 1, 0, 0); // bits 0 and 2
    expect(c.calls).toEqual([
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 2, y: 0, w: 1, h: 1 },
    ]);
  });

  it('a full row is a single 16-wide fillRect (16 pixels → 1 call)', () => {
    const c = ctx();
    blitRuns(run(c), [0xffff], 0, 1, 1, 5, 7);
    expect(c.calls).toEqual([{ x: 5, y: 7, w: 16, h: 1 }]);
  });

  it('draws nothing for an empty row', () => {
    const c = ctx();
    blitRuns(run(c), [0x0000], 0, 1, 1, 0, 0);
    expect(c.calls).toEqual([]);
  });

  it('honours startRow into a multi-frame table', () => {
    const c = ctx();
    blitRuns(run(c), [0x0000, 0xf000], 1, 1, 1, 3, 4); // skip row 0, draw row 1 (bits 0-3)
    expect(c.calls).toEqual([{ x: 3, y: 4, w: 4, h: 1 }]);
  });

  it('covers exactly the set pixels of a 2-row, 2-word mask', () => {
    const c = ctx();
    // row0: word0 = 0x8001 (bits 0 and 15), word1 = 0xC000 (bits 16,17)
    // row1: word0 = 0x0000, word1 = 0x0001 (bit 31)
    const rows = [0x8001, 0xc000, 0x0000, 0x0001];
    blitRuns(run(c), rows, 0, 2, 2, 0, 0);
    expect(covered(c)).toEqual(new Set(['0,0', '15,0', '16,0', '17,0', '31,1']));
  });
});
