import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../game/config';
import { loadMazeById } from '../game/mazes';
import { ByteChannel } from './ring';
import { runSetup } from './setup';

describe('runSetup host (ring of one, self-echo)', () => {
  it('elects itself and round-trips its own block', async () => {
    let ch!: ByteChannel;
    ch = new ByteChannel((bytes) => queueMicrotask(() => ch.push(bytes)));
    const config = defaultConfig();
    config.playerName = 'HOST';
    config.drones = [1, 0, 2];
    const r = await runSetup(ch, 'host', config, 0x1234);
    expect(r.machinesOnline).toBe(1);
    expect(r.ownNumber).toBe(0);
    expect(r.seed).toBe(0x1234);
    expect(r.names).toEqual(['HOST']);
    expect(r.config.drones).toEqual([1, 0, 2]);
    expect(r.maze.data.length).toBe(loadMazeById('midimaze').data.length);
  });
});

// The full master ↔ slave join exchange (names ring + data block + seed) is covered
// end-to-end over a real 2-node ring in handshake.test.ts.
