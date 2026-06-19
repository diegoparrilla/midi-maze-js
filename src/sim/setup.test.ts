import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Maze } from '../maze';
import { Rng } from './rng';
import { initAllPlayer } from './setup';
import { World } from './world';

interface Placement {
  seed: number;
  count: number;
  maze: string;
  players: { y: number; x: number; dir: number }[];
}
const golden = (
  JSON.parse(
    readFileSync(fileURLToPath(new URL('./golden/primitives.json', import.meta.url)), 'utf8'),
  ) as { placement: Placement }
).placement;

function loadMaze(name: string): Maze {
  const json = JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../assets/generated/mazes/${name}.json`, import.meta.url)),
      'utf8',
    ),
  ) as { size: number; data: number[] };
  return { size: json.size, data: Int8Array.from(json.data), defect: false };
}

describe('initial player placement vs C', () => {
  it('places every player at the same position and facing as the original', () => {
    const world = new World(loadMaze(golden.maze), new Rng(golden.seed));
    expect(initAllPlayer(world, golden.count)).toBe(true);

    const got = world.players
      .slice(0, golden.count)
      .map((p) => ({ y: p.ply_y, x: p.ply_x, dir: p.ply_dir }));
    expect(got).toEqual(golden.players);
  });

  it('marks each placed cell occupied so players never share a cell', () => {
    const world = new World(loadMaze(golden.maze), new Rng(golden.seed));
    initAllPlayer(world, golden.count);
    const cells = new Set<number>();
    for (let i = 0; i < golden.count; i++) {
      const p = world.players[i]!;
      const key = (p.ply_y >> 7) * 64 + (p.ply_x >> 7);
      expect(cells.has(key)).toBe(false);
      cells.add(key);
    }
  });
});
