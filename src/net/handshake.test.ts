import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../game/config';
import { loadMazeById } from '../game/mazes';
import { MIDI_NAME_DIALOG } from './protocol';
import { ByteChannel, countMaster } from './ring';
import { exchangeNames, exchangeSeed, hostCount, hostStart, nameBarrier, runSetup } from './setup';

/** Wire two channels as a 2-node orchestrator ring: master.OUT → slave.IN, and back.
 *  queueMicrotask keeps it async (no synchronous re-entrancy), like the real transport. */
function ring(): { master: ByteChannel; slave: ByteChannel } {
  let master!: ByteChannel;
  let slave!: ByteChannel;
  master = new ByteChannel((b) => queueMicrotask(() => slave.push(b.slice())));
  slave = new ByteChannel((b) => queueMicrotask(() => master.push(b.slice())));
  return { master, slave };
}

describe('master + slave handshake over a 2-node ring', () => {
  it('runSetup host and join agree on the shared world', async () => {
    const { master, slave } = ring();
    const hostConfig = defaultConfig();
    hostConfig.playerName = 'MASTER';
    hostConfig.mazeId = 'hudson';
    hostConfig.reloadTime = 30;
    hostConfig.drones = [0, 1, 0];
    const joinConfig = defaultConfig();
    joinConfig.playerName = 'SLAVE';

    const [m, s] = await Promise.all([
      runSetup(master, 'host', hostConfig, 0x1234, 3000),
      runSetup(slave, 'join', joinConfig, 0, 3000),
    ]);

    expect(m.machinesOnline).toBe(2);
    expect(s.machinesOnline).toBe(2);
    expect(m.ownNumber).toBe(0);
    expect(s.ownNumber).toBe(1);
    expect(s.seed).toBe(0x1234);
    expect(s.config.reloadTime).toBe(30);
    expect([...s.maze.data]).toEqual([...loadMazeById('hudson').data]);
    // names propagate both ways: every node holds every name in ring order
    expect(m.names).toEqual(['MASTER', 'SLAVE']);
    expect(s.names).toEqual(['MASTER', 'SLAVE']);
  });

  it('split host (COUNT on Play, START on Start) agrees with the slave', async () => {
    const { master, slave } = ring();
    const hostConfig = defaultConfig();
    hostConfig.playerName = 'MASTER';

    const slaveP = runSetup(slave, 'join', defaultConfig(), 0, 5000);
    // master: count now (lobby opens), then a delay (configuring), then start
    const count = await hostCount(master, 5000);
    expect(count.machinesOnline).toBe(2);
    await new Promise((r) => setTimeout(r, 50)); // "in the lobby"
    const m = await hostStart(master, hostConfig, 0x2222, count, 5000);
    const s = await slaveP;

    expect(m.machinesOnline).toBe(2);
    expect(s.machinesOnline).toBe(2);
    expect(s.ownNumber).toBe(1);
    expect(s.seed).toBe(0x2222);
  });

  it('a live NAME_DIALOG round exchanges every name (master ↔ slave)', async () => {
    const { master, slave } = ring();
    const joinConfig = defaultConfig();
    joinConfig.playerName = 'BO';
    let slaveNames: string[] | null = null;

    // The slave is waiting for the game; it handles the NAME round when the master
    // triggers it, then times out waiting for START (expected).
    const slaveP = runSetup(slave, 'join', joinConfig, 0, 200, {
      onNameDialog: () => Promise.resolve('BO'),
      onNames: (n) => {
        slaveNames = n;
      },
    }).catch(() => null);

    // Master runs the live round: a 0x86 count token, the edit barrier, then the exchange.
    master.flush();
    const count = await countMaster(master, 200, MIDI_NAME_DIALOG);
    expect(count.machinesOnline).toBe(2);
    await nameBarrier(master, count.machinesOnline, 200);
    const masterNames = await exchangeNames(master, 0, count.machinesOnline, 'ALICE', 200);

    await slaveP;
    expect(masterNames).toEqual(['ALICE', 'BO']);
    expect(slaveNames).toEqual(['ALICE', 'BO']);
  });

  it('seed exchange: master originates, slave reads it (a separate 2-byte ring step)', async () => {
    const { master, slave } = ring();
    const [m, s] = await Promise.all([
      exchangeSeed(master, 0, 0x1234, 3000), // master puts its seed on the ring
      exchangeSeed(slave, 1, 0, 3000), // slave reads + forwards it
    ]);
    expect(m).toBe(0x1234);
    expect(s).toBe(0x1234); // both nodes hold the master's seed (maingame.c:128-154)
  });
});
