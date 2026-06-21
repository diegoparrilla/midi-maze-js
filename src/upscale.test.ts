import { describe, expect, it } from 'vitest';
import { BASE_HEIGHT, BASE_WIDTH, displaySize, integerScale } from './upscale';

describe('integerScale', () => {
  it('returns native base dimensions of 320x200', () => {
    expect([BASE_WIDTH, BASE_HEIGHT]).toEqual([320, 200]);
  });

  it('picks the largest integer factor that fits both axes', () => {
    // 1280x800 = exactly 4x; 1300x810 still caps at 4x (no fractional scaling).
    expect(integerScale(1280, 800)).toBe(4);
    expect(integerScale(1300, 810)).toBe(4);
  });

  it('is limited by the tighter axis', () => {
    // Wide but short: height (200*3=600 <= 640, 200*4=800 > 640) caps at 3x.
    expect(integerScale(4000, 640)).toBe(3);
  });

  it('never scales below 1x', () => {
    expect(integerScale(100, 100)).toBe(1);
  });
});

describe('displaySize', () => {
  it('fills the viewport height on touch, keeping 16:10 and centering', () => {
    // Landscape phone 844x390 -> height filled, width = round(390*320/200) = 624.
    expect(displaySize(844, 390, true)).toEqual({ width: 624, height: 390 });
  });

  it('clamps to viewport width when filling height would overflow', () => {
    // Tall/narrow: width 800*1.6=1280 > 300 -> clamp to width 300,
    // height round(300*200/320) = round(187.5) = 188.
    expect(displaySize(300, 800, true)).toEqual({ width: 300, height: 188 });
  });

  it('uses the largest integer upscale on desktop (no fill)', () => {
    // 1000x700 -> integerScale 3 -> 960x600.
    expect(displaySize(1000, 700, false)).toEqual({ width: 960, height: 600 });
  });
});
