import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { calcYxToXh } from './projection';

interface Proj {
  y: number;
  x: number;
  sx: number;
  h: number;
}
const samples = (
  JSON.parse(
    readFileSync(fileURLToPath(new URL('../sim/golden/primitives.json', import.meta.url)), 'utf8'),
  ) as { projection: Proj[] }
).projection;

describe('calcYxToXh vs C', () => {
  it('matches the C projection for every sample', () => {
    for (const s of samples) {
      expect(calcYxToXh(s.y, s.x)).toEqual([s.sx, s.h]);
    }
  });
});
