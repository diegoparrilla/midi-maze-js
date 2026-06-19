// Shared pseudo-random generator (rnd.c). The 16-bit seed is exchanged at game
// start so every node produces identical "random" positions (D-02). The seed is
// a signed 16-bit short — truncation on each step is part of the sequence.
import { toInt16 } from './fixed';

export class Rng {
  /** `_random_seed` — signed 16-bit. */
  seed: number;

  constructor(seed = 0) {
    this.seed = toInt16(seed);
  }

  setSeed(seed: number): void {
    this.seed = toInt16(seed);
  }

  /** `_random()`: LCG `seed = seed*6907 + 130253`, stored as int16; returns it. */
  random(): number {
    this.seed = toInt16(this.seed * 6907 + 130253);
    return this.seed;
  }

  /** `_rnd(maxVal)`: 8-bit value from the middle bits, rejection-sampled, mod maxVal. */
  rnd(maxVal: number): number {
    const maxUnscaled = Math.trunc(256 / maxVal) * maxVal;
    let r: number;
    do {
      r = (this.random() >> 4) & 0xff;
    } while (r >= maxUnscaled);
    return r % maxVal;
  }
}
