import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Maze } from '../maze';
import { movePlayer } from './movement';
import type { Player } from './player';
import { Rng } from './rng';
import { World } from './world';

interface Pos {
  y: number;
  x: number;
  dir: number;
}
interface Scenario {
  name: string;
  objmap: number;
  count: number;
  start: Pos & { lives: number };
  other: (Pos & { lives: number }) | null;
  joy: number[];
  trace: Pos[];
}

const golden = (
  JSON.parse(
    readFileSync(fileURLToPath(new URL('./golden/primitives.json', import.meta.url)), 'utf8'),
  ) as { placement: { maze: string }; movement: Scenario[] }
).movement;

function loadMaze(name: string): Maze {
  const json = JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../assets/generated/mazes/${name}.json`, import.meta.url)),
      'utf8',
    ),
  ) as { size: number; data: number[] };
  return { size: json.size, data: Int8Array.from(json.data), defect: false };
}

function place(p: Player, s: Pos & { lives: number }): void {
  p.ply_y = s.y;
  p.ply_x = s.x;
  p.ply_dir = s.dir;
  p.ply_lives = s.lives;
  p.ply_plist = -1;
  p.ply_slist = -1;
}

describe('move_player vs C', () => {
  // The fixture maze is the one used for placement in the harness (midimaze).
  const maze = loadMaze('midimaze');

  for (const scenario of golden) {
    it(`reproduces the "${scenario.name}" trace tick-for-tick`, () => {
      const world = new World(maze, new Rng(0));
      world.playerAndDroneCount = scenario.count;
      place(world.players[0]!, scenario.start);
      if (scenario.other) place(world.players[1]!, scenario.other);

      const trace: Pos[] = [];
      for (const joy of scenario.joy) {
        if (scenario.objmap) world.setAllPlayer();
        movePlayer(world, 0, joy, 0);
        const p = world.players[0]!;
        trace.push({ y: p.ply_y, x: p.ply_x, dir: p.ply_dir });
      }
      expect(trace).toEqual(scenario.trace);
    });
  }
});
