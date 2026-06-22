// Per-tick lock-step ring loop (maingame.c) over the async transport. Each tick every
// node contributes its own joystick byte and receives the others round the ring, so
// all nodes step the identical sim from the identical joystick table (D-02, C-01).
import { step } from '../sim/step';
import type { World } from '../sim/world';
import { MIDI_START_GAME, MIDI_TERMINATE_GAME } from './protocol';
import type { ByteChannel } from './ring';

/** Tight per-tick budget — the ring's unforgiving model (C-01). */
export const TICK_TIMEOUT_MS = 1500;

/**
 * One tick of the joystick ring (maingame.c:415-422), faithful to the send/receive
 * order: starting at `ownNumber` send our byte, step the index backwards (mod
 * `machinesOnline`), read the next player's byte into that slot, until the index
 * returns to `ownNumber`. Returns the `machinesOnline`-long joystick table — identical
 * on every node. In a ring of one the byte we send self-echoes back into our slot.
 */
export async function exchangeJoysticks(
  ch: ByteChannel,
  ownNumber: number,
  machinesOnline: number,
  ownByte: number,
  timeoutMs: number = TICK_TIMEOUT_MS,
): Promise<number[]> {
  const joy = new Array<number>(machinesOnline).fill(0);
  joy[ownNumber] = ownByte & 0xff;
  let i = ownNumber;
  do {
    ch.sendByte(joy[i]!);
    if (--i < 0) i = machinesOnline - 1;
    joy[i] = await ch.readByte(timeoutMs);
  } while (i !== ownNumber);
  return joy;
}

/** Why a networked game loop ended. */
export type NetEnd = 'winner' | 'terminated' | 'timeout';

export interface NetGameOptions {
  world: World;
  /** This node's player index (master = 0). */
  ownNumber: number;
  /** Number of human players exchanging joysticks on the ring. */
  machinesOnline: number;
  /** Local joystick byte for this tick (e.g. from the Input module). */
  localInput: () => number;
  /** Optional per-tick hook (render / status), after the sim advanced. */
  onTick?: (world: World, tick: number) => void;
  timeoutMs?: number;
}

/**
 * Lock-step networked game driver (the maingame.c main loop body over the wire).
 * Each tick: take the local joystick, ring-exchange it for every node's bytes, then
 * `step()` the shared sim from the identical joystick table — drones are filled
 * locally by `step` (every node computes them identically). DOM-decoupled: rendering
 * is the `onTick` hook so it is unit-testable with a fake channel.
 */
export class NetGame {
  readonly world: World;
  tick = 0;
  private readonly o: NetGameOptions;

  constructor(opts: NetGameOptions) {
    this.o = opts;
    this.world = opts.world;
  }

  /** Run one tick. Returns the end reason, or null to keep going. */
  async runTick(ch: ByteChannel): Promise<NetEnd | null> {
    let joy: number[];
    try {
      joy = await exchangeJoysticks(
        ch,
        this.o.ownNumber,
        this.o.machinesOnline,
        this.o.localInput() & 0xff,
        this.o.timeoutMs,
      );
    } catch {
      return 'timeout'; // a dropped/late byte ends the ring cleanly (no desync)
    }

    // The master injects MIDI_TERMINATE_GAME at slot 0 to suspend the game. The original
    // then does a second step (maingame.c:433): the master sends a confirm byte round the
    // ring (START_GAME = continue, TERMINATE_GAME = quit) and every slave forwards it. We
    // never prompt "continue", so the master always confirms TERMINATE — but we still run
    // the exchange so a real ST slave (which blocks waiting for it) ends cleanly.
    if (joy[0] === MIDI_TERMINATE_GAME) {
      let confirm: number;
      try {
        if (this.o.ownNumber === 0) {
          ch.sendByte(MIDI_TERMINATE_GAME); // master: quit
          confirm = await ch.readByte(this.o.timeoutMs);
        } else {
          confirm = await ch.readByte(this.o.timeoutMs); // slave: the master's decision
          ch.sendByte(confirm); // forward it round the ring
        }
      } catch {
        return 'terminated'; // ring already gone — end anyway
      }
      if (confirm !== MIDI_START_GAME) return 'terminated';
      joy[0] = 0x00; // continue: TERMINATE is not a valid joystick command (maingame.c:464)
    }

    const w = this.world;
    const joyTable = new Array<number>(w.playerAndDroneCount).fill(0);
    for (let i = 0; i < this.o.machinesOnline && i < joyTable.length; i++) joyTable[i] = joy[i]!;
    const dronesActive = w.playerAndDroneCount > w.machinesOnline ? 1 : 0;
    step(w, joyTable, dronesActive);

    this.tick++;
    this.o.onTick?.(w, this.tick);
    return w.weDontHaveAWinner ? null : 'winner';
  }

  /** Drive ticks until the game ends. */
  async run(ch: ByteChannel): Promise<NetEnd> {
    for (;;) {
      const end = await this.runTick(ch);
      if (end) return end;
    }
  }
}
