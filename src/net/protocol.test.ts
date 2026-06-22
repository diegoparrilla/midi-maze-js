import { describe, expect, it } from 'vitest';
import { defaultConfig, type GameConfig } from '../game/config';
import { MAZE_MAX_SIZE, type Maze } from '../maze';
import { decodeData, encodeData, SEND_DATA_FIXED } from './protocol';

const MAZE_BYTES = MAZE_MAX_SIZE * MAZE_MAX_SIZE;

function sampleMaze(): Maze {
  const data = new Int8Array(MAZE_BYTES);
  data[0] = 1; // a wall
  data[5] = -1; // empty (signed)
  data[MAZE_BYTES - 1] = 1;
  return { size: 14, data, defect: false };
}

function sampleConfig(): GameConfig {
  const config = defaultConfig();
  config.reloadTime = 30;
  config.regenTime = 200;
  config.reviveTime = 100;
  config.reviveLives = 3;
  config.drones = [2, 1, 4];
  config.teamFlag = true;
  config.teams = Array.from({ length: 16 }, (_, i) => i % 4);
  config.friendlyFire = true;
  return config;
}

describe('SEND_DATA data codec (no names, no seed — both are ring exchanges)', () => {
  it('round-trips maze and config', () => {
    const maze = sampleMaze();
    const config = sampleConfig();
    const decoded = decodeData(encodeData(maze, config));

    expect(decoded.maze.size).toBe(14);
    expect([...decoded.maze.data]).toEqual([...maze.data]); // incl. signed -1
    expect(decoded.config.reloadTime).toBe(30);
    expect(decoded.config.regenTime).toBe(200);
    expect(decoded.config.reviveTime).toBe(100);
    expect(decoded.config.reviveLives).toBe(3);
    expect(decoded.config.drones).toEqual([2, 1, 4]);
    expect(decoded.config.teamFlag).toBe(true);
    expect(decoded.config.teams).toEqual(config.teams);
    expect(decoded.config.friendlyFire).toBe(true);
  });

  it('lays bytes out in the documented order (byte-exact to send_datas, no seed)', () => {
    const b = encodeData(sampleMaze(), sampleConfig());
    let p = 0;
    expect(b[p++]).toBe(14); // maze-size
    expect(b[p++]).toBe(30); // reload
    expect(b[p++]).toBe(200); // regen
    expect(b[p++]).toBe(100); // revive
    expect(b[p++]).toBe(3); // lives
    expect([b[p++], b[p++], b[p++]]).toEqual([2, 1, 4]); // drones
    expect(b[p]).toBe(1); // first maze byte (wall)
    p += MAZE_BYTES;
    expect(b[p++]).toBe(1); // team-flag
    p += 16; // teams
    expect(b[p++]).toBe(1); // friendly-fire — last byte (the seed is a separate exchange)
    expect(p).toBe(b.length);
    expect(b.length).toBe(SEND_DATA_FIXED);
    // byte-exact to the original send_datas: 8 config + 4096 maze + 17 team + 1 ff, no seed
    expect(SEND_DATA_FIXED).toBe(4122);
  });
});
