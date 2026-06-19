---
id: STORY-01
epic: EPIC-04
title: Determinism primitives + C golden harness
status: done
---

## Goal

The integer math the whole sim rests on, proven bit-for-bit against the original C:
`muls_divs` fixed-point, `fast_sin`/`fast_cos`/`rotate2d`, the `xy_speed_table`, and
the shared RNG (`rnd.c`). Plus the C golden harness deferred from EPIC-03 STORY-03.

## Tasks

- [x] C harness (`scripts/cref/mmref.c`, `npm run cref`) copying `muls_divs`,
      `fast_sin/cos`, `rotate2d`, `calc_sin_table`, `_random/_rnd` verbatim; emits
      golden vectors to `src/sim/golden/primitives.json`
- [x] `src/sim/fixed.ts`: `muls_divs` (16-bit args/result, truncating divide) + int16 helper
- [x] `src/sim/trig.ts`: `fastSin/fastCos/rotate2d` over the extracted sine table
- [x] `src/sim/speed-table.ts`: `xy_speed_table[256]` from `rotate2d(-32,0,-angle)`
- [x] `src/sim/rng.ts`: shared LCG (`seed*6907+130253`, int16) + `rnd(max)` rejection
- [x] Tests asserting each TS primitive equals the golden vectors

## Acceptance

**Automated:** `npm run cref` regenerates the vectors; `npm test` shows the TS
primitives match every golden value (trig over all 256 angles, speed table, RNG
sequences, `muls_divs` incl. negative/truncation edge cases).
**Manual (user):** none.

## Notes

`muls_divs` = `(short)(((int)a*b)/c)` (mulsdivs.c); divide truncates toward zero;
`_random_seed` is a signed 16-bit `short` (truncation matters). Sine table is the
extracted `trunc(sin*256)` (EPIC-03). Constants: `PLAYER_MOTION_SPEED=32`,
`PLAYER_MOTION_ROTATE=8`, angles 0..255.
