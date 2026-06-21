import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../game/config';
import { MAZE_MAX_SIZE, type Maze } from '../maze';
import { decodeSendData, encodeSendData, type SendData } from './protocol';

const MAZE_BYTES = MAZE_MAX_SIZE * MAZE_MAX_SIZE;

function sampleMaze(): Maze {
  const data = new Int8Array(MAZE_BYTES);
  data[0] = 1; // a wall
  data[5] = -1; // empty (signed)
  data[MAZE_BYTES - 1] = 1;
  return { size: 14, data, defect: false };
}

function sample(): SendData {
  const config = defaultConfig();
  config.reloadTime = 30;
  config.regenTime = 200;
  config.reviveTime = 100;
  config.reviveLives = 3;
  config.drones = [2, 1, 4];
  config.teamFlag = true;
  config.teams = Array.from({ length: 16 }, (_, i) => i % 4);
  config.friendlyFire = true;
  return { names: ['ALICE', 'BO'], maze: sampleMaze(), config, seed: 0xbeef };
}

describe('SEND_DATA codec', () => {
  it('round-trips names, maze, config and seed', () => {
    const d = sample();
    const decoded = decodeSendData(encodeSendData(d), d.names.length);

    expect(decoded.names).toEqual(['ALICE', 'BO']);
    expect(decoded.seed).toBe(0xbeef);
    expect(decoded.maze.size).toBe(14);
    expect([...decoded.maze.data]).toEqual([...d.maze.data]); // incl. signed -1
    expect(decoded.config.reloadTime).toBe(30);
    expect(decoded.config.regenTime).toBe(200);
    expect(decoded.config.reviveTime).toBe(100);
    expect(decoded.config.reviveLives).toBe(3);
    expect(decoded.config.drones).toEqual([2, 1, 4]);
    expect(decoded.config.teamFlag).toBe(true);
    expect(decoded.config.teams).toEqual(d.config.teams);
    expect(decoded.config.friendlyFire).toBe(true);
  });

  it('lays bytes out in the documented order (offset fixture)', () => {
    const d = sample();
    const b = encodeSendData(d);
    // names: "ALICE\0BO\0" = 6 + 3 = 9 bytes
    expect([...b.slice(0, 9)]).toEqual([65, 76, 73, 67, 69, 0, 66, 79, 0]);
    let p = 9;
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
    expect(b[p++]).toBe(1); // friendly-fire
    expect([b[p++], b[p++]]).toEqual([0xbe, 0xef]); // seed hi/lo
    expect(p).toBe(b.length);
  });

  it('preserves the full 4096-byte maze grid', () => {
    const d = sample();
    expect(encodeSendData(d).length).toBe(9 + 8 + MAZE_BYTES + 1 + 16 + 1 + 2);
  });
});
