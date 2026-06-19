import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Maze } from '../maze';
import type { Player } from './player';
import { Rng } from './rng';
import { initAllPlayer } from './setup';
import { step } from './step';
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
interface Match {
  name: string;
  seed: number;
  count: number;
  ticks: number;
  config: {
    reload: number;
    regen: number;
    revive: number;
    reviveLives: number;
    friendly: number;
    team: number;
  };
  joy: number[];
  trace: Full[][];
}

const matches = (
  JSON.parse(
    readFileSync(fileURLToPath(new URL('./golden/primitives.json', import.meta.url)), 'utf8'),
  ) as { match: Match[] }
).match;

function loadMaze(name: string): Maze {
  const json = JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../assets/generated/mazes/${name}.json`, import.meta.url)),
      'utf8',
    ),
  ) as { size: number; data: number[] };
  return { size: json.size, data: Int8Array.from(json.data), defect: false };
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

describe('step() full tick vs C', () => {
  const maze = loadMaze('midimaze');

  for (const m of matches) {
    it(`reproduces the "${m.name}" match across ${m.ticks} ticks`, () => {
      const world = new World(maze, new Rng(m.seed));
      world.reloadTime = m.config.reload;
      world.regenTime = m.config.regen;
      world.reviveTime = m.config.revive;
      world.reviveLives = m.config.reviveLives;
      world.friendlyFire = m.config.friendly;
      world.teamFlag = m.config.team;
      // Placement consumes the same RNG order as the C harness's init_all_player.
      expect(initAllPlayer(world, m.count)).toBe(true);

      const trace: Full[][] = [];
      for (let t = 0; t < m.ticks; t++) {
        const joyTable = m.joy.slice(t * m.count, t * m.count + m.count);
        expect(step(world, joyTable)).toBe(true);
        trace.push(world.players.slice(0, m.count).map(full));
      }
      expect(trace).toEqual(m.trace);
    });
  }
});
