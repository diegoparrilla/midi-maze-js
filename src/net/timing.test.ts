import { describe, expect, it } from 'vitest';
import { AdaptiveTimeout, bandFromParams, DEFAULT_BAND } from './timing';

describe('AdaptiveTimeout', () => {
  it('returns the ceiling before any RTT sample (max tolerance for the first ticks)', () => {
    expect(new AdaptiveTimeout().next()).toBe(DEFAULT_BAND.ceilingMs);
    expect(new AdaptiveTimeout().rttEwma).toBeNull();
  });

  it('clamps RTT × multiplier to the floor for a fast ring', () => {
    const a = new AdaptiveTimeout();
    a.update(100); // 100 × 4 = 400 < floor
    expect(a.next()).toBe(DEFAULT_BAND.floorMs);
  });

  it('scales with RTT in the middle of the band', () => {
    const a = new AdaptiveTimeout();
    a.update(500); // 500 × 4 = 2000, within [1500, 8000]
    expect(a.next()).toBe(2000);
  });

  it('clamps to the ceiling for a very slow ring', () => {
    const a = new AdaptiveTimeout();
    a.update(5000); // 5000 × 4 = 20000 > ceiling
    expect(a.next()).toBe(DEFAULT_BAND.ceilingMs);
  });

  it('smooths the RTT estimate (EWMA), not just the last sample', () => {
    const a = new AdaptiveTimeout();
    a.update(100);
    a.update(900); // 0.25*900 + 0.75*100 = 300
    expect(a.rttEwma).toBe(300);
  });
});

describe('bandFromParams', () => {
  const band = (qs: string) => bandFromParams(new URLSearchParams(qs));

  it('uses defaults with no params', () => {
    expect(band('')).toEqual(DEFAULT_BAND);
  });

  it('?tickTimeout raises the ceiling', () => {
    expect(band('tickTimeout=12000').ceilingMs).toBe(12000);
  });

  it('?tickFloor sets the floor', () => {
    expect(band('tickFloor=500').floorMs).toBe(500);
  });

  it('pins a fixed deadline when floor and ceiling coincide', () => {
    const b = band('tickTimeout=3000&tickFloor=3000');
    expect([b.floorMs, b.ceilingMs]).toEqual([3000, 3000]);
  });

  it('never lets the floor exceed the ceiling', () => {
    const b = band('tickTimeout=1000&tickFloor=5000');
    expect(b.floorMs).toBe(1000);
    expect(b.ceilingMs).toBe(1000);
  });

  it('ignores invalid values', () => {
    expect(band('tickTimeout=abc&tickFloor=-5')).toEqual(DEFAULT_BAND);
  });
});
