import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Maze } from '../maze';
import { Rng } from '../sim/rng';
import { World } from '../sim/world';
import { makeWallList } from './renderlist';

interface View {
  name: string;
  y: number;
  x: number;
  dir: number;
  walls: { color: number; x1: number; h1: number; x2: number; h2: number }[];
}
const views = (
  JSON.parse(
    readFileSync(fileURLToPath(new URL('../sim/golden/primitives.json', import.meta.url)), 'utf8'),
  ) as { renderlist: View[] }
).renderlist;

function loadMaze(name: string): Maze {
  const json = JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../assets/generated/mazes/${name}.json`, import.meta.url)),
      'utf8',
    ),
  ) as { size: number; data: number[] };
  return { size: json.size, data: Int8Array.from(json.data), defect: false };
}

describe('wall render-list vs C', () => {
  const maze = loadMaze('midimaze');

  for (const view of views) {
    it(`reproduces the wall list for "${view.name}"`, () => {
      const world = new World(maze, new Rng(0)); // no players: walls only
      const walls = makeWallList(world, view.y, view.x, view.dir);
      expect(walls).toEqual(view.walls);
    });
  }
});
