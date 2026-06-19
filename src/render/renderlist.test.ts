import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Maze } from '../maze';
import type { Player } from '../sim/player';
import { Rng } from '../sim/rng';
import { World } from '../sim/world';
import { type DrawElem, makeDrawList } from './renderlist';

interface View {
  name: string;
  y: number;
  x: number;
  dir: number;
  own: number;
  count: number;
  players: { y: number; x: number; dir: number; lives: number }[];
  elems: DrawElem[];
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

function place(p: Player, s: { y: number; x: number; dir: number; lives: number }): void {
  p.ply_y = s.y;
  p.ply_x = s.x;
  p.ply_dir = s.dir;
  p.ply_lives = s.lives;
  p.ply_plist = -1;
  p.ply_slist = -1;
}

describe('draw-list (walls + sprites) vs C', () => {
  const maze = loadMaze('midimaze');

  for (const view of views) {
    it(`reproduces the draw list for "${view.name}"`, () => {
      const world = new World(maze, new Rng(0));
      world.playerAndDroneCount = view.count;
      view.players.forEach((s, i) => place(world.players[i]!, s));
      const elems = makeDrawList(world, view.y, view.x, view.dir, view.own);
      expect(elems).toEqual(view.elems);
    });
  }
});
