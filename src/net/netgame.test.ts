import { describe, expect, it } from 'vitest';
import { applyConfig, defaultConfig, type GameConfig } from '../game/config';
import { loadMazeById } from '../game/mazes';
import { assignDroneTypes, droneSetup } from '../sim/drone';
import { JOYSTICK_RIGHT, JOYSTICK_UP } from '../sim/movement';
import { Rng } from '../sim/rng';
import { initAllPlayer } from '../sim/setup';
import { step } from '../sim/step';
import { World } from '../sim/world';
import { exchangeJoysticks, NetGame } from './netgame';
import { MIDI_TERMINATE_GAME } from './protocol';
import { ByteChannel } from './ring';

const HUMANS = 1;

function buildWorld(seed: number, cfg: GameConfig): World {
  const w = new World(loadMazeById(cfg.mazeId), new Rng(seed));
  w.machinesOnline = HUMANS;
  applyConfig(w, cfg, HUMANS);
  assignDroneTypes(w, HUMANS);
  droneSetup(w, HUMANS);
  const total =
    HUMANS + w.activeDronesByType[0]! + w.activeDronesByType[1]! + w.activeDronesByType[2]!;
  initAllPlayer(w, total, true);
  w.weDontHaveAWinner = 1;
  return w;
}

function snapshot(w: World): unknown {
  return w.players.slice(0, w.playerAndDroneCount).map((p) => ({
    y: p.ply_y,
    x: p.ply_x,
    dir: p.ply_dir,
    lives: p.ply_lives,
    score: p.ply_score,
    shoot: p.ply_shoot,
  }));
}

/** A self-echoing ring-of-one channel (orchestrator ring-of-one behaviour). */
function selfEcho(): ByteChannel {
  let ch!: ByteChannel;
  ch = new ByteChannel((bytes) => queueMicrotask(() => ch.push(bytes)));
  return ch;
}

describe('exchangeJoysticks (one tick)', () => {
  it('ring of one self-echoes our byte into our slot', async () => {
    let ch!: ByteChannel;
    ch = new ByteChannel((bytes) => queueMicrotask(() => ch.push(bytes)));
    const joy = await exchangeJoysticks(ch, 0, 1, 0x11);
    expect(joy).toEqual([0x11]);
  });

  it('fills the table in ring order for a 2-player exchange', async () => {
    const sent: number[] = [];
    const ch = new ByteChannel((b) => sent.push(...b));
    // own=0, machines=2, ownByte=5. The loop: send joy[0]=5, read joy[1];
    // send joy[1], read joy[0] (our byte coming back). Script the two reads: [8, 5].
    ch.push(Uint8Array.of(8, 5));
    const joy = await exchangeJoysticks(ch, 0, 2, 5);
    expect(joy).toEqual([5, 8]); // [own, other]
    expect(sent).toEqual([5, 8]); // sent own, then forwarded the received byte
  });

  it('exchanges from a non-zero own slot', async () => {
    const sent: number[] = [];
    const ch = new ByteChannel((b) => sent.push(...b));
    // own=1, machines=2, ownByte=9. send joy[1]=9, i->0, read joy[0]; then i wraps to
    // 1 with one more send+read. Reads scripted [4, 9].
    ch.push(Uint8Array.of(4, 9));
    const joy = await exchangeJoysticks(ch, 1, 2, 9);
    expect(joy).toEqual([4, 9]); // [other, own]
    expect(sent).toEqual([9, 4]);
  });

  it('rejects on a missing byte (tight timeout)', async () => {
    const ch = new ByteChannel(() => {});
    await expect(exchangeJoysticks(ch, 0, 2, 1, 30)).rejects.toThrow(/timeout/);
  });
});

describe('NetGame pump', () => {
  it('advances the sim each tick (ring of one)', async () => {
    const cfg = defaultConfig();
    cfg.drones = [1, 1, 0];
    const game = new NetGame({
      world: buildWorld(7, cfg),
      ownNumber: 0,
      machinesOnline: 1,
      localInput: () => JOYSTICK_UP,
    });
    const ch = selfEcho();
    expect(await game.runTick(ch)).toBeNull();
    expect(await game.runTick(ch)).toBeNull();
    expect(game.tick).toBe(2);
    expect(game.lastJoy).toEqual([JOYSTICK_UP]); // exposed for interop telemetry (EPIC-18)
  });

  it('ends on a TERMINATE_GAME byte', async () => {
    const game = new NetGame({
      world: buildWorld(7, defaultConfig()),
      ownNumber: 0,
      machinesOnline: 1,
      localInput: () => MIDI_TERMINATE_GAME, // self-echo puts it at slot 0
    });
    expect(await game.run(selfEcho())).toBe('terminated');
  });

  it('ends with timeout when a byte never arrives', async () => {
    const game = new NetGame({
      world: buildWorld(7, defaultConfig()),
      ownNumber: 0,
      machinesOnline: 1,
      localInput: () => JOYSTICK_UP,
      timeoutMs: 30,
    });
    const dead = new ByteChannel(() => {}); // never echoes
    expect(await game.runTick(dead)).toBe('timeout');
  });

  it('is bit-identical to a local sim for the same seed/config/joystick (D-02)', async () => {
    const cfg = defaultConfig();
    cfg.drones = [1, 1, 1];
    const script = [JOYSTICK_UP, JOYSTICK_UP, JOYSTICK_RIGHT, 0, JOYSTICK_UP];

    // networked (ring of one): every byte we send self-echoes back as our own input
    let k = 0;
    const net = new NetGame({
      world: buildWorld(99, cfg),
      ownNumber: 0,
      machinesOnline: 1,
      localInput: () => script[k % script.length]!,
    });
    const ch = selfEcho();
    for (let t = 0; t < 30; t++, k++) await net.runTick(ch);

    // local-only sim driven by the same joystick stream
    const local = buildWorld(99, cfg);
    const dronesActive = local.playerAndDroneCount > local.machinesOnline ? 1 : 0;
    for (let t = 0; t < 30; t++) {
      const joyTable = new Array<number>(local.playerAndDroneCount).fill(0);
      joyTable[0] = script[t % script.length]!;
      step(local, joyTable, dronesActive);
    }

    expect(snapshot(net.world)).toEqual(snapshot(local));
  });
});
