// Per-tick lock-step ring loop (maingame.c) over the async transport. Each tick every
// node contributes its own joystick byte and receives the others round the ring, so
// all nodes step the identical sim from the identical joystick table (D-02, C-01).
import { step } from '../sim/step';
import type { World } from '../sim/world';
import { MIDI_START_GAME, MIDI_TERMINATE_GAME } from './protocol';
import type { ByteChannel } from './ring';
import { AdaptiveTimeout } from './timing';

/** Tight per-tick budget — the ring's unforgiving model (C-01). */
export const TICK_TIMEOUT_MS = 1500;

/**
 * One tick of the joystick ring (maingame.c:415-422). Returns the `machinesOnline`-long
 * joystick table — identical on every node — using the original send/receive order
 * (slot `ownNumber` first, stepping the index backwards mod `machinesOnline`). Same bytes
 * in the same order either way; only *when* our first byte leaves differs:
 *
 *  - **Master (ownNumber 0)** leads the tick: send first, then read each upstream byte.
 *  - **Slave (ownNumber ≠ 0)** follows strict lock-step: it reads the upstream byte
 *    *before* emitting, so it never strands a byte at a master that hasn't reached its
 *    own exchange yet. (A real ST master may still be in its preview/menu when our slave's
 *    5s preview ends; if we led, that first byte would sit in the ST's MIDI-IN and get
 *    flushed as stale → a permanent off-by-one. Reading first makes us wait for the ring.)
 *
 * In a ring of one (master, self-echo) the byte we send returns into our own slot.
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
  if (ownNumber === 0) {
    let i = 0; // master: send-first (it clocks the ring)
    do {
      ch.sendByte(joy[i]!);
      if (--i < 0) i = machinesOnline - 1;
      joy[i] = await ch.readByte(timeoutMs);
    } while (i !== 0);
    return joy;
  }
  // slave: read the upstream byte before sending — strict "one out per one in".
  let send = ownNumber;
  let recv = ownNumber;
  do {
    if (--recv < 0) recv = machinesOnline - 1;
    joy[recv] = await ch.readByte(timeoutMs); // receive first
    ch.sendByte(joy[send]!); // then forward our slot (own byte on the first pass)
    if (--send < 0) send = machinesOnline - 1;
  } while (send !== ownNumber);
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
  /** A fixed per-read deadline. When omitted, the deadline adapts to measured RTT
   *  (`adaptive`); set this to pin a deadline (tests, debugging). */
  timeoutMs?: number;
  /** Adaptive per-tick deadline (EPIC-19). Ignored when `timeoutMs` is set. */
  adaptive?: AdaptiveTimeout;
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
  /** The joystick ring table from the most recent tick (for interop telemetry). */
  lastJoy: number[] = [];
  /** Wall-clock ms the most recent ring exchange took — how close a real ring runs to
   *  the deadline (C-01); surfaced in the interop overlay (EPIC-18). */
  lastTickMs = 0;
  /** The deadline (ms) used for the most recent tick's reads (fixed or adaptive). */
  lastTimeoutMs = 0;
  private readonly o: NetGameOptions;
  private readonly adaptive: AdaptiveTimeout;

  constructor(opts: NetGameOptions) {
    this.o = opts;
    this.world = opts.world;
    this.adaptive = opts.adaptive ?? new AdaptiveTimeout();
  }

  /** The per-read deadline for the next tick: the pinned `timeoutMs`, else adaptive. */
  private deadline(): number {
    return this.o.timeoutMs ?? this.adaptive.next();
  }

  /** Run one tick. Returns the end reason, or null to keep going. */
  async runTick(ch: ByteChannel): Promise<NetEnd | null> {
    let joy: number[];
    const timeout = this.deadline();
    this.lastTimeoutMs = timeout;
    const t0 = performance.now();
    try {
      joy = await exchangeJoysticks(
        ch,
        this.o.ownNumber,
        this.o.machinesOnline,
        this.o.localInput() & 0xff,
        timeout,
      );
    } catch {
      return 'timeout'; // a dropped/late byte ends the ring cleanly (no desync)
    }
    this.lastTickMs = performance.now() - t0;
    this.adaptive.update(this.lastTickMs); // feed the RTT back so the next deadline adapts
    this.lastJoy = joy;

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
          confirm = await ch.readByte(timeout);
        } else {
          confirm = await ch.readByte(timeout); // slave: the master's decision
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
