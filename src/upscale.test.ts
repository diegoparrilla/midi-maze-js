import { describe, expect, it } from 'vitest';
import { BASE_HEIGHT, BASE_WIDTH, integerScale } from './upscale';

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
