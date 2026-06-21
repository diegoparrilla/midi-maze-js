import { describe, expect, it } from 'vitest';
import { Rng } from '../sim/rng';
import { World } from '../sim/world';
import type { Maze } from '../maze';
import { applyConfig, clampDrones, defaultConfig, maxDrones, TIME_RELOAD_FAST } from './config';

const dummyMaze: Maze = { size: 1, data: new Int8Array(1), defect: false };

describe('defaultConfig', () => {
  it('uses the fast timings and a single team by default', () => {
    const c = defaultConfig();
    expect(c.reloadTime).toBe(TIME_RELOAD_FAST);
    expect(c.reviveLives).toBe(2);
    expect(c.friendlyFire).toBe(false);
    expect(c.teamFlag).toBe(false);
    expect(c.drones).toEqual([0, 0, 0]);
    expect(c.teams).toHaveLength(16);
    expect(c.mazeId).toBe('midimaze');
  });
});

describe('drone cap', () => {
  it('maxDrones is the free slots after the humans', () => {
    expect(maxDrones(1)).toBe(15);
    expect(maxDrones(4)).toBe(12);
  });

  it('clampDrones trims the later types first to fit the cap', () => {
    // 1 human -> cap 15; 10+5+5 = 20, over by 5 -> trim ninja then standard.
    expect(clampDrones([10, 5, 5], 1)).toEqual([10, 5, 0]);
    expect(clampDrones([10, 8, 5], 1)).toEqual([10, 5, 0]);
    expect(clampDrones([3, 0, 0], 1)).toEqual([3, 0, 0]); // under cap unchanged
    expect(clampDrones([-2, 1, 1], 1)).toEqual([0, 1, 1]); // negatives floored
  });
});

describe('applyConfig', () => {
  it('maps config onto the World game-rule fields', () => {
    const world = new World(dummyMaze, new Rng(0));
    const c = defaultConfig();
    c.reloadTime = 30;
    c.regenTime = 200;
    c.reviveTime = 100;
    c.reviveLives = 3;
    c.friendlyFire = true;
    c.teamFlag = true;
    c.teams[2] = 1;
    c.drones = [2, 1, 1];
    applyConfig(world, c, 1);

    expect(world.reloadTime).toBe(30);
    expect(world.regenTime).toBe(200);
    expect(world.reviveTime).toBe(100);
    expect(world.reviveLives).toBe(3);
    expect(world.friendlyFire).toBe(1);
    expect(world.teamFlag).toBe(1);
    expect(world.players[2]!.ply_team).toBe(1);
    expect([...world.activeDronesByType]).toEqual([2, 1, 1]);
  });

  it('clamps over-cap drone counts when applying', () => {
    const world = new World(dummyMaze, new Rng(0));
    const c = defaultConfig();
    c.drones = [20, 0, 0];
    applyConfig(world, c, 1); // cap 15
    expect([...world.activeDronesByType]).toEqual([15, 0, 0]);
  });
});
