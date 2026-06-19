import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Maze } from '../maze';
import { movePlayer } from './movement';
import type { Player } from './player';
import { Rng } from './rng';
import { World } from './world';

interface Full {
  y: number;
  x: number;
  dir: number;
  lives: number;
  score: number;
  hitflag: number;
  reload: number;
  shoot: number;
  shootx: number;
  shooty: number;
}
interface Combat {
  name: string;
  seed: number;
  count: number;
  config: {
    reload: number;
    regen: number;
    revive: number;
    reviveLives: number;
    friendly: number;
    team: number;
  };
  start: Full;
  other: Full | null;
  joy0: number[];
  trace: { p0: Full; p1: Full | null }[];
}

const combat = (
  JSON.parse(
    readFileSync(fileURLToPath(new URL('./golden/primitives.json', import.meta.url)), 'utf8'),
  ) as { combat: Combat[] }
).combat;

function loadMaze(name: string): Maze {
  const json = JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../assets/generated/mazes/${name}.json`, import.meta.url)),
      'utf8',
    ),
  ) as { size: number; data: number[] };
  return { size: json.size, data: Int8Array.from(json.data), defect: false };
}

function place(p: Player, s: Full): void {
  p.ply_y = s.y;
  p.ply_x = s.x;
  p.ply_dir = s.dir;
  p.ply_lives = s.lives;
  p.ply_plist = -1;
  p.ply_slist = -1;
}

function full(p: Player): Full {
  return {
    y: p.ply_y,
    x: p.ply_x,
    dir: p.ply_dir,
    lives: p.ply_lives,
    score: p.ply_score,
    hitflag: p.ply_hitflag,
    reload: p.ply_reload,
    shoot: p.ply_shoot,
    shootx: p.ply_shootx,
    shooty: p.ply_shooty,
  };
}

describe('move_shoot / combat vs C', () => {
  const maze = loadMaze('midimaze');

  for (const sc of combat) {
    it(`reproduces the "${sc.name}" combat trace tick-for-tick`, () => {
      const world = new World(maze, new Rng(sc.seed));
      world.reloadTime = sc.config.reload;
      world.regenTime = sc.config.regen;
      world.reviveTime = sc.config.revive;
      world.reviveLives = sc.config.reviveLives;
      world.friendlyFire = sc.config.friendly;
      world.teamFlag = sc.config.team;
      world.playerAndDroneCount = sc.count;
      world.weDontHaveAWinner = sc.count;
      place(world.players[0]!, sc.start);
      if (sc.other) place(world.players[1]!, sc.other);

      const trace = sc.joy0.map((joy) => {
        world.setAllPlayer();
        for (let i = 0; i < sc.count; i++) movePlayer(world, i, i === 0 ? joy : 0, 0);
        return { p0: full(world.players[0]!), p1: sc.count > 1 ? full(world.players[1]!) : null };
      });
      expect(trace).toEqual(sc.trace);
    });
  }
});
