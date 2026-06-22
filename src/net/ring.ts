// Lock-step MIDI-ring primitives over an async byte stream (the EPIC-12 Transport).
// The original is blocking Bconout/get_midi; here a ByteChannel buffers inbound bytes
// and `readByte()` awaits the next one, so the handshake reads like the C while
// staying async. Election + COUNT-PLAYERS faithful to slave.c / master.c (D-11, C-04).
import { MIDI_COUNT_PLAYERS, MIDI_MASTER_ELECT } from './protocol';

export interface RingChannel {
  send(bytes: Uint8Array): void;
  sendByte(b: number): void;
  readByte(timeoutMs?: number): Promise<number>;
}

const DEFAULT_TIMEOUT_MS = 2000;

/** Buffers inbound wire bytes and hands them out one at a time to the handshake. */
export class ByteChannel implements RingChannel {
  private readonly q: number[] = [];
  private waiter: {
    resolve: (b: number) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;

  private readonly sender: (bytes: Uint8Array) => void;

  /** The last control byte (>= 0x80) we sent, for interop telemetry. -1 if none yet. */
  lastControlByte = -1;

  constructor(sender: (bytes: Uint8Array) => void) {
    this.sender = sender;
  }

  send(bytes: Uint8Array): void {
    this.sender(bytes);
  }

  sendByte(b: number): void {
    const byte = b & 0xff;
    if (byte >= 0x80) this.lastControlByte = byte; // COUNT/START/TERMINATE/SEND_DATA/NAME…
    this.sender(Uint8Array.of(byte));
  }

  /** Feed inbound bytes (wire `Transport.onBytes`). */
  push(data: Uint8Array): void {
    for (const b of data) {
      if (this.waiter) {
        const w = this.waiter;
        this.waiter = null;
        clearTimeout(w.timer);
        w.resolve(b);
      } else {
        this.q.push(b);
      }
    }
  }

  /** Await the next inbound byte, rejecting on timeout (the ring's unforgiving model). */
  readByte(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<number> {
    const b = this.q.shift();
    if (b !== undefined) return Promise.resolve(b);
    return new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiter = null;
        reject(new Error('MIDI ring timeout'));
      }, timeoutMs);
      this.waiter = { resolve, reject, timer };
    });
  }

  /** Drop buffered inbound bytes (the C `while(Bconstat) Bconin` flush). */
  flush(): void {
    this.q.length = 0;
  }

  /** Reject any pending `readByte` (cancel a patient slave wait on teardown). */
  abort(reason = 'aborted'): void {
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      clearTimeout(w.timer);
      w.reject(new Error(reason));
    }
  }
}

export type Role = 'host' | 'join';

/** Election round-trip allowance (ms). The original uses MIDI_DEFAULT_TIMEOUT (~0.4s
 *  PAL VBL); over a WebSocket ring we allow more for the byte to travel every node. */
export const ELECTION_TIMEOUT_MS = 1500;

/**
 * Master election (dispatch.c `DISPATCH_AUTOMATIC`): flush, emit `0x00` once, read one
 * byte. The byte coming back `0` — our own `0x00` echoed all the way round the ring
 * (slaves echo `0x00`; a ring of one self-echoes) — means **master** (own_number 0).
 * Anything else, or a timeout (get_midi `FAILURE`), means a master already owns the
 * ring and absorbed our `0x00` (the master does *not* echo): we are a **slave**.
 *
 * Single-shot, so it never demotes a sitting master (no election storm, C-04).
 */
export async function electMaster(ch: ByteChannel, timeoutMs = ELECTION_TIMEOUT_MS): Promise<Role> {
  ch.flush();
  ch.sendByte(MIDI_MASTER_ELECT); // Bconout(MIDI, 0)
  let own: number;
  try {
    own = await ch.readByte(timeoutMs); // get_midi(MIDI_DEFAULT_TIMEOUT)
  } catch {
    own = -1; // get_midi FAILURE (timeout) → not master
  }
  return own === 0 ? 'host' : 'join';
}

export interface CountResult {
  machinesOnline: number;
  ownNumber: number;
}

/**
 * Slave wait loop (slave.c:38-86): echo every `0x00` (so an electing node's byte can
 * travel the ring, and the master detects the ring is closed) until a control byte
 * arrives; echo that byte too and return it for processing. A slave never *originates*
 * `0x00` — only `electMaster` does, exactly once (no election storm, C-04).
 */
export async function waitForControl(ch: ByteChannel, timeoutMs?: number): Promise<number> {
  for (;;) {
    const b = await ch.readByte(timeoutMs);
    if (b === MIDI_MASTER_ELECT) {
      ch.sendByte(MIDI_MASTER_ELECT);
    } else {
      ch.sendByte(b);
      return b;
    }
  }
}

/**
 * Master drives a COUNT round (master.c:217-230): send the `marker` (`0x80` COUNT, or
 * `0x86` NAME_DIALOG — same byte choreography), read its echo; send the seed `1` (master
 * is machine #1); read the tally back; broadcast it; read+ignore the byte that returns.
 * The master is `own_number` 0.
 */
export async function countMaster(
  ch: ByteChannel,
  timeoutMs?: number,
  marker: number = MIDI_COUNT_PLAYERS,
): Promise<CountResult> {
  ch.sendByte(marker);
  await ch.readByte(timeoutMs); // echoed marker (round the ring / self in a ring of one)
  ch.sendByte(1);
  const machinesOnline = await ch.readByte(timeoutMs);
  ch.sendByte(machinesOnline); // broadcast the final tally
  await ch.readByte(timeoutMs); // returns; ignore
  return { machinesOnline, ownNumber: 0 };
}

/**
 * Slave NAME_DIALOG count (slave.c:150-160): like `countSlave` but with no ignore-read
 * and no re-arm — the master's NAME round is one-shot (master.c MAZE_SET_NAMES). Called
 * after `waitForControl` has echoed the `0x86` token.
 */
export async function nameCountSlave(ch: ByteChannel, timeoutMs?: number): Promise<CountResult> {
  const ownNumber = await ch.readByte(timeoutMs);
  ch.sendByte((ownNumber + 1) & 0xff);
  const machinesOnline = await ch.readByte(timeoutMs);
  ch.sendByte(machinesOnline);
  return { machinesOnline, ownNumber };
}

/**
 * Slave COUNT-PLAYERS response (slave.c:109-120), called once `waitForControl` has
 * returned (and echoed) `MIDI_COUNT_PLAYERS`: read the running count → that is our
 * `own_number`; pass `count+1` on; adopt + forward the final tally; ignore the
 * returning byte; re-arm with another `0x80`.
 */
export async function countSlave(ch: ByteChannel, timeoutMs?: number): Promise<CountResult> {
  const ownNumber = await ch.readByte(timeoutMs);
  ch.sendByte((ownNumber + 1) & 0xff);
  const machinesOnline = await ch.readByte(timeoutMs);
  ch.sendByte(machinesOnline);
  await ch.readByte(timeoutMs); // ignore
  ch.sendByte(MIDI_COUNT_PLAYERS); // re-arm for the next round
  return { machinesOnline, ownNumber };
}
