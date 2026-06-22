---
id: STORY-02
epic: EPIC-17
title: Fixed-point edge-case lockdown
status: done
---

## Goal

Pin down the integer-math hazards (C-02) the random fuzz (STORY-01) won't reliably hit:
16-bit result overflow in `muls_divs`, long-run RNG truncation drift, and `_rnd`
rejection sampling across maxVals that divide 256 differently.

## Tasks

- [x] Extend the `mulsDivs` golden vectors (`mmref.c`) with **16-bit result-overflow** and
      cross-quadrant truncation-toward-zero cases (e.g. `32767*32767/1 → 1`, `/2 → -32768`,
      `-32768*-32768/1 → 0`). The result is a `short`, so `(a*b)/c` wraps mod 2^16; the TS
      `mulsDivs` (`toInt16(trunc(...))`) reproduces every case. Auto-tested by the existing
      `primitives.test.ts` loop.
- [x] Long-run RNG vector (`rng.randomLong`): `_random()` checkpoints at iters 99 / 999 /
      9999 / 49999, asserting the 16-bit-`short` LCG stays in sync over a long run (no
      32-vs-16-bit drift).
- [x] `_rnd` rejection-sampling vectors (`rng.rndByMax`): the first 16 `_rnd(max)` for
      `max ∈ {1,3,5,7,100,200,255,256}` — exercises `256/max*max` thresholds (incl. `1` →
      always 0, `256` → no rejection). Asserted in `primitives.test.ts`.

## Acceptance

**Automated:** the expanded `mulsDivs` table (22 cases) and the new RNG vectors all match
the C bit-for-bit; build/lint green. **Manual:** none — CI guard.

## Notes

Regenerating the golden needs `cc` (`npm run cref`); the committed `primitives.json` is the
artifact CI reads. The 16-bit wrap on out-of-range `int → short` is two's-complement on
both clang and `toInt16`, so they agree — confirmed by these vectors. Closes EPIC-17.
