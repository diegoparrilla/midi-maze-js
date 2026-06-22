// YM2149 (PSG) renderer for the original `Dosound` packets (sound.c). Interprets a
// register-write packet into a mono PCM buffer: square tones, 17-bit LFSR noise, the
// AY mixer, per-channel amplitude, and a one-shot volume envelope. Faithful to the
// sound.c data, not a cycle-exact chip emulation. Sound is local-only (never on the
// wire), so it is outside the deterministic sim.

const YM_CLOCK = 2_000_000; // ST YM2149 master clock
const FRAME_HZ = 50; // Dosound runs on the 50 Hz VBL; a wait `count` = count/50 s

/** AY volume level 0..15 → linear gain. The chip is roughly logarithmic (~3 dB/step);
 *  this matches that perceptually so the descending shot ramp sounds right. */
function levelGain(level: number): number {
  if (level <= 0) return 0;
  return Math.pow(2, (level - 15) / 3);
}

/** One channel's digital output (0/1) for the current registers, given the live tone
 *  phase (0..1) and noise bit. AY mixer R7: bit c = tone-c disable, bit c+3 = noise-c
 *  disable (active low). With both enabled the chip ANDs them. */
function channelBit(regs: Uint8Array, ch: number, tonePhase: number, noiseBit: number): number {
  const toneOn = ((regs[7]! >> ch) & 1) === 0;
  const noiseOn = ((regs[7]! >> (ch + 3)) & 1) === 0;
  const t = toneOn ? (tonePhase < 0.5 ? 1 : 0) : 1;
  const n = noiseOn ? noiseBit : 1;
  return t & n;
}

interface PsgState {
  tonePhase: [number, number, number];
  noisePhase: number;
  lfsr: number;
  noiseBit: number;
}

/** Render `samples` of audio for the current register state into `out` at `offset`.
 *  `envLevel` (0..15) overrides amplitude for channels whose amp register sets bit 4
 *  (use-envelope); pass a constant for plain frames. Mutates `st` so phases stay
 *  continuous across calls (no clicks at frame boundaries). */
function renderInto(
  out: Float32Array,
  offset: number,
  samples: number,
  regs: Uint8Array,
  sampleRate: number,
  st: PsgState,
  envLevelAt: (i: number) => number,
): void {
  const tonePeriod = [
    (regs[1]! << 8) | regs[0]!,
    (regs[3]! << 8) | regs[2]!,
    (regs[5]! << 8) | regs[4]!,
  ];
  const noisePeriod = regs[6]! & 0x1f || 1;
  const toneInc = tonePeriod.map((tp) => (tp > 0 ? YM_CLOCK / (16 * tp) / sampleRate : 0));
  const noiseInc = YM_CLOCK / (16 * noisePeriod) / sampleRate;

  for (let i = 0; i < samples; i++) {
    // advance the noise LFSR (17-bit, taps 0 & 3)
    st.noisePhase += noiseInc;
    while (st.noisePhase >= 1) {
      st.noisePhase -= 1;
      const fb = (st.lfsr ^ (st.lfsr >> 3)) & 1;
      st.lfsr = (st.lfsr >> 1) | (fb << 16);
      st.noiseBit = st.lfsr & 1;
    }

    let acc = 0;
    for (let ch = 0; ch < 3; ch++) {
      const amp = regs[8 + ch]!;
      const level = amp & 0x10 ? envLevelAt(i) : amp & 0x0f;
      const gain = levelGain(level);
      if (gain === 0) {
        st.tonePhase[ch] = (st.tonePhase[ch]! + toneInc[ch]!) % 1;
        continue;
      }
      const bit = channelBit(regs, ch, st.tonePhase[ch]!, st.noiseBit);
      acc += (bit * 2 - 1) * gain;
      st.tonePhase[ch] = (st.tonePhase[ch]! + toneInc[ch]!) % 1;
    }
    out[offset + i] = (acc / 3) * 0.8; // average the 3 channels, leave headroom
  }
}

/**
 * Interpret a Dosound packet into a mono Float32 PCM buffer at `sampleRate`.
 * Opcodes `0x00–0x0F` write the next byte to that register; an opcode `>= 0x80` reads a
 * frame count (`0` terminates). If the packet armed the envelope (wrote R13), its
 * one-shot decay is rendered as a tail — this is how the hit sound (which terminates
 * immediately) is voiced.
 */
export function renderDosound(packet: readonly number[], sampleRate: number): Float32Array {
  const regs = new Uint8Array(16);
  const st: PsgState = { tonePhase: [0, 0, 0], noisePhase: 0, lfsr: 1, noiseBit: 0 };

  // First pass: total sample length (explicit wait frames + any envelope tail).
  const samplesPerFrame = Math.round(sampleRate / FRAME_HZ);
  let envShape = -1;
  let waitSamples = 0;
  for (let i = 0; i < packet.length; ) {
    const op = packet[i++]!;
    if (op < 0x10) {
      regs[op] = packet[i++]!;
      if (op === 0x0d) envShape = regs[13]!;
    } else {
      const count = packet[i++]!;
      if (count === 0) break;
      waitSamples += count * samplesPerFrame;
    }
  }

  // Envelope period EP = R12<<8 | R11 (the sound.c High/Low comments are reversed);
  // a one-shot `\___` shape (CONT=0) decays over one cycle = 256*EP/clock seconds.
  const ep = (regs[12]! << 8) | regs[11]! || 1;
  const envSamples = envShape >= 0 ? Math.round(((256 * ep) / YM_CLOCK) * sampleRate) : 0;
  const out = new Float32Array(waitSamples + envSamples);

  // Second pass: render. Reset regs; replay writes, emitting audio at each wait.
  regs.fill(0);
  let off = 0;
  for (let i = 0; i < packet.length; ) {
    const op = packet[i++]!;
    if (op < 0x10) {
      regs[op] = packet[i++]!;
    } else {
      const count = packet[i++]!;
      if (count === 0) break;
      const n = count * samplesPerFrame;
      renderInto(out, off, n, regs, sampleRate, st, () => 15);
      off += n;
    }
  }

  // Envelope tail: 16-step decay from 15 → 0 (shape `\___`), then silence.
  if (envSamples > 0) {
    renderInto(out, off, envSamples, regs, sampleRate, st, (i) =>
      Math.max(0, 15 - Math.floor((i / envSamples) * 16)),
    );
  }
  return out;
}
