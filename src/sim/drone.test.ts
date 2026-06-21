import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Maze } from '../maze';
import {
  assignDroneTypes,
  calcDroneAngleTable,
  DRONE_NINJA,
  DRONE_STANDARD,
  DRONE_TARGET,
  droneAction,
  droneSetup,
} from './drone';
import { movePlayer } from './movement';
import { PLAYER_MAX_LIVES, World } from './world';
import { Rng } from './rng';
import { initAllPlayer } from './setup';
import { step } from './step';

const golden = JSON.parse(
  readFileSync(fileURLToPath(new URL('./golden/primitives.json', import.meta.url)), 'utf8'),
) as {
  droneAngleTable: number[];
  droneSetup: DroneSetupCase[];
  droneTrace: DroneTraceCase[];
  ninjaTrace: DroneTraceCase[];
};

interface DroneSetupCase {
  name: string;
  humanPlayers: number;
  teamFlag: number;
  drones: [number, number, number];
  players: {
    dr_type: number;
    ply_team: number;
    dr_currentTarget: number;
    dr_permanentTarget: number;
    dr_humanEnemies: number[];
  }[];
}

interface DroneTraceCase {
  name: string;
  seed: number;
  humanPlayers: number;
  drones: [number, number, number];
  ticks: number;
  trace: {
    joy: number[];
    players: {
      y: number;
      x: number;
      dir: number;
      lives: number;
      shoot: number;
      locked: number;
      rot: number;
      uprot: number;
      fi: number;
    }[];
  }[];
}

const dummyMaze: Maze = { size: 1, data: new Int8Array(1), defect: false };

