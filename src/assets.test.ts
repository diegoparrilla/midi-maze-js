import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseMaz } from './maze';

function readGen<T>(name: string): T {
  const url = new URL(`./assets/generated/${name}`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as T;
}
function readRaw(name: string): Uint8Array {
  const url = new URL(`../assets-src/${name}`, import.meta.url);
  return new Uint8Array(readFileSync(fileURLToPath(url)));
}

interface Shape {
  scale: number;
  height: number;
  widthWords: number;
  rows: number[];
}

// Geometry of body shape `shapeIndex`, recomputed independently (read_d8a.py).
function geometry(shapeIndex: number): { scale: number; height: number; widthWords: number } {
  let scale = 24 - shapeIndex;
  if (scale > 16) scale = ((scale - 16) << 1) + 16;
  return {
    scale,
    height: Math.floor((Math.floor((scale * 40) / 12) + 1) / 2),
    widthWords: Math.floor((scale - 1) / 8) + 1,
  };
}

describe('sine table (golden cross-check)', () => {
  const sine = readGen<number[]>('sine.json');

  it('has 65 quarter-wave entries', () => {
    expect(sine).toHaveLength(65);
  });

  it('equals trunc(sin(i/256 * 2pi) * 256) for every entry', () => {
    // The original stores a C int cast (truncation), NOT a rounded value — this
    // exact table is what fast_sin uses, so the sim must match it (C-02).
    for (let i = 0; i < 65; i++) {
      expect(sine[i]).toBe(Math.trunc(Math.sin((i / 256) * 2 * Math.PI) * 256));
    }
    expect([sine[0], sine[64]]).toEqual([0, 256]); // sin(0)=0, sin(90deg)=1.0
  });
});

describe('shapes', () => {
  it('has 24 ball shapes with self-consistent geometry', () => {
    const balls = readGen<Shape[]>('ball-shapes.json');
    expect(balls).toHaveLength(24);
    balls.forEach((shape, i) => {
      const g = geometry(i);
      expect([shape.scale, shape.height, shape.widthWords]).toEqual([
        g.scale,
        g.height,
        g.widthWords,
      ]);
      expect(shape.rows).toHaveLength(g.height * g.widthWords);
      expect(shape.rows.every((w) => w >= 0 && w <= 0xffff)).toBe(true);
    });
  });

  it('has 24 sizes x 20 face rotations sized like their body', () => {
    const faces = readGen<Shape[][]>('face-shapes.json');
    expect(faces).toHaveLength(24);
    faces.forEach((variants, i) => {
      expect(variants).toHaveLength(20);
      const g = geometry(i);
      for (const shape of variants) {
        expect(shape.rows).toHaveLength(g.height * g.widthWords);
      }
    });
  });
});

describe('palette', () => {
  it('has 16 colours with 8-bit RGB triples', () => {
    const palette = readGen<{ ste: number; rgb: [number, number, number] }[]>('palette.json');
    expect(palette).toHaveLength(16);
    for (const c of palette) {
      expect(c.rgb.every((v) => v >= 0 && v <= 255)).toBe(true);
    }
  });
});

describe('maze golden artifacts', () => {
  it('generated JSON grid equals the loader parse of the raw .MAZ', () => {
    for (const name of ['midimaze', 'bigstart', 'hudson']) {
      const gen = readGen<{ name: string; size: number; data: number[] }>(`mazes/${name}.json`);
      const fresh = parseMaz(readRaw(`mazes/${name}.maz`));
      expect(gen.size).toBe(fresh.size);
      expect(gen.data).toHaveLength(64 * 64);
      expect(Int8Array.from(gen.data)).toEqual(fresh.data);
    }
  });
});
