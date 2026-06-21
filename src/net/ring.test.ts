import { describe, expect, it } from 'vitest';
import { MIDI_COUNT_PLAYERS } from './protocol';
import { ByteChannel, countMaster, countSlave, waitForControl } from './ring';

describe('waitForControl (slave election echo)', () => {
  it('echoes 0x00s and returns the first control byte (also echoed)', async () => {
    const sent: number[] = [];
    const ch = new ByteChannel((b) => sent.push(...b));
    ch.push(Uint8Array.of(0x00, 0x00, MIDI_COUNT_PLAYERS));
    const got = await waitForControl(ch);
    expect(got).toBe(MIDI_COUNT_PLAYERS);
    expect(sent).toEqual([0x00, 0x00, MIDI_COUNT_PLAYERS]);
  });
});

describe('countMaster (ring of one, self-echo)', () => {
  it('counts itself: machinesOnline 1, ownNumber 0', async () => {
    // Self-echo loopback: everything sent comes back, like the orchestrator ring-of-one.
    let ch!: ByteChannel;
    ch = new ByteChannel((bytes) => queueMicrotask(() => ch.push(bytes)));
    const r = await countMaster(ch);
    expect(r).toEqual({ machinesOnline: 1, ownNumber: 0 });
  });
});

describe('countSlave', () => {
  it('adopts its own number + the tally and re-arms', async () => {
    const sent: number[] = [];
    const ch = new ByteChannel((b) => sent.push(...b));
    // master sent: running count = 1 (so we are player 1), tally = 2, then a byte to ignore
    ch.push(Uint8Array.of(1, 2, 0x00));
    const r = await countSlave(ch);
    expect(r).toEqual({ machinesOnline: 2, ownNumber: 1 });
    // we pass count+1 on, forward the tally, then re-arm with 0x80
    expect(sent).toEqual([2, 2, MIDI_COUNT_PLAYERS]);
  });
});
