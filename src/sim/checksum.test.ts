import { describe, expect, it } from 'vitest';
import { worldChecksum } from './checksum';
import type { World } from './world';

type P = Record<string, number>;
const player = (over: Partial<P> = {}): P => ({
  ply_x: 100,
  ply_y: 200,
  ply_dir: 64,
  ply_lives: 3,
  ply_score: 0,
  ply_reload: 0,
  ply_shoot: 0,
  ply_shooty: 0,
  ply_shootx: 0,
  ply_shootr: 0,
  ...over,
});
const world = (players: P[]): World =>
  ({ players, playerAndDroneCount: players.length }) as unknown as World;

describe('worldChecksum', () => {
  it('is stable and 8 hex digits', () => {
    const w = world([player(), player({ ply_x: 999 })]);
    expect(worldChecksum(w)).toMatch(/^[0-9a-f]{8}$/);
    expect(worldChecksum(w)).toBe(worldChecksum(w));
  });

  it('changes when any tracked field changes (desync would show here)', () => {
    const base = worldChecksum(world([player()]));
    expect(worldChecksum(world([player({ ply_x: 101 })]))).not.toBe(base);
    expect(worldChecksum(world([player({ ply_dir: 65 })]))).not.toBe(base);
    expect(worldChecksum(world([player({ ply_score: 1 })]))).not.toBe(base);
  });

  it('only covers playerAndDroneCount players', () => {
    const a = world([player(), player()]);
    const b = world([player(), player()]);
    (b as unknown as { players: P[] }).players.push(player({ ply_x: 7 }));
    expect(worldChecksum(a)).toBe(worldChecksum(b)); // the extra slot is past the count
  });

  it('distinguishes player order', () => {
    const ab = worldChecksum(world([player({ ply_x: 1 }), player({ ply_x: 2 })]));
    const ba = worldChecksum(world([player({ ply_x: 2 }), player({ ply_x: 1 })]));
    expect(ab).not.toBe(ba);
  });
});
