import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../game/config';
import { loadMazeById } from '../game/mazes';
import { encodeSendData, MIDI_COUNT_PLAYERS, MIDI_SEND_DATA, MIDI_START_GAME } from './protocol';
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
    expect(r.config.drones).toEqual([1, 0, 2]);
    expect(r.maze.data.length).toBe(loadMazeById('midimaze').data.length);
  });
});

describe('runSetup join (scripted master)', () => {
  it('adopts the master block, own number and player count', async () => {
    const sent: number[] = [];
    const ch = new ByteChannel((b) => sent.push(...b));

    // The exact bytes a master sends to a single slave: COUNT (running count 1 ->
    // we are player 1, tally 2, an ignore byte), then START_GAME + the SEND_DATA block.
    const hostConfig = defaultConfig();
    hostConfig.reloadTime = 30;
    hostConfig.drones = [0, 3, 0];
    hostConfig.teamFlag = true;
    const maze = loadMazeById('hudson');
    const block = encodeSendData({
      names: ['HOST', 'JOIN'],
      maze,
      config: hostConfig,
      seed: 0xcafe,
    });
    ch.push(
      Uint8Array.from([MIDI_COUNT_PLAYERS, 1, 2, 0x00, MIDI_START_GAME, MIDI_SEND_DATA, ...block]),
    );

    const r = await runSetup(ch, 'join', defaultConfig(), 0);
    expect(r.machinesOnline).toBe(2);
    expect(r.ownNumber).toBe(1);
    expect(r.seed).toBe(0xcafe);
    expect(r.config.reloadTime).toBe(30);
    expect(r.config.drones).toEqual([0, 3, 0]);
    expect(r.config.teamFlag).toBe(true);
    expect([...r.maze.data]).toEqual([...maze.data]);
  });
});
