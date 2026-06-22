import { describe, expect, it } from 'vitest';
import { renderDosound } from './psg';
import { SOUND_HIT, SOUND_SHOT } from './sfx';

const SR = 44100;
const FRAME = Math.round(SR / 50); // samples per 50 Hz Dosound frame

function rms(buf: Float32Array, from = 0, to = buf.length): number {
  let s = 0;
  for (let i = from; i < to; i++) s += buf[i]! * buf[i]!;
  return Math.sqrt(s / (to - from));
}

describe('renderDosound', () => {
  it('renders one frame per wait-tick of audio', () => {
    // tone on channel A, amp 15, wait 2 frames, end.
    const pkt = [0x07, 0x3e, 0x00, 0x96, 0x08, 0x0f, 0x82, 0x02, 0x82, 0x00];
    const out = renderDosound(pkt, SR);
    expect(out.length).toBe(2 * FRAME);
    expect(rms(out)).toBeGreaterThan(0);
  });

  it('a terminate-only packet renders nothing', () => {
    expect(renderDosound([0x82, 0x00], SR).length).toBe(0);
  });

  it('amplitude 0 renders silence', () => {
    const pkt = [0x07, 0x3e, 0x00, 0x96, 0x08, 0x00, 0x82, 0x01, 0x82, 0x00];
    const out = renderDosound(pkt, SR);
    expect(out.length).toBe(FRAME);
    expect(rms(out)).toBe(0);
  });

  it('renders an envelope decay tail after an immediate terminate (the hit case)', () => {
    // mixer A tone+noise, amp A = use-envelope, EP coarse 0x10, shape \___, terminate.
    const pkt = [
      0x07, 0x36, 0x08, 0x10, 0x06, 0x1f, 0x0b, 0x00, 0x0c, 0x10, 0x0d, 0x00, 0x82, 0x00,
    ];
    const out = renderDosound(pkt, SR);
    // EP = 0x1000 = 4096 → 256*4096/2e6 ≈ 0.524 s.
    expect(out.length).toBeCloseTo(0.524 * SR, -3);
    // it decays: the start is much louder than the end.
    const q = Math.floor(out.length / 8);
    expect(rms(out, 0, q)).toBeGreaterThan(rms(out, out.length - q) * 3);
  });

  it('renders the real shot packet: ~300ms, audible, ending quiet', () => {
    const out = renderDosound(SOUND_SHOT, SR);
    expect(out.length).toBe(15 * FRAME); // 15 wait frames @ 20ms
    expect(rms(out)).toBeGreaterThan(0.01);
    // amps ramp 15→1, so the first frames are louder than the last.
    expect(rms(out, 0, FRAME)).toBeGreaterThan(rms(out, out.length - FRAME));
  });

  it('renders the real hit packet: an enveloped burst', () => {
    const out = renderDosound(SOUND_HIT, SR);
    expect(out.length).toBeGreaterThan(0.4 * SR);
    expect(rms(out)).toBeGreaterThan(0.01);
  });
});
