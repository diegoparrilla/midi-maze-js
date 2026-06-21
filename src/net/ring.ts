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

  constructor(sender: (bytes: Uint8Array) => void) {
    this.sender = sender;
  }

  send(bytes: Uint8Array): void {
    this.sender(bytes);
  }

  sendByte(b: number): void {
    this.sender(Uint8Array.of(b & 0xff));
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
}

export type Role = 'host' | 'join';

export interface CountResult {
  machinesOnline: number;
  ownNumber: number;
}

/**
 * Slave wait loop (slave.c:38-86): echo every `0x00` (lets the master detect the
 * ring is closed) until a control byte arrives; echo that byte too and return it for
 * processing. We never originate `0x00` (D-11 Host/Join, no election storm per C-04).
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
 * Master drives COUNT-PLAYERS (master.c:217-230): send `0x80`, read its echo; send
 * the seed `1` (master is machine #1); read the tally back; broadcast it; read+ignore
 * the byte that returns. The master is `own_number` 0.
 */
export async function countMaster(ch: ByteChannel, timeoutMs?: number): Promise<CountResult> {
  ch.sendByte(MIDI_COUNT_PLAYERS);
  await ch.readByte(timeoutMs); // echoed 0x80 (round the ring / self in a ring of one)
  ch.sendByte(1);
  const machinesOnline = await ch.readByte(timeoutMs);
  ch.sendByte(machinesOnline); // broadcast the final tally
  await ch.readByte(timeoutMs); // returns; ignore
  return { machinesOnline, ownNumber: 0 };
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
