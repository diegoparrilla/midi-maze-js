import { describe, expect, it } from 'vitest';
import { FixedTimestep, TICK_INTERVAL_MS } from './pacer';

describe('FixedTimestep', () => {
  it('runs exactly one tick on the first frame', () => {
    const p = new FixedTimestep();
    expect(p.advance(1000)).toBe(1);
  });

  it('yields one tick per elapsed interval and zero when no time passed', () => {
    const p = new FixedTimestep();
    p.advance(0);
    expect(p.advance(TICK_INTERVAL_MS)).toBe(1);
    expect(p.advance(TICK_INTERVAL_MS)).toBe(0);
  });

  it('catches up multiple ticks across a slow frame', () => {
    const p = new FixedTimestep();
    p.advance(0);
    expect(p.advance(3 * TICK_INTERVAL_MS)).toBe(2); // 2 whole intervals since last
  });

  it('carries the sub-interval remainder forward', () => {
    const p = new FixedTimestep();
    p.advance(0);
    expect(p.advance(1.5 * TICK_INTERVAL_MS)).toBe(1); // 0.5 banked
    expect(p.advance(2.0 * TICK_INTERVAL_MS)).toBe(1); // 0.5 + 0.5 = 1.0
  });

  it('caps catch-up and drops the backlog after a long stall (backgrounded tab)', () => {
    const p = new FixedTimestep();
    p.advance(0);
    expect(p.advance(100_000)).toBe(4); // capped at MAX_CATCHUP
    expect(p.advance(100_000)).toBe(0); // backlog dropped, not banked
  });

  it('reset() restarts the first-frame behaviour', () => {
    const p = new FixedTimestep();
    p.advance(1000);
    p.advance(1000 + 10 * TICK_INTERVAL_MS);
    p.reset();
    expect(p.advance(5000)).toBe(1);
  });
});