function loadMaze(name: string): Maze {
  const json = JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../assets/generated/mazes/${name}.json`, import.meta.url)),
      'utf8',
    ),
  ) as { size: number; data: number[] };
  return { size: json.size, data: Int8Array.from(json.data), defect: false };
}

function runSetupCase(c: DroneSetupCase) {
  const world = new World(dummyMaze, new Rng(0));
  world.teamFlag = c.teamFlag;
  world.activeDronesByType[0] = c.drones[0];
  world.activeDronesByType[1] = c.drones[1];
  world.activeDronesByType[2] = c.drones[2];
  const total = c.humanPlayers + c.drones[0] + c.drones[1] + c.drones[2];
  assignDroneTypes(world, c.humanPlayers);
  for (let i = 0; i < total; i++) world.players[i]!.ply_team = c.players[i]!.ply_team;
  droneSetup(world, c.humanPlayers);
  return world.players.slice(0, total).map((p) => ({
    dr_type: p.dr_type,
    ply_team: p.ply_team,
    dr_currentTarget: p.dr_currentTarget,
    dr_permanentTarget: p.dr_permanentTarget,
    dr_humanEnemies: p.dr_humanEnemies,
  }));
}

function setupTraceWorld(maze: Maze, c: DroneTraceCase) {
  const world = new World(maze, new Rng(c.seed));
  world.teamFlag = 0;
  world.reloadTime = 8;
  world.regenTime = 50;
  world.reviveTime = 50;
  world.reviveLives = PLAYER_MAX_LIVES;
  world.friendlyFire = 0;
  const [nTarget, nStd, nNinja] = c.drones;
  world.activeDronesByType[0] = nTarget;
  world.activeDronesByType[1] = nStd;
  world.activeDronesByType[2] = nNinja;
  const total = c.humanPlayers + nTarget + nStd + nNinja;
  world.machinesOnline = c.humanPlayers;
  let j = c.humanPlayers;
  for (let i = 0; i < nTarget; i++) world.players[j++]!.dr_type = DRONE_TARGET;
  for (let i = 0; i < nStd; i++) world.players[j++]!.dr_type = DRONE_STANDARD;
  for (let i = 0; i < nNinja; i++) world.players[j++]!.dr_type = DRONE_NINJA;
  droneSetup(world, c.humanPlayers);
  initAllPlayer(world, total, true);
  world.weDontHaveAWinner = 1;
  return { world, total };
}

function snapshot(world: World, total: number) {
  return world.players.slice(0, total).map((p) => ({
    y: p.ply_y,
    x: p.ply_x,
    dir: p.ply_dir,
    lives: p.ply_lives,
    shoot: p.ply_shoot,
    locked: p.dr_targetLocked,
    rot: p.dr_rotateCounter,
    uprot: p.dr_upRotationCounter,
    fi: p.dr_fieldIndex,
  }));
}

// Mirrors run_drones() in the C harness: a full game-loop body that calls
// drone_action directly, so the generated joystick bytes are verified too.
function runTraceCase(maze: Maze, c: DroneTraceCase) {
  const { world, total } = setupTraceWorld(maze, c);
  const joy = new Array<number>(total).fill(0);
  let playerIndex = 0;
  const trace = [];
  for (let t = 0; t < c.ticks; t++) {
    world.setAllPlayer();
    for (let i = 0; i < c.humanPlayers; i++) joy[i] = c.trace[t]!.joy[i]!; // human bytes from golden
    for (let i = c.humanPlayers; i < total; i++) droneAction(world, i, joy);
    for (let i = 0; i < total; i++) world.players[i]!.ply_hitflag = 0;
    const joys = joy.slice(0, total);
    let idx = playerIndex;
    do {
      movePlayer(world, idx, joy[idx]!, 1);
      if (!world.weDontHaveAWinner) break;
      if (--idx < 0) idx = total - 1;
    } while (idx !== playerIndex);
    if (++playerIndex === total) playerIndex = 0;
    trace.push({ joy: joys, players: snapshot(world, total) });
  }
  return trace;
}

// Same scenario driven through step(), proving the STORY-04 integration. step()
// hides the generated joystick bytes, so we compare resulting player state only.
function runTraceViaStep(maze: Maze, c: DroneTraceCase) {
  const { world, total } = setupTraceWorld(maze, c);
  const trace = [];
  for (let t = 0; t < c.ticks; t++) {
    step(world, c.trace[t]!.joy, 1); // only human slots are read; drone slots overwritten
    trace.push(snapshot(world, total));
  }
  return trace;
}

describe('calcDroneAngleTable vs C', () => {
  it('matches the C drone angle table (33 entries)', () => {
    expect(calcDroneAngleTable()).toEqual(golden.droneAngleTable);
  });
});

describe('droneSetup vs C', () => {
  for (const c of golden.droneSetup) {
    it(`assigns targets identically to the original (${c.name})`, () => {
      expect(runSetupCase(c)).toEqual(c.players);
    });
  }
});

describe('drone_action (target + standard) vs C', () => {
  const maze = loadMaze('midimaze');
  for (const c of golden.droneTrace) {
    it(`reproduces the "${c.name}" drone trace across ${c.ticks} ticks`, () => {
      expect(runTraceCase(maze, c)).toEqual(c.trace);
    });
  }
});

describe('step() drives the drones (STORY-04 integration)', () => {
  const maze = loadMaze('midimaze');
  for (const c of golden.droneTrace) {
    it(`matches the C player state for "${c.name}" via step()`, () => {
      const expected = c.trace.map((tick) => tick.players);
      expect(runTraceViaStep(maze, c)).toEqual(expected);
    });
  }
});

describe('ninja drone_action vs C (STORY-03)', () => {
  const maze = loadMaze('midimaze');
  for (const c of golden.ninjaTrace) {
    it(`reproduces the "${c.name}" ninja trace across ${c.ticks} ticks`, () => {
      expect(runTraceCase(maze, c)).toEqual(c.trace);
    });
    it(`matches the C player state for "${c.name}" via step()`, () => {
      const expected = c.trace.map((tick) => tick.players);
      expect(runTraceViaStep(maze, c)).toEqual(expected);
    });
  }
});
