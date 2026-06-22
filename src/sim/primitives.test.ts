import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import sineRaw from '../assets/generated/sine.json';
import { mulsDivs } from './fixed';
import { Rng } from './rng';
import { PLAYER_MOTION_SPEED, xySpeedTable } from './speed-table';
import { fastCos, fastSin, rotate2d } from './trig';

interface Golden {
  playerMotionSpeed: number;
  sine: number[];
  mulsDivs: { a: number; b: number; c: number; r: number }[];
  fastSin256: number[];
  fastCos256: number[];
  fastSinFactors: { factor: number; angle: number; v: number }[];
  rotate: { x: number; y: number; angle: number; rx: number; ry: number }[];
  speedTable: { deltaY: number; deltaX: number }[];
  rng: {
    seed: number;
    random: number[];
    rnd14: number[];
    rnd256: number[];
    randomLong: number[];
    rndByMax: { max: number; seq: number[] }[];
  };
}

const golden: Golden = JSON.parse(
  readFileSync(fileURLToPath(new URL('./golden/primitives.json', import.meta.url)), 'utf8'),
) as Golden;

describe('golden harness sanity', () => {
  it("the C harness's libm sine table equals the extracted .D8A table", () => {
    expect(golden.sine).toEqual(sineRaw);
  });
  it('agrees on PLAYER_MOTION_SPEED', () => {
    expect(golden.playerMotionSpeed).toBe(PLAYER_MOTION_SPEED);
  });
});

describe('mulsDivs vs C', () => {
  it('matches every case (incl. negatives, truncation, c=0)', () => {
    for (const { a, b, c, r } of golden.mulsDivs) {
      expect(mulsDivs(a, b, c)).toBe(r);
    }
  });
});

describe('trig vs C', () => {
  it('fastSin(256, angle) matches for all 256 angles', () => {
    for (let a = 0; a < 256; a++) expect(fastSin(256, a)).toBe(golden.fastSin256[a]);
  });
  it('fastCos(256, angle) matches for all 256 angles', () => {
    for (let a = 0; a < 256; a++) expect(fastCos(256, a)).toBe(golden.fastCos256[a]);
  });
  it('fastSin matches across sampled factors', () => {
    for (const { factor, angle, v } of golden.fastSinFactors) {
      expect(fastSin(factor, angle)).toBe(v);
    }
  });
  it('rotate2d matches the sampled vectors', () => {
    for (const { x, y, angle, rx, ry } of golden.rotate) {
      expect(rotate2d(x, y, angle)).toEqual([rx, ry]);
    }
  });
});

describe('speed table vs C', () => {
  it('matches all 256 directions', () => {
    expect(xySpeedTable).toHaveLength(256);
    for (let a = 0; a < 256; a++) expect(xySpeedTable[a]).toEqual(golden.speedTable[a]);
  });
});

describe('shared RNG vs C', () => {
  it('reproduces _random(), _rnd(14), and _rnd(256) sequences', () => {
    const rng = new Rng();

    rng.setSeed(golden.rng.seed);
    expect(golden.rng.random.map(() => rng.random())).toEqual(golden.rng.random);

    rng.setSeed(golden.rng.seed);
    expect(golden.rng.rnd14.map(() => rng.rnd(14))).toEqual(golden.rng.rnd14);

    rng.setSeed(golden.rng.seed);
    expect(golden.rng.rnd256.map(() => rng.rnd(256))).toEqual(golden.rng.rnd256);
  });

  it('stays in sync over a long run (16-bit truncation drift, C-02)', () => {
    const rng = new Rng();
    rng.setSeed(golden.rng.seed);
    const checkpoints = new Set([99, 999, 9999, 49999]);
    const got: number[] = [];
    for (let i = 0; i <= 49999; i++) {
      const v = rng.random();
      if (checkpoints.has(i)) got.push(v);
    }
    expect(got).toEqual(golden.rng.randomLong);
  });

  it('reproduces _rnd across maxVals (rejection-sampling thresholds)', () => {
    for (const { max, seq } of golden.rng.rndByMax) {
      const rng = new Rng();
      rng.setSeed(golden.rng.seed);
      expect(seq.map(() => rng.rnd(max))).toEqual(seq);
    }
  });
});
